# Architecture

## Design goals

1. Natural-language authoring remains the source of truth.
2. Every enabled rule receives real Laya AI intent review on each validation and analysis run, not once per row.
3. Every row-level decision is deterministic, repeatable, testable, and explainable.
4. Workbook processing and storage remain local by default.
5. Required AI approval cannot bypass compiler safeguards, and deterministic-only execution cannot bypass AI approval.

## Process boundaries

### Renderer

The React renderer owns navigation and presentation. It can request explicit actions through the preload API but cannot access Node.js, the filesystem, credentials, or raw Electron IPC.

### Preload

The sandboxed preload exposes `CatalogTransformerApi` through `contextBridge`. It contains no business logic and never exposes `ipcRenderer` itself.

### Main process

The Electron main process owns:

- workbook dialogs and parsing;
- session and profile caches;
- local project and settings storage;
- encrypted provider credentials;
- verified local Laya model loading and serialized rule-intent inference;
- mandatory AI approval, rule compilation, and deterministic analysis orchestration;
- export dialogs and file writing.

All IPC inputs are parsed with Zod before reaching services.

## Core pipeline

```text
rules.txt
  → parseSourceRules
  → interpretRules (constrained typed proposals)
  → NlpService + LayaService (real AI intent approval for every enabled rule)
  → RuleInterpretation[] with aiValidation metadata
  → compileInterpretations
  → CompilationResult / ExecutionPlan[]
  → analyzeDataset
  → Finding[] + AnalysisSummary
  → consolidateFindings (shared-row review groups with all type badges)
```

The provider-independent core lives under `src/core/` and is imported by the main process and tests.

## Rule vocabulary

Execution plans currently compose:

- normalization operations;
- exact and fuzzy field matchers;
- AND/OR duplicate logic;
- required and format validators;
- uniqueness grouping;
- key/dependent consistency grouping.
- conditional required fields, direct same-row field equality, built-in email/ZIP/US-state checks and exact composite duplicates;
- expected-owner and SME-scoped required-value checks;
- country-specific postal masks and exact-or-weighted duplicate detection;
- literal substring/prefix/suffix checks, allowed values and numeric ranges.

New operations should extend the typed unions, interpreter mapping, compiler validation, executor, explanations, and tests without adding one code path per sentence.

## Workbook lifecycle

1. The user explicitly chooses or drops an `.xlsx` file.
2. `WorkbookService` validates path, extension, size, and worksheet dimensions.
3. ExcelJS reads stored values and formula results without executing formulas.
4. The service detects a header within the first 20 rows.
5. Duplicate or missing headers receive stable internal keys and actionable warnings.
6. Rows are retained only in an in-memory main-process session.
7. The renderer receives `WorkbookProfile`, never the full dataset.
8. Analysis requests reference the session ID and selected sheet.
9. File size and modification time are rechecked; changed files invalidate the session.

## Deterministic execution

- Normalized values are cached by row, field, and operation sequence.
- Exact duplicate rules use composite hash groups.
- OR rules use deterministic connected components.
- Fuzzy rules block on exact matchers when available, then use an explicit algorithm and threshold.
- CPF/CNPJ checksums and Brazilian DDD validation are implemented locally.
- Findings retain source rule text, row numbers, values, normalized values, comparator, score, confidence, explanation, and suggested action.

## Local persistence

Projects use a directory per UUID. `rules.txt` is the maintained source. `project.json` stores metadata, mappings, and compact history. Full analysis JSON is written only when project persistence is enabled. Atomic temporary-file replacement prevents partially written text or metadata files.

## Required Laya boundary

`LayaService` loads the pinned multilingual model from packaged, development, or per-user resources, verifies required artifact digests, serializes inference, and exposes explicit timeout/unavailable errors. It is shared with retained review services. No model download or remote request occurs in this path.

`NlpService` proposes plans through the constrained interpreter. Title, condition, priority and action are separated before field/operation extraction. For typed business/value checks, Laya evaluates source wording (the extracted condition for built-in US-state checks) against an explicit proposed detection intent using a positive/negative (`noul`) question. Legacy rules use operation-choice validation. Approval requires at least 0.8 positive probability and answer confidence, no low-confidence flag, no truncation and no dropped state tokens. Confident negatives are rejected. Unsupported conditions remain blocked, unresolved columns remain `needs_mapping`, and incomplete inline condition values/weights remain `needs_configuration`. `RuleInterpretation.aiValidation` records provider, model, decision, confidence and validation method. Live smoke tests include deliberately wrong proposed intents to detect over-permissive model context.

`AnalysisService` checks exact enabled-rule coverage, IDs, and source text, then requires both AI approval and an issue-free compilation. Validate and Save and Run analysis both use this path. A missing, failed, or uncertain model blocks the entire run; there is no deterministic-only or cached-approval fallback. Exact row-level comparisons still execute typed plans deterministically. Laya is not an unrestricted generative interpreter or per-cell judge.

## Consolidated review

The engine retains raw findings, evidence, priority and action. The main process and renderer use shared-row consolidation: connected findings within one worksheet become a single group, with distinct type badges and the highest member impact. Duplicate relationships remain transitive, and no row appears in multiple groups. Filtering retains complete groups. Source projection includes the first two columns and every affected column. `rowActionItems` deduplicates per-rule actions and orders all five priority levels; `findingAffectsCell` uses row-specific evidence to prevent highlighting neighboring-row errors.

Accept/Exclude decisions are keyed by source row and analysis ID. The internal `delete` decision is retained for backward compatibility but never deletes the source. Excel export includes clean rows plus explicitly accepted flagged rows; pending/excluded flagged rows are omitted regardless of filters. `reviewedWorkbook.ts` adds action, priority, issue and source-row metadata, colors only affected cells red, preserves formula-looking text as strings, and adds a coverage-warning worksheet when needed. `ExportService` checks analysis/source freshness and source-overwrite protection, then writes atomically. The CSV endpoint remains a compatibility API.

## Dataset-only configuration and verification

`RuleConfiguration` persists priority/action overrides, inline `conditionValues` and confirmed similarity policy. Legacy reference properties are accepted only for backwards-compatible reading, ignored in preview/run and cleared on reconnect. The reference-profile IPC endpoint, picker, loader and reference execution plans have been removed. `localRuleLanguage.ts` parses direct field comparisons, explicit equality scopes, missing values and formats; `predicateLanguage.ts` handles literal text/list/range predicates. `same_fields` compares named cells directly within each row. Built-in state/ZIP/email formats live in `core/validation/datasetFormats.ts`. `duplicate_fields` hashes exact composite keys, while `unique_any` checks each identifier independently. No allowed values or SME policies are inferred from customer rows. Weighted matching refuses more than 5,000,000 pairs rather than returning partial results.

`benchmarks/` contains 150 independently expected regression rules with synthetic inputs. `benchmark:rules` uses the real production NLP service, records live decisions/confidence, executes only approved compiled rules, and checks expected rows/metadata. Deterministic corpus tests and live-model results are separate; passing a guardrail means safe refusal, not successful execution. Electron smoke tests use an isolated temporary user-data directory so local projects/settings are not modified.

## Legacy integrations

Historical external-provider adapters, encrypted settings, and review service interfaces remain for compatibility. Their former Settings and Copilot screens are not part of the current navigation. The HTTP contract document does not describe the active rule-validation path and cannot be used to bypass mandatory local Laya validation.
