# Catalog Transformer

Catalog Transformer is a local-first Electron desktop application for natural-language Excel data-quality analysis.

Users maintain plain-language business rules. A constrained interpreter proposes a typed plan for each sentence, and the packaged Laya AI model must approve every enabled rule's intent before it can be saved or run. The compiler then validates the plan and a deterministic engine applies its exact comparisons, checksums, and format checks to workbook rows. This is AI-assisted rule validation, not unrestricted generative interpretation or an AI judgment of each cell.

## What it does

- Creates reusable local data-quality projects.
- Stores rules as human-readable `rules.txt` source text.
- Opens and profiles `.xlsx` workbooks without a web server or database.
- Detects headers, worksheets, data types, missing rates, uniqueness, examples, and likely name, phone, email, CPF, CNPJ, identifier, date, and numeric columns.
- Compiles duplicate, fuzzy duplicate, normalization, validation, uniqueness, consistency, and missing-data rules.
- Normalizes names, emails, Brazilian phones, CPF/CNPJ, and identifiers deterministically.
- Validates email, CPF, CNPJ, Brazilian DDD/phone, date, numeric, and required values.
- Returns grouped findings with source rows, original values, normalized values, exact rule text, confidence, and suggested action.
- Maps natural-language rules into a reviewable table of intention, input columns, priority and action item, with editable policy overrides.
- Supports missing values, missing columns, same-row comparisons, duplicates across rows, built-in email/ZIP/state formats, conditional required values and literal text/range checks. No external reference sheets are used.
- Downloads an Excel workbook containing clean rows and explicitly accepted flagged rows, with per-row action items and affected cells in red. The source workbook is never modified.
- Requires real Laya AI inference for every enabled rule during Validate and Save and Run analysis; there is no deterministic-only fallback.
- Runs the verified, packaged Laya model locally without uploading workbook data or requiring a remote endpoint.
- Consolidates findings that share source rows, shows all their type badges, and reviews each row once in a compact table with the first two columns included and affected cells highlighted.

## Architecture invariant

```text
Natural-language rules
        ↓
Constrained typed proposal + required local Laya AI intent approval
        ↓
Typed rule model + validation + ambiguity checks
        ↓
Deterministic execution plan
        ↓
Local normalization, matching, grouping, validation, and findings
```

Missing model files, inference failures, low-confidence decisions, and unsupported rules block validation and execution. Spreadsheet rows are never sent to a remote service for row-by-row decisions.

## Requirements

- Node.js 22 or later
- npm 10 or later
- Windows for the configured NSIS installer target

No Docker, Python, hosted database, authentication service, or remote backend is required.

## Run locally

```powershell
cd "C:\Users\s1390165\Documents\My Apps\catalog-transformer-w-laya"
npm install
npm run dev
```

The application starts with an empty project list. Create a project, attach your own workbook in **Load Dataset**, then write rules and select **Validate and Save** in **Rule studio**. Run and review the analysis in **Findings**.

The empty rule textarea shows five faint examples that disappear on focus; they are hints, not prefilled or saved rules. Everyday requests such as `check if phone is not empty` and `check if column phone exists` have distinct meanings: the first checks cell values, while the second checks headers. Missing-header findings show a worksheet action and appear in a **Worksheet issues** export sheet without inventing affected rows.

Development requires the verified model bundle, including `manifest.json`, in `models/laya-multilingual` or the per-user `userData/models/laya-multilingual` directory. The Laya installer includes that bundle. The app never downloads a model automatically and cannot validate rules without one.

## Typical workflow

1. Select a project to edit its name and description with **Save Project**, or use **New project** to create a blank workspace.
2. Open **Load Dataset** and select one `.xlsx` workbook. Its first worksheet is loaded; replacing the file replaces the project's dataset.
3. Review the column profile, then write one natural-language rule per paragraph in **Rules**.
4. Select **Validate and Save** to obtain Laya AI approval, compile the source, and save valid rules.
5. If a rule is marked **Invalid**, resolve its column mappings or edit its source, then **Validate and Save** again. Invalid drafts remain in the editor and do not overwrite the saved source.
6. Duplicate checks use an orange **Check Duplicate** label and missing-value checks use red **Check Missing**. There is no separate **Valid** status badge.
7. Review the mapping table: **Rule**, **Logic / input fields**, **Priority**, and **Action item**. Confirm source fields and any inline condition values or similarity policy. No external worksheets are requested. Priority supports Low, Low / Medium, Medium, Medium / High, and High; priority and action can be edited before **Validate and Save**. Run the analysis in **Findings**.
8. Select a finding by its **Affected Rows [ … ]** summary in the 20% left column and inspect the indexed source-row table on the right. Rules affecting the same row are consolidated into one group with all relevant badges, including connected duplicate rows. The group's highest Impact determines its position. Affected cells are light red; columns 1–2 remain included for context. The table starts directly with bold, uppercase column headers and **Action** controls, without a separate viewer title. Normalized values appear below originals only when changed.
9. Review each row's action items and priority. Use **Accept** to include a flagged row or **Exclude** to omit it. Decisions apply across all findings. Acceptance does not correct values or clear red cells. Unreviewed flagged rows are omitted; clean rows are included automatically.
10. Select **Download Excel** to save the reviewed `.xlsx`. Filters do not limit the download. Decisions last for the current analysis and reset when its data, rules or configuration change, or a new analysis runs.

