# Natural-language rule vocabulary

Rules are plain text. Use one rule per paragraph and make criteria explicit. Checks use only the selected dataset, built-in formats and literal values supplied in the rule; external references are not supported.

You can also separate the four parts explicitly. `:`, `=` and `-` are accepted label separators, and wrapped labeled blocks stay together:

```text
Title: The proposed owner must be identifiable.
Rule: If Proposed Veg Owner FND ID is blank
Flag: high-priority
Action: Route it to the Data Steward for owner master-data correction.
```

The title, flag and action do not create extra validation conditions or field bindings. This example checks only for a blank ID, not an owner directory.

## Everyday requests

Rules are not limited to the commercial examples. Field names come from the uploaded worksheet; quote unusual or ambiguous names. Common request prefixes include `check if`, `check whether`, `verify`, `ensure`, `make sure`, `find`, and `look for`, with optional polite wording.

```text
Check if Phone is not empty.
Please make sure Invoice Reference has a value.
Check for missing Delivery Contact.
Look for repeated entries in Product Code.
Make sure Billing Country matches Shipping Country.
Check if Email is invalid.
If Status is Active, Phone must not be empty.
```

`Check if Phone is not empty` is a requirement: it reports empty cells, not populated cells. The introductory `check if` is not a conditional scope. A real condition such as `If Status is Active` remains attached to the check. Requiring both fields reports a row when either is blank; requiring either field reports it only when both are blank. Requests to list populated rows, negate a check, delete records, or mix unrelated operations in one unsupported instruction are not silently converted to missing-value checks.

The rule textarea displays five faint examples only when empty and unfocused. They disappear on focus, return on blur if it is still empty, and are never inserted into the project or executed.

## Column presence

```text
Check if column Phone exists.
Verify that the VAT ID column exists.
Ensure columns Name and Phone exist.
Check for missing column VAT ID.
```

These inspect the worksheet headers, not cell contents. A present Phone column passes even if every value is blank. An absent column produces a worksheet-level finding with its name, priority and action; no source row or cell is invented. The mapping table can report an absent header without requiring a mapping to an unrelated column. Ambiguous aliases and stale explicit mappings still require correction.

Findings show the missing header in red with its action. There is no row to accept or exclude; correct the header and reload the dataset. The Excel download includes these findings in a separate **Worksheet issues** sheet, while retaining the usual accepted/clean-row export. By contrast, a missing input column for a value-level rule still blocks that rule until its mapping is resolved.

## Duplicate rules

```text
identify duplicated names
check for duplicated phones with same numbers and different formats like (19) 9090-1010, 19 90901010, 19-90901010
Customers with the same CPF are duplicates.
Customers with the same email and phone are duplicates.
Consider customers duplicates when name and phone match after normalization.
Find possible duplicates where names are at least 90% similar and phone numbers match.
```

Exact rules group rows by normalized field values. Similarity rules use Jaro-Winkler by default; mention `Levenshtein` or `token` to select another deterministic algorithm.

Formatting differences are not conflicting values. Duplicate phone checks compare canonical phone numbers, so `(19) 9090-1010`, `19 90901010`, and `19-90901010` belong to the same group. Area codes remain significant. References to different formats, capitalization, spacing, or punctuation do not turn a duplicate rule into a cross-field consistency rule. Phone examples illustrate formatting rather than restricting the check to those literal numbers.

## Normalization rules

```text
Ignore accents when comparing names.
Treat emails as equal regardless of capitalization or surrounding spaces.
Compare phone numbers using digits only.
Ignore punctuation when comparing identifiers.
```

Supported operations include Unicode canonicalization, trim, lowercase, uppercase, accent removal, whitespace normalization/removal, punctuation removal, digits only, Brazilian phone canonicalization, email canonicalization, and identifier formatting removal.

Field-incompatible operations are removed by the compiler. For example, phone canonicalization cannot accidentally run against a name column.

## Validation rules

```text
CPF must contain a valid Brazilian CPF.
CNPJ must be valid.
Brazilian phone numbers must contain a valid DDD.
Email addresses must have a valid format.
The order date must be valid.
Quantity must be numeric.
ZIP must be valid.
If "Country" = "US", "Postal code" must match ZIP format.
"Postal code" must match ZIP or ZIP+4 format.
For US accounts, the State field must contain a value from the approved US-state list.
```

Email, date and legacy optional formats skip blank cells; add a required-value rule for presence. ZIP and US-state checks reject blanks when in scope. ZIP means exactly five digits; ZIP+4 requires an explicit instruction. US states use a built-in list, not an uploaded sheet. Syntax validation does not check mailbox existence, postal deliverability or external authorities.

## Missing-data rules

```text
check for empty names
Check for blank names.
Flag customers with a missing email.
Customer name cannot be empty.
An order must have a customer identifier.
```

