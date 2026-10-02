# Legacy external rule interpretation contract v1

This document preserves the historical HTTP integrations and their former UI setup steps. They are not the current rule-validation path: Settings and Copilot navigation have been removed. Validate and Save and Run analysis now require the verified local Laya model through `NlpService` and `LayaService`, with no external-provider selector or deterministic-only fallback. See `architecture.md` for the active boundary. References to Settings below describe the legacy interface, not available controls.

JEV, Laya, and custom providers integrate through one HTTP `POST` endpoint. The endpoint interprets rule text only. It must not analyze spreadsheet rows or return findings.

## Authentication

When an API key is configured, Catalog Transformer sends:

```http
Authorization: Bearer <encrypted-local-secret>
Content-Type: application/json
```

The key is decrypted only in the Electron main process immediately before the request. It is never exposed to the React renderer.

## Request

```json
{
  "contractVersion": "1",
  "provider": "jev",
  "model": "rule-interpreter",
  "rules": [
    {
      "id": "rule-1-example",
      "sourceText": "Consider customers duplicates when their name and phone match after normalization.",
      "order": 0
    }
  ],
  "dataset": {
    "name": "Customers",
    "rowCount": 42183,
    "columns": [
      {
        "key": "nome_cliente",
        "header": "Nome Cliente",
        "dataType": "text",
        "semanticType": "name",
        "missingRate": 0.002
      },
      {
        "key": "telefone",
        "header": "Telefone",
        "dataType": "text",
        "semanticType": "phone",
        "missingRate": 0.032
      }
    ]
  },
  "columnMappings": {},
  "guardrails": {
    "neverInventColumns": true,
    "deterministicExecutionOnly": true,
    "noRowData": true
  }
}
```

When **Send up to three example values per column** is enabled, each column can also contain an `examples` string array. It is omitted by default.

## Response

The response must use HTTP 2xx and match this shape:

```json
{
  "contractVersion": "1",
  "interpretations": [
    {
      "id": "rule-1-example",
      "sourceText": "Consider customers duplicates when their name and phone match after normalization.",
      "category": "duplicate",
      "status": "valid",
      "entity": "Customer",
      "purpose": "Exact normalized duplicate detection",
      "fields": [
        {
          "token": "name",
          "role": "match",
          "semanticType": "name",
          "status": "resolved",
          "columnKey": "nome_cliente",
          "columnHeader": "Nome Cliente",
          "candidates": [
            {
              "columnKey": "nome_cliente",
              "columnHeader": "Nome Cliente",
              "score": 0.99,
              "reason": "Header and values represent customer names."
            }
          ]
        },
        {
          "token": "phone",
          "role": "match",
          "semanticType": "phone",
          "status": "resolved",
          "columnKey": "telefone",
          "columnHeader": "Telefone",
          "candidates": [
            {
              "columnKey": "telefone",
              "columnHeader": "Telefone",
              "score": 0.99,
              "reason": "Header and value shapes represent Brazilian phone numbers."
            }
          ]
        }
      ],
      "normalizations": [
        "trim",
        "lowercase",
        "remove_accents",
        "normalize_whitespace",
        "phone_br"
      ],
      "logic": "and",
      "comparison": "equals",
      "severity": "warning",
      "interpretationConfidence": 0.98,
      "explanation": "Name and phone must both match after field-compatible normalization.",
      "warnings": []
    }
  ]
}
```

## Allowed values

### Category

`duplicate`, `normalization`, `validation`, `uniqueness`, `consistency`, `missing`, `similarity`

### Field role

`match`, `key`, `dependent`, `target`

### Semantic type

`name`, `phone`, `email`, `cpf`, `cnpj`, `identifier`, `date`, `number`, `text`, `unknown`

### Field status

`resolved`, `ambiguous`, `missing`

A resolved field must include a `columnKey` present in the request and its matching `columnHeader`. Ambiguous and missing fields must not be guessed. Put plausible choices in `candidates` and set the overall interpretation status to `needs_mapping`.