Finding types have consistent, distinct badge colors: orange for Duplicated and red for Missing. Navigation contains only Projects, Load Dataset, Rules, and Findings. Settings and the sidebar's Processed locally card are removed; the app always uses the light theme, including when older preferences selected dark mode.

Excel downloads preserve original loaded values and column order without applying corrections or normalization. They add **Action items**, **Priority**, **Detected issues**, and **Source row** columns, and red fill/font only on affected cells. Formula-like text remains a string; source formulas/styles are not copied. Coverage warnings are included in an **Analysis notes** sheet. The old CSV API is retained only for compatibility.

## Example rules

```text
Consider customers duplicates when their name and phone are equal after ignoring accents, capitalization, spaces and phone formatting.

Treat emails as equal regardless of capitalization or surrounding spaces.

A CPF must not be associated with different customer names.

Brazilian phone numbers must contain a valid DDD.

Flag customers with a missing email.

Find possible duplicates where names are at least 90% similar and phone numbers match.
```

See `docs/rule-language.md` for the supported composable vocabulary and ambiguity behavior.

## Laya AI validation

The main process loads `convaiinnovations/laya/multilingual` with the pinned `laya-ts` runtime. Required artifact hashes and the runtime/model identity are checked before inference. Packaged model resources take precedence over development and per-user model directories.

For each enabled rule, the constrained interpreter separates title, detection condition, priority and action before proposing a typed check and bindings. Request parsing uses the actual worksheet headers, preserving conditions, polarity and quoted literals rather than matching only commercial templates. Laya receives the original source wording (or the extracted US-state condition). Simple operation checks use operation-choice validation; assertions use a positive/negative judgment of the proposed requirement, and scoped or compound checks retain full detection-intent validation. Each rule gets one prediction: the application never retries alternative questions until one approves. Owner-field agreement means comparing the named values within each row, without an identity directory. This definition is supplied as context, not as automatic approval. Approval requires at least 0.8 probability and confidence, no low-confidence flag, no truncation and no lost state tokens. Confident negatives, ambiguous columns, missing inline scope values and unsupported conditions remain blocked. No reference-sheet loading or execution path exists.

Both Validate and Save and Run analysis perform this AI review. A failed or uncertain decision blocks the entire enabled rule set; no cached or deterministic-only path bypasses Laya. Invalid drafts do not overwrite saved rules. The model may abstain even on a rule that the limited interpreter recognizes.

Laya runs locally, so AI-assisted validation works without an internet connection once the verified model is installed. Exact row comparisons remain deterministic for reproducible results. The old HTTP provider contract in `docs/provider-contract.md` is historical compatibility documentation, not the current workflow or a Settings option.

## Local storage and privacy

Electron stores application data under the operating system's per-user `userData` directory:

```text
projects/<project-id>/project.json     metadata and compact history
projects/<project-id>/rules.txt        natural-language source of truth
projects/<project-id>/analyses/        optional persisted full results
settings/settings.json                 non-secret settings
settings/provider-secret.bin           legacy OS-encrypted provider key, if present
```

Each project's metadata references one source workbook and its selected sheet; the source file is never copied or edited. The workbook reopens when the project is selected or the application restarts. Replacing it clears input mappings while retaining priority/action policy and inline condition values. Obsolete reference settings are ignored and removed when reconnecting. If the source is unavailable, Load Dataset lets the user choose a replacement. Workbook cells are parsed in the Electron main process; the renderer receives profiles and findings, not arbitrary filesystem access.

## Commercial setup and benchmark

Use `samples/customer-governance-rules.txt` for the eleven simplified dataset-only rules. `Title:`, `Rule:`, `Flag:` and `Action:` blocks are also accepted. See `docs/commercial-rule-workflow.md` for built-in validation, inline condition values, matching semantics, review/export behavior and examples.

`npm run benchmark:rules` runs **150 distinct rules against real local Laya**, with 122 supported checks and 28 missing-column or unsupported/ambiguous cases. Every case uses only its own dataset, built-in formats and inline values. It verifies priority, action, field mappings, approval/blocking and actual finding rows. Corpus files: `benchmarks/rules-150.json` and `benchmarks/rules-150.txt`. Detailed measured results: `benchmarks/results/laya-rules-150.md` and `benchmarks/results/laya-rules-150.json`.

