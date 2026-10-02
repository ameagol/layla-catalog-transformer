# Dataset-only rule mapping and reviewed Excel

## Mapping workflow

1. Load the workbook containing the data to check. No validation workbook, owner directory or reference worksheet is used.
2. Paste one rule per paragraph, or use separate Title, Rule, Flag and Action labels. The eleven simplified examples are in `samples/customer-governance-rules.txt`.
3. Validate to display the mapping table. Review the condition, named input columns, priority and action item independently. Titles and routing actions do not introduce validation conditions or extra fields.
4. Confirm source-column mappings. If an applicable account-type scope was not specified in the sentence, enter its literal values in the inline condition editor, or put them in the rule text. Revalidate and save.
5. Run analysis. Review consolidated source rows, red deviations, priorities and action items. Accept or exclude each flagged row.
6. Download Excel. Acceptance includes the row without correcting or clearing its detected errors.

```text
Title: The proposed owner must be identifiable.
Rule: If the Proposed Veg Owner FND ID is blank
Flag: high-priority
Action: Route it to the Data Steward for owner master-data correction.
```

This example checks only whether the named field is blank. It does not check identity, membership of a directory or any external data. The title is not an instruction to add those checks. Pasted space entities such as `&#x20;` are removed.

Laya approval remains mandatory on every validation and analysis run, with the unchanged 0.8 confidence floor. Unsupported conditions, missing/ambiguous input columns, unspecified condition values and model uncertainty block execution. No deterministic approval fallback, external lookup, automatic correction or merge is available.

## Supported local checks

| Check | Example condition |
| --- | --- |
| Missing value | If Proposed Veg Owner FND ID is blank |
| Conditional presence | If "Account Type" = "SME", "Veg Segmentation Type (SFDC)" cannot be empty |
| Contact alternatives | Flag rows where both "Phone" and "Email" are blank |
| Same-row comparison | "Billing Country" and "Shipping Country" must match |
| Independent uniqueness | "Customer ID" must be unique across records |
| Duplicate combinations | Find duplicates whose normalized names and postal codes match exactly |
| Email format | Email must be a valid email address |
| Postal format | If "Country" = "US", "Postal code" must match ZIP format |
| Built-in state check | For US accounts, State must contain a valid US state |
| Text fragments | "Notes" must not contain "obsolete" |
| Prefix/suffix | "SKU" must start with "VEG-" |
| Inline allowed values | "Status" must be one of "Active", "Inactive" |
| Numeric range | "Quantity" must be between 1 and 999 inclusive |

Quotes are recommended for exact field names and literal values; recognized column names may also be unquoted. Explicit AND/OR equality scopes are supported. Unmodeled exceptions and mixed conditions remain blocked rather than partially executed.

The phrase “account types designated by the SME” does not supply account-type values. The app asks for them inside the rule mapping; it does not assume that `SME` is a literal account type or infer policy from customer rows. If `SME` is the intended value, write `Account Type = "SME"` explicitly.

## Comparison and format semantics

- Owner equality compares SFDC Veg Owner, Veg Owner Name and Proposed Veg Owner FND ID directly within each row. Sales-structure equality likewise compares the three named sales fields directly; neither rule looks up an identity or routing assignment.
- Same-row comparison trims surrounding whitespace and preserves case/punctuation. Different strings are flagged even if a human knows they represent one person. All blanks agree; partial blanks disagree. A separate required-value check rejects entirely blank ownership data. Every compared field is highlighted because the comparison cannot determine which value is correct.
- Required checks treat null, empty and whitespace-only values as missing. Zero and Boolean false are present values.
- Condition matching trims values and ignores case/accents/extra spaces, except identifier values. US, USA and United States are equivalent country values.
- US-state validation uses an embedded list of the 50 states and District of Columbia, accepting full names or two-letter abbreviations. Only US rows are checked by the supplied country/state rule. No other-country policy is invented.
- ZIP means exactly five digits. ZIP+4 is allowed only when explicitly requested, for example `"Postal code" must match ZIP or ZIP+4 format.` Preserve leading zeroes as text; the app cannot reconstruct zeroes already lost by Excel.
- Email validation checks local syntax, not mailbox existence or deliverability. Empty email cells require a separate presence rule. ZIP/state checks reject empty values when in scope.
- Identifier uniqueness groups each specified field independently across rows. Blank identifiers are ignored and case/punctuation remain significant.
- The simplified probable-customer-duplicate rule requires exact normalized name plus postal-code equality. It does not use an address, similarity threshold, fuzzy matching or an approved-customer list. Rows missing either comparison value do not form duplicate matches.
- Explicitly requested weighted similarity remains optional, with an inline threshold and positive weights totaling 100%. More than 5,000,000 candidate pairs is refused before execution rather than returning a partial result.

Existing projects may contain obsolete reference settings. They are ignored during preview/run and discarded when reconnecting a workbook. The reference-picker UI, reference-profile IPC endpoint and reference execution plans have been removed. Old source text that actually requests a directory or external lookup must be rewritten as a dataset-only condition; the app does not silently pretend that lookup was performed.

## Review and download

- Shared source rows consolidate transitively; a row is reviewed once even when several rules affect it.
- Each affected row shows deduplicated action items and priorities. Export Priority is the highest applicable priority.
- Accept and Exclude are reversible for the current analysis and never edit the source workbook. Source/rule/configuration changes reset decisions.
- Downloads include every clean row plus explicitly accepted flagged rows, in source order. Excluded and pending flagged rows stay out. View filters do not change export scope.
- The `.xlsx` preserves loaded values and columns, appends Action items / Priority / Detected issues / Source row, and marks detected cells with red fill/font, including blank cells. Acceptance never erases the errors.
- Source formulas/styles are not copied; stored values are exported and formula-like text stays text. Metadata headers are disambiguated if the source already uses those names.
- The source file cannot be overwritten. Stale analyses and changed files are refused; exports are written atomically.

## Broad validation benchmark

Run `npm run benchmark:rules` with the verified local bundle in `models/laya-multilingual`, or set `LAYA_MODEL_DIR`. No remote AI request is made. The suite has exactly 150 distinct rules with independently specified priorities/actions, including the eleven simplified commercial rules, 111 additional executable cases and 28 mapping/intent guardrails. No case needs an external reference dataset.

Coverage includes null/empty/whitespace/zero/Boolean inputs, field equality, conditional presence, contact alternatives, email/ZIP/state formats, text fragments, prefixes/suffixes, Unicode, punctuation, inline allowed values, numeric bounds, duplicates across rows, missing/ambiguous/stale columns and unsafe/ambiguous-intent refusals.

The runner writes `benchmarks/rules-150.json`, `benchmarks/rules-150.txt`, and JSON/Markdown results under `benchmarks/results/`. A supported case passes only if Laya approves, compilation succeeds and the actual flagged rows, mappings and metadata match expectations. A guardrail passes only if execution remains blocked. Nonzero exit status exposes any failed expectation, including a conservative model refusal. These are regression examples, not a held-out estimate of general NLP accuracy.

`npm run business:smoke` validates all eleven examples with real Laya and checks rejection of four deliberately wrong intents. `npm run owner:smoke` separately verifies the original owner wording, actual differing-row detection, Medium priority, exact action and rejection of a wrong proposed check.
