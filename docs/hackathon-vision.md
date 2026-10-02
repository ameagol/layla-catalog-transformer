# Spreadsheet Quality Copilot: Hackathon Vision

## Objective

Build a desktop application that lets a user upload a spreadsheet, describe its data-quality rules in natural language, and receive an evidence-backed analysis with clear guidance on what to review next. The application should adapt to the spreadsheet's columns and business domain; customer records are not the product's defining use case.

The intended workflow is: **upload a spreadsheet -> inspect its structure -> define and confirm rules -> analyze the data -> review findings -> accept or exclude rows -> download a corrected CSV**. No source spreadsheet or external system is changed automatically.

## Hackathon Scope

- Accept an `.xlsx` workbook, inspect its sheets and columns, and infer likely field types. Ask the user to resolve ambiguous column mappings rather than guessing.
- Let the user write rules in natural language. Require real Laya AI intent approval for every enabled rule, show the resulting interpretation, and identify unsupported, uncertain, or ambiguous rules before execution.
- Execute validated rules against the selected worksheet and return findings with affected rows, original and normalized values, source rules, and explanations. Findings must be traceable to the data and the rule that produced them.
- Help the user prioritize and review findings. Consolidate rules affecting the same row into one group with all badges, order groups by the highest rule Impact, and retain one Accept/Delete decision per source row. The current UI does not expose a separate Copilot or external-LLM configuration.
- Download the complete dataset as CSV while excluding only user-deleted rows and leaving the source workbook unchanged. Keep review and correction under human control.

## Design Principles

- The user's workbook and rules define the task. Column names, customer terminology, and individual rule phrases must not become required assumptions for other domains.
- Natural-language interpretation is not permission to execute arbitrary code or an unsupported operation. Validate the interpretation against an explicit execution contract; surface gaps for human confirmation.
- Distinguish a rule-detected finding from a model suggestion, a possible impact, and a verified fact. AI should guide the user, not silently change data or declare uncertain cases correct or incorrect.
- Minimize data shared with any external service. Laya inference and the rule-based analysis run locally. AI approval is mandatory, and unavailable or uncertain inference must block validation rather than fall back silently.

## Prototype Status And Gaps

The current prototype imports `.xlsx` files, profiles worksheets, accepts written rules, compiles supported interpretations, executes rule-based checks, shows consolidated evidence, and downloads a corrected CSV. The multilingual Laya model is packaged for local inference and must approve each enabled rule's intent during both validation and analysis. It chooses between the interpreter's proposed operation and human review, with a confidence threshold and compiler safeguards. It does not generate arbitrary plans or discover errors by scanning arbitrary cells; exact row comparisons remain deterministic. Model failures and abstentions block the enabled rule set. Legacy review-route and conversational services remain internal but have no separate navigation screens.

The built-in deterministic interpreter recognizes a **limited set of phrases, field patterns, and rule categories**. Therefore, arbitrary natural-language rules and fully domain-independent spreadsheet analysis are the project's goal, **not a capability already delivered by this hackathon prototype**. Unknown rules must remain unsupported until their interpretation and execution can be validated.