The benchmark exits nonzero when any expected result fails, including a conservative Laya refusal of a supported rule. It never lowers the approval threshold or silently approves a rule. The report distinguishes supported-rule failures from correct safety refusals. `npm test` includes a fast 150-case deterministic preflight, which is **not** a substitute for live model validation. These are regression cases, not held-out model accuracy claims.

`npm run general:smoke` runs 48 everyday-language cases across arbitrary headers, missing values/columns, duplicates, comparisons, email/ZIP/numeric/date checks, conditional requirements, literal text and unsafe requests, plus the five exact UI placeholder examples. It also challenges real Laya with four deliberately incorrect intents. Results are saved to `benchmarks/results/laya-general-language.json`; refusals are reported honestly and cause a nonzero exit. `npm run general:smoke -- --reported-only` runs the three exact reported instructions. Desktop smoke testing also verifies the five placeholders in Chromium before focus, on focus and after blur, using isolated temporary project data.

## Security controls

- Electron context isolation enabled.
- Renderer Node integration disabled.
- Sandboxed preload exposing a minimal typed API.
- Zod validation for every IPC input.
- Main-process-only filesystem, workbook, network, credential, and export operations.
- External navigation blocked; HTTPS links open in the system browser.
- Provider secrets encrypted with the operating system credential facility.
- Rule validation sends enabled rule text only to the local Laya runtime; the current workflow makes no external NLP requests.
- Laya model identity and required artifact digests are verified before inference. Missing or uncertain AI validation blocks execution rather than falling back.
- `.xlsx` file-size and worksheet-dimension safety limits.
- No formula execution; only stored workbook values/results are read.

## Commands

```powershell
npm run dev              # Electron development mode
npm run typecheck        # Main, preload, core, and renderer TypeScript
npm test                 # Unit and integration tests
npm run build            # Production Electron bundles
npm run package          # Unpacked packaged application
npm run dist             # Windows NSIS installer
npm run portable         # Single portable Windows executable
npm run smoke            # Hidden renderer startup smoke test
npm run benchmark:rules  # 150 real local Laya cases; nonzero if expectations fail
npm run owner:smoke      # Original owner example: same-row comparison, no reference sheet
npm run icon:generate     # Rebuild Windows icon assets
npm run laya:package -- models/laya-multilingual  # Installer with the verified AI model
```

## Quality gates

The automated suite covers:

- name, phone, email, and identifier normalization;
- CPF, CNPJ, email, required, and Brazilian phone validation;
- Levenshtein, Jaro-Winkler, and token similarity;
- header detection, duplicate headers, profiling, and semantic inference;
- source-rule parsing, interpretation, ambiguity, validation, and compilation;
- Laya approval, abstention, unavailable-model and incomplete-review safeguards;
- shared-row consolidation, priority ordering, per-row evidence highlighting, review decisions, and Excel/legacy CSV exports;
- all eleven simplified commercial checks, literal/conditional predicates, no-reference regressions, and a 150-rule deterministic preflight;
- end-to-end natural language → execution → duplicate/invalid/missing/consistency findings. Packaged smoke checks also execute real model inference.

## Repository map

```text
src/
  core/       provider-independent rule model, compiler, engine, profiling, findings
  main/       Electron window, IPC, workbook sessions, local stores, NLP and export services
  preload/    minimal context-bridge API
  renderer/   React workflow and design system
tests/        unit and integration tests for the engine, AI safeguards, and review workflow
scripts/      packaging, model verification, and smoke checks
benchmarks/   150-rule corpus, live Laya runner helpers, and measured reports
docs/         architecture, rule language, and provider contract
```

## Performance model

Exact duplicate and uniqueness rules use hashing and grouping. Normalized values are cached per row, column, and operation set. Legacy fuzzy rules use exact fields as blocking keys where available and apply a deterministic comparison ceiling of 2,000,000 pairs with an actionable warning. The commercial exact-or-weighted duplicate check refuses datasets exceeding 5,000,000 pairs before comparison, without a partial result. Workbook sessions and profiles are cached until the source file changes.

## Intentional limitations

- Legacy `.xls` files are rejected because the selected safe parser supports `.xlsx`; save legacy workbooks as `.xlsx` before analysis.
- Conditions outside the explicit quoted-field and commercial vocabulary are refused; exceptions and unspecified SME policies are not silently approximated.
- Very large fuzzy matching jobs should include an exact blocking field such as phone, postal code, or identifier.
- The interpreter supports a constrained vocabulary, not arbitrary natural-language operations. Laya validates intent but does not generate new execution logic, and may abstain on a recognized rule.
- The verified local Laya model is required. There is no online provider selector or deterministic-only fallback.
- Review controls select rows for a new `.xlsx` and preserve detected errors/action items. The source workbook is never edited, and normalization suggestions are not applied to exported values.

See `docs/architecture.md` for deeper engineering details.