`Check for`, `look for`, `search for`, and `scan for` express the requested check, not a condition. Empty, blank, whitespace-only, and null values are treated as missing; non-empty values such as `0` and `false` are not. Wording such as `is not empty`, `should not be blank`, `has a value`, `is populated`, `is provided`, and `is mandatory` is supported. The rule applies to the selected column throughout the dataset unless an explicit condition is supplied.

Explicit conditions are supported, for example `If "Account Type" = "Corporate", "Email" cannot be empty.` Recognized unquoted fields also work, including `If Account Type equals SME and Veg Segmentation Type (SFDC) is blank.` Multiple equality clauses can use AND or OR. An unspecified scope such as “account types designated by the SME” requires the actual values in the inline rule editor; no policy is inferred from the dataset. Every enabled rule still requires real Laya AI approval and confirmed columns/configuration before saving or execution.

## Priority, action and text predicates

Keep one rule per paragraph or numbered/bulleted item. Wrapped list items stay together. Markdown emphasis is accepted. Detection language is separated from routing/action metadata so an instruction to send an email does not create an Email input binding.

```text
"Description" must contain "seed", ignoring case. Priority: Medium. Action: Route to Content Operations to correct the description.

"Notes" must not contain "obsolete". Priority: High. Action: Route to the Account Owner to review obsolete content.

"SKU" must start with "VEG-". Priority: Low. Action: Route to Master Data to correct the prefix.

"Email" must end with "@example.test", case-insensitive. Priority: Medium / High. Action: Route to the Account Owner to confirm the domain.

"Status" must be one of "Active", "Inactive", ignoring case. Priority: Medium. Action: Route to the owner to classify the account.

"Quantity" must be between 1 and 999 inclusive. Priority: Low / Medium. Action: Route to Data Quality to verify the quantity.

Flag rows where both "Phone" and "Email" are blank. Priority: High. Action: Route to Customer Service to provide a contact channel.
```

Quote exact column names with double quotes or backticks for unambiguous mapping; recognized unquoted field names and single-quoted literals are also accepted. Text operations are literal and case-sensitive unless explicitly case-insensitive; they do not remove accents/punctuation or execute regular expressions. A forbidden-fragment check permits blank values; a required-fragment, prefix, suffix, allowed-list or numeric-range check rejects blanks. Detection wording such as `Flag rows where "Notes" contains "obsolete"` flags the matching fragment; `If "Notes" does not contain "seed"` flags its absence. Ranges include both endpoints and reject nonnumeric strings, Boolean values, dates and hexadecimal syntax.

`"Customer ID" must be unique across records.` is an exact, trim-only uniqueness check; case and punctuation remain significant. This differs from the legacy normalized-identifier vocabulary.

Supported priority labels are Low, Low / Medium, Medium, Medium / High, and High. A prose priority range uses its first named level as the editable flag: “medium- to high-priority” maps to Medium and “low- to medium-priority” to Low. Explicit labels such as `Priority: Medium / High` and explicit user overrides retain their selected range. `Flag = medium` is also accepted. `Action:`, `Action =`, `Action item:`, `Recommended action:`, and routing sentences are retained as action policy. Confirm the default priority and enter an action when either is absent. Explicit overrides are saved with the rule, not silently inferred from customer data.

See `commercial-rule-workflow.md` for the eleven simplified dataset-only commercial checks. Unsupported syntax (including external lookups, arbitrary regex, unrepresented compound conditions and automatic merge/delete instructions) must be rephrased; AI approval cannot bypass these safeguards.

## Uniqueness rules

```text
CPF must be unique.
Customer IDs should be unique.
An email may belong to only one customer.
```

The engine groups every row sharing the same non-empty normalized value.

## Consistency rules

```text
The same CPF must not be associated with different names.
A customer cannot have different birth dates for the same CPF.
```

The first identified field is the grouping key and the second is the dependent value that must remain consistent.

Owner agreement is a separate, **same-row** comparison: `SFDC Veg Owner, Veg Owner Name and Proposed Veg Owner FND ID must identify the same person.` means flag a row when the named cell values differ. It needs only those columns, not a directory or reference file. Text is trimmed consistently across the fields without changing case or punctuation. “Medium- to high-priority” maps to the Medium flag for this example; the supplied routing sentence remains its action item.

## Ambiguity guardrails

The interpreter never silently invents a column. A field is resolved only when one candidate has sufficient confidence and a clear margin over alternatives. Otherwise Rule Studio shows candidate columns and requires a project mapping.

Vague rules such as `Find duplicate customers` are not executed because duplicate criteria are missing. Add explicit fields such as name, phone, email, or CPF.

## Extending the vocabulary

Add a reusable operation rather than a sentence-specific implementation:

1. extend the typed model in `src/core/model/domain.ts`;
2. map language to the operation in `src/core/rules/interpreter.ts`;
3. validate and compile it in `src/core/rules/compiler.ts`;
4. execute it under `src/core/engine/`;
5. retain evidence and explanation in `Finding`;
6. add unit and integration tests.