### Normalization

`unicode`, `trim`, `lowercase`, `uppercase`, `remove_accents`, `normalize_whitespace`, `remove_whitespace`, `remove_punctuation`, `digits_only`, `phone_br`, `email`, `identifier`

### Comparison

`equals`, `similarity`, `validate`, `unique`, `required`, `consistent`

### Validator

`email`, `cpf`, `cnpj`, `phone_br`, `date`, `number`, `required`

### Severity

`info`, `warning`, `error`, `critical`

## Similarity object

Similarity interpretations must include:

```json
{
  "similarity": {
    "algorithm": "jaro_winkler",
    "threshold": 0.9
  }
}
```

Allowed algorithms are `jaro_winkler`, `levenshtein`, and `token_jaccard`. Threshold is between `0` and `1`.

## JEV or Laya adapter checklist

1. Accept the request contract above at one stable HTTP endpoint.
2. Prompt the selected model to produce JSON only and preserve each input rule ID.
3. Give the model the allowed values and require explicit ambiguity instead of guessing.
4. Validate the model output server-side before returning it.
5. Never request the workbook or full rows.
6. Return one interpretation for each enabled source rule.
7. Configure that endpoint, model name, and key in Catalog Transformer Settings.
8. Use **Test saved provider** to verify the complete round trip.

## Application-side guardrails

Catalog Transformer validates the response with Zod. It rejects unknown rule IDs, restores `sourceText` from the local rules, and downgrades interpretations that reference absent columns. Valid output is still passed through the local compiler before any execution plan can run.

## Copilot chat endpoint (separate configuration)

The Copilot uses its own endpoint, model, and encrypted API key in **Settings → Copilot AI**. It does **not** send chat requests to the rule-interpretation contract above. Configure an HTTPS endpoint compatible with the Chat Completions JSON shape (HTTP localhost is allowed for a local adapter). If the configured URL ends exactly in `/v1`, the app appends `/chat/completions`; other paths are used as entered. A Laya installation needs an adapter with this shape if it does not expose it natively.

The app sends a request **only after the user asks about a selected finding or opts into automatic explanations for selected cases in Copilot**:

```http
POST <configured-chat-endpoint>
Content-Type: application/json
Authorization: Bearer <copilot-api-key-if-configured>
```

```json
{
  "model": "configured-model",
  "messages": [
    { "role": "system", "content": "Grounded data-steward instructions in Portuguese..." },
    { "role": "user", "content": "{\"question\":\"Por que foi sinalizado?\",\"finding\":{\"type\":\"MISSING\",\"rule\":\"Email is required\",\"explanation\":\"Email missing\",\"rowNumbers\":[7]}}" }
  ]
}
```

The response must be HTTP 2xx JSON. The preferred shape is `choices[0].message.content` as a nonempty string:

```json
{ "choices": [{ "message": { "content": "O e-mail está ausente na linha 7. Confirme na fonte autorizada antes de solicitar correção." } }] }
```

The app also accepts a list of text parts in `choices[0].message.content`, `output_text`, `output[].content[].text`, `answer`, `message.content`, or an uppercase `Output` envelope containing text or a recognized nested answer. Streaming/SSE is not supported. If an endpoint returns another envelope, the app reports field names and value types for diagnosis, never the response body. Request compatibility is still required: an endpoint using a different request protocol needs an adapter.

The main process selects the finding from the active analysis; the renderer cannot provide arbitrary evidence or an API key. By default, the context contains the rule, finding type, explanation, suggested action, fields, sheet, and up to 20 row numbers, **not original cell values**. The explicit **Send selected finding values** setting adds at most 20 evidence cells, with each original and normalized value capped at 300 characters. These metadata can still be sensitive; use a provider approved for customer data. The workbook and full dataset are never sent. Model output is displayed as advice, not executed or written to the CRM.
