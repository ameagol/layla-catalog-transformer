# Renderer architecture

The renderer is a routed React application with no direct Node.js access.

- `src/app/` wires the router, shell, and error boundary.
- `src/features/` owns one main navigation screen per folder. Screens render UI; each feature's `service.ts` is the only layer that calls the preload API.
- `src/shared/` contains components used by more than one feature.
- `src/stores/` coordinates the local project workflow and calls feature services.
- `src/styles/` owns design tokens, global behavior, and the Tailwind entrypoint.
- `src/types/` contains renderer-only ambient declarations.

Use `@/` for renderer imports and `@core/` for shared deterministic engine types. Components use literal Tailwind utilities and CSS variables from `styles/theme.css`; no CSS modules are used.

## Project and rule setup

Projects has two equal-height panels: the project form on the left (70%) and Local workspaces on the right (30%). Selecting a workspace fills the form and changes the action to Save Project; New project opens a blank form. `ProjectForm.tsx` owns form state, and the `projects:update-details` IPC action updates only name and description without persisting unrelated rule drafts. New projects always start with blank rules; no bundled projects or workbooks are created. Startup removes the exact legacy built-in project and workbook without deleting user projects or source files.

Load Dataset has only Load Data Set and Column profile panels. Its picker and drop zone accept one workbook per project, load the first worksheet, and replace the prior attachment when another file is chosen. Project metadata stores the association, and selecting a project or restarting restores its own workbook. Canceled or failed replacements keep the existing attachment. A missing source file produces an error without showing another project's data.

Rule studio stacks Natural-language rules and Interpretation at full width. Users can write paragraphs or Title/Rule/Flag/Action blocks. The table separates the title, executable condition/source columns, priority and action item. Only the current dataset is used; there is no reference worksheet picker or reference-profile IPC call. `RuleConditionMapping.tsx` allows explicit inline scope values when account types were not named in a rule, and `SimilarityRuleMapping.tsx` confirms optional weighted-matching policy. Validate and Save requests real local Laya intent approval for every enabled rule and compiles the current draft before persisting it. Invalid drafts, model abstentions and unresolved mappings remain editable and are not saved; failures never select a deterministic fallback. Priority and action overrides are keyed by stable rule ID and invalidate stale findings. Rule selection remains in the collapsed editor section.

Renderer services own API calls; the store coordinates loading, validation and persistence, including error, cancellation and retry states. `ProjectDatasetService` in the main process owns workbook-to-project associations. Tests use the same renderer aliases and preload API types as the app.

`rules/constants.ts` owns the five rule-input examples. `RulesScreen.tsx` uses a native multiline placeholder with light typography and reduced opacity. UI-only focus state clears the placeholder attribute on keyboard or pointer focus without changing the draft, with a CSS focus fallback. Empty blur restores it. The desktop smoke test verifies placeholder text and computed opacity in Chromium. Column-presence mappings offer an explicit absent-header state, not a mandatory selection of some unrelated column.

## Analysis and review

Navigation is Projects → Load Dataset → Rules → Findings. The old `/analysis`, `/copilot` and `/export` URLs redirect to Findings; `/settings` redirects to Projects. None has a separate navigation tab, and the sidebar has no Processed locally card.

`features/findings/` composes a compact analysis toolbar, a minimalist finding list (20% width), and a source-row table (80% width). `core/findings/consolidate.ts` groups findings connected by a shared source row within the same worksheet, including transitive duplicate groups. A source row appears in only one group; all member findings and evidence remain available. The group shows every distinct type badge, using orange Duplicated, red Missing, and stable theme colors for other types, with a tiny `high`, `med`, or `low` impact badge beside them and an `Affected Rows [ … ]` summary. The highest member Impact orders groups High → Medium → Low; ties retain existing order. Counts use groups, not raw rule matches. Filtering on one matching member retains the whole group and all its badges. The toolbar retains readiness links, validation, and run progress but has no Run details section. Search stays visible; advanced filters are collapsed by default.

The source-row table always includes the first two workbook columns plus the union of the selected group's affected columns, in worksheet order. There is no separate Source row viewer title or header band; the region retains an accessible label and explanatory copy is limited to a screen-reader caption. Table headers are bold and uppercase, including one-based workbook column numbers and the rightmost Action header. Affected column headers and row-specific affected cells are tinted with the theme's soft-danger color; changed normalized values appear beneath originals. Large groups use `[ Multi ]` in the list and page through 50 source rows at a time.

`findings/service.ts` reads source context through the validated `findings:rows` IPC channel. The analysis service verifies the active result and unchanged workbook before returning a bounded page of projected cells. The renderer does not access files or call any AI service to inspect rows. Changing the finding, page or analysis discards pending UI responses.

Worksheet-level findings have `scope: 'worksheet'` and no row numbers or cell evidence. `WorksheetIssueView.tsx` renders the missing header and action in place of fetching nonexistent source rows. The list labels these as worksheet columns instead of `Affected Rows [ None ]`. No row decision buttons are shown for a header issue. Reviewed exports retain them in a separate **Worksheet issues** sheet with red missing-column labels; ordinary row review and error-cell coloring are unchanged.

`RowDecisionActions.tsx` adds green Accept and red Exclude actions in the sticky rightmost table column. `RowActionItems.tsx` displays each row's action items and priorities. The store owns reversible decisions keyed by analysis ID and source row number, so a row has one decision across findings, filters and pages. New analyses reset decisions. Pending and excluded flagged rows are omitted from the reviewed workbook; clean rows are included automatically.

Download Excel sits after Filters and is also available when a run has no findings. The reviewed-workbook IPC request carries the active analysis ID and accepted row numbers. `AnalysisService` validates membership and unchanged source data; `ExportService` writes an `.xlsx` with original dataset values, accepted flagged rows, clean rows, action items, priorities and red error cells. Download ignores view filters, cannot overwrite the source and does not auto-normalize values. Cancellation and failures preserve decisions for retry. Legacy CSV helpers remain for compatibility but are not the primary review download.

Settings has no screen or navigation entry. Internal settings storage remains for compatibility; `SettingsStore.get()` treats legacy dark/system preferences as light and always selects Laya. Only the light theme is supported. Theme tokens own all badge colors. AI validation runs in the main process; the renderer never loads the model or chooses a fallback provider.
