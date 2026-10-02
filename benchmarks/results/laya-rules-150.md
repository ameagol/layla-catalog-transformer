# 150-rule real Laya benchmark

Generated: 2026-10-02T12:14:54.402Z

This is a live CPU inference run through the production NLP service, not mocked AI. Every case has a separate synthetic input dataset and an independently specified priority, action, mapping outcome and (for executable rules) finding rows.

- Live Laya calls: 150. Confidence threshold: 0.80, unchanged. No deterministic fallback.
- Overall: 125/150 passed.
- Supported-rule approval and execution: 97/122.
- Safe blocking of unsupported, ambiguous or unconfigured rules: 28/28.
- Simplified commercial rules: 11/11 passed end to end.
- Priority extraction: 150/150; action extraction: 150/150.
- Unsafe executions: 0.
- Sum of case latency (includes interpretation and tiny dataset checks, excludes model startup): 209522 ms.

A guardrail pass means the rule is blocked, not that it is executable. A supported-rule failure can be a conservative model refusal; inspect the confidence and positive probability in the JSON report. High confidence in a negative answer is never approval. Approved findings are checked against expected source rows and retain their priority/action.

These are fixed regression examples, not a held-out accuracy estimate or proof of general natural-language understanding. All checks use only the selected dataset, built-in formats and inline values. Recognized unquoted columns and quoted text fragments are supported; arbitrary regex, automatic data changes and unrepresented conditions are intentionally refused.

## By family

| Family | Passed | Cases |
| --- | ---: | ---: |
| supplied dataset-only commercial rules | 11 | 11 |
| built-in email format | 1 | 1 |
| missing values | 9 | 18 |
| conditional required | 11 | 12 |
| minimum contact | 3 | 6 |
| text fragments | 12 | 12 |
| text prefixes | 8 | 8 |
| text suffixes | 8 | 8 |
| allowed values | 8 | 8 |
| numeric inputs | 7 | 8 |
| exact uniqueness | 6 | 8 |
| legacy vocabulary | 6 | 10 |
| missing input columns | 8 | 8 |
| ambiguous input columns | 1 | 1 |
| stale input mapping | 1 | 1 |
| dataset-only conditions and comparisons | 5 | 10 |
| unsupported or ambiguous intent | 18 | 18 |
| unquoted fields and single-quoted text fragments | 2 | 2 |

## Results

| Case | Family | Expected | Actual | Laya decision | Confidence | Result |
| --- | --- | --- | --- | --- | ---: | --- |
| BENCH-001 | supplied dataset-only commercial rules | valid | valid | approved | 0.9584 | PASS |
| BENCH-002 | supplied dataset-only commercial rules | valid | valid | approved | 0.9531 | PASS |
| BENCH-003 | supplied dataset-only commercial rules | valid | valid | approved | 0.9797 | PASS |
| BENCH-004 | supplied dataset-only commercial rules | valid | valid | approved | 0.9724 | PASS |
| BENCH-005 | supplied dataset-only commercial rules | valid | valid | approved | 0.9248 | PASS |
| BENCH-006 | supplied dataset-only commercial rules | valid | valid | approved | 0.9828 | PASS |
| BENCH-007 | supplied dataset-only commercial rules | valid | valid | approved | 0.8426 | PASS |
| BENCH-008 | supplied dataset-only commercial rules | valid | valid | approved | 0.9821 | PASS |
| BENCH-009 | supplied dataset-only commercial rules | valid | valid | approved | 0.9646 | PASS |
| BENCH-010 | supplied dataset-only commercial rules | valid | valid | approved | 0.9457 | PASS |
| BENCH-011 | supplied dataset-only commercial rules | valid | valid | approved | 0.9415 | PASS |
| BENCH-012 | built-in email format | valid | valid | approved | 0.9658 | PASS |
| BENCH-013 | missing values | valid | unsupported | needs_review | 0.5881 | FAIL |
| BENCH-014 | missing values | valid | valid | approved | 0.9771 | PASS |
| BENCH-015 | missing values | valid | valid | approved | 0.9942 | PASS |
| BENCH-016 | missing values | valid | unsupported | needs_review | 0.7253 | FAIL |
| BENCH-017 | missing values | valid | unsupported | needs_review | 0.5562 | FAIL |
| BENCH-018 | missing values | valid | valid | approved | 0.9915 | PASS |
| BENCH-019 | missing values | valid | unsupported | needs_review | 0.8599 | FAIL |
| BENCH-020 | missing values | valid | valid | approved | 0.9449 | PASS |
| BENCH-021 | missing values | valid | valid | approved | 0.9910 | PASS |
| BENCH-022 | missing values | valid | unsupported | needs_review | 0.5860 | FAIL |
| BENCH-023 | missing values | valid | unsupported | needs_review | 0.7878 | FAIL |
| BENCH-024 | missing values | valid | valid | approved | 0.9932 | PASS |
| BENCH-025 | missing values | valid | unsupported | needs_review | 0.9864 | FAIL |
| BENCH-026 | missing values | valid | valid | approved | 0.8856 | PASS |
| BENCH-027 | missing values | valid | valid | approved | 0.9966 | PASS |
| BENCH-028 | missing values | valid | unsupported | needs_review | 0.6999 | FAIL |
| BENCH-029 | missing values | valid | unsupported | needs_review | 0.7480 | FAIL |
| BENCH-030 | missing values | valid | valid | approved | 0.9938 | PASS |
| BENCH-031 | conditional required | valid | valid | approved | 0.9277 | PASS |
| BENCH-032 | conditional required | valid | valid | approved | 0.8704 | PASS |
| BENCH-033 | conditional required | valid | valid | approved | 0.9777 | PASS |
| BENCH-034 | conditional required | valid | valid | approved | 0.9302 | PASS |
| BENCH-035 | conditional required | valid | valid | approved | 0.9180 | PASS |
| BENCH-036 | conditional required | valid | valid | approved | 0.8134 | PASS |
| BENCH-037 | conditional required | valid | valid | approved | 0.9011 | PASS |
| BENCH-038 | conditional required | valid | valid | approved | 0.9017 | PASS |
| BENCH-039 | conditional required | valid | valid | approved | 0.9807 | PASS |
| BENCH-040 | conditional required | valid | unsupported | needs_review | 0.5718 | FAIL |
| BENCH-041 | conditional required | valid | valid | approved | 0.9569 | PASS |
| BENCH-042 | conditional required | valid | valid | approved | 0.9867 | PASS |
| BENCH-043 | minimum contact | valid | unsupported | needs_review | 0.7942 | FAIL |
| BENCH-044 | minimum contact | valid | unsupported | needs_review | 0.6808 | FAIL |
| BENCH-045 | minimum contact | valid | unsupported | needs_review | 0.7936 | FAIL |
| BENCH-046 | minimum contact | valid | valid | approved | 0.8157 | PASS |
| BENCH-047 | minimum contact | valid | valid | approved | 0.8661 | PASS |
| BENCH-048 | minimum contact | valid | valid | approved | 0.8181 | PASS |
| BENCH-049 | text fragments | valid | valid | approved | 0.9966 | PASS |
| BENCH-050 | text fragments | valid | valid | approved | 0.9946 | PASS |
| BENCH-051 | text fragments | valid | valid | approved | 0.9985 | PASS |
| BENCH-052 | text fragments | valid | valid | approved | 0.9946 | PASS |
| BENCH-053 | text fragments | valid | valid | approved | 0.9907 | PASS |
| BENCH-054 | text fragments | valid | valid | approved | 0.9981 | PASS |
| BENCH-055 | text fragments | valid | valid | approved | 0.9953 | PASS |
| BENCH-056 | text fragments | valid | valid | approved | 0.9971 | PASS |
| BENCH-057 | text fragments | valid | valid | approved | 0.9962 | PASS |
| BENCH-058 | text fragments | valid | valid | approved | 0.9918 | PASS |
| BENCH-059 | text fragments | valid | valid | approved | 0.9975 | PASS |
| BENCH-060 | text fragments | valid | valid | approved | 0.9978 | PASS |
| BENCH-061 | text prefixes | valid | valid | approved | 0.9980 | PASS |
| BENCH-062 | text prefixes | valid | valid | approved | 0.9980 | PASS |
| BENCH-063 | text prefixes | valid | valid | approved | 0.9987 | PASS |
| BENCH-064 | text prefixes | valid | valid | approved | 0.9839 | PASS |
| BENCH-065 | text prefixes | valid | valid | approved | 0.9975 | PASS |
| BENCH-066 | text prefixes | valid | valid | approved | 0.9967 | PASS |
| BENCH-067 | text prefixes | valid | valid | approved | 0.9963 | PASS |
| BENCH-068 | text prefixes | valid | valid | approved | 0.9974 | PASS |
| BENCH-069 | text suffixes | valid | valid | approved | 0.9986 | PASS |
| BENCH-070 | text suffixes | valid | valid | approved | 0.9966 | PASS |
| BENCH-071 | text suffixes | valid | valid | approved | 0.9982 | PASS |
| BENCH-072 | text suffixes | valid | valid | approved | 0.9985 | PASS |
| BENCH-073 | text suffixes | valid | valid | approved | 0.9950 | PASS |
| BENCH-074 | text suffixes | valid | valid | approved | 0.9979 | PASS |
| BENCH-075 | text suffixes | valid | valid | approved | 0.9987 | PASS |
| BENCH-076 | text suffixes | valid | valid | approved | 0.9979 | PASS |
| BENCH-077 | allowed values | valid | valid | approved | 0.9977 | PASS |
| BENCH-078 | allowed values | valid | valid | approved | 0.9987 | PASS |
| BENCH-079 | allowed values | valid | valid | approved | 0.9974 | PASS |
| BENCH-080 | allowed values | valid | valid | approved | 0.9970 | PASS |
| BENCH-081 | allowed values | valid | valid | approved | 0.9977 | PASS |
| BENCH-082 | allowed values | valid | valid | approved | 0.9970 | PASS |
| BENCH-083 | allowed values | valid | valid | approved | 0.9957 | PASS |
| BENCH-084 | allowed values | valid | valid | approved | 0.9978 | PASS |
| BENCH-085 | numeric inputs | valid | valid | approved | 0.9729 | PASS |
| BENCH-086 | numeric inputs | valid | unsupported | needs_review | 0.6286 | FAIL |
| BENCH-087 | numeric inputs | valid | valid | approved | 0.9657 | PASS |
| BENCH-088 | numeric inputs | valid | valid | approved | 0.9456 | PASS |
| BENCH-089 | numeric inputs | valid | valid | approved | 0.9263 | PASS |
| BENCH-090 | numeric inputs | valid | valid | approved | 0.9826 | PASS |
| BENCH-091 | numeric inputs | valid | valid | approved | 0.8997 | PASS |
| BENCH-092 | numeric inputs | valid | valid | approved | 0.9870 | PASS |
| BENCH-093 | exact uniqueness | valid | valid | approved | 0.9633 | PASS |
| BENCH-094 | exact uniqueness | valid | unsupported | needs_review | 0.7432 | FAIL |
| BENCH-095 | exact uniqueness | valid | valid | approved | 0.8300 | PASS |
| BENCH-096 | exact uniqueness | valid | valid | approved | 0.9234 | PASS |
| BENCH-097 | exact uniqueness | valid | unsupported | needs_review | 0.7053 | FAIL |
| BENCH-098 | exact uniqueness | valid | valid | approved | 0.8943 | PASS |
| BENCH-099 | exact uniqueness | valid | valid | approved | 0.9442 | PASS |
| BENCH-100 | exact uniqueness | valid | valid | approved | 0.9304 | PASS |
| BENCH-101 | legacy vocabulary | valid | valid | approved | 0.9435 | PASS |
| BENCH-102 | legacy vocabulary | valid | unsupported | needs_review | 0.7121 | FAIL |
| BENCH-103 | legacy vocabulary | valid | valid | approved | 0.9923 | PASS |
| BENCH-104 | legacy vocabulary | valid | valid | approved | 0.9928 | PASS |
| BENCH-105 | legacy vocabulary | valid | valid | approved | 0.9902 | PASS |
| BENCH-106 | legacy vocabulary | valid | valid | approved | 0.8641 | PASS |
| BENCH-107 | legacy vocabulary | valid | unsupported | needs_review | 0.9219 | FAIL |
| BENCH-108 | legacy vocabulary | valid | unsupported | needs_review | 0.6707 | FAIL |
| BENCH-109 | legacy vocabulary | valid | valid | approved | 0.9119 | PASS |
| BENCH-110 | legacy vocabulary | valid | unsupported | needs_review | 0.7645 | FAIL |
| BENCH-111 | missing input columns | needs_mapping | unsupported | needs_review | 0.8478 | PASS |
| BENCH-112 | missing input columns | needs_mapping | unsupported | needs_review | 0.5270 | PASS |
| BENCH-113 | missing input columns | needs_mapping | unsupported | needs_review | 0.6219 | PASS |
| BENCH-114 | missing input columns | needs_mapping | unsupported | needs_review | 0.7914 | PASS |
| BENCH-115 | missing input columns | needs_mapping | unsupported | needs_review | 0.9295 | PASS |
| BENCH-116 | missing input columns | needs_mapping | unsupported | needs_review | 0.8656 | PASS |
| BENCH-117 | missing input columns | needs_mapping | unsupported | needs_review | 0.9115 | PASS |
| BENCH-118 | missing input columns | needs_mapping | unsupported | needs_review | 0.9468 | PASS |
| BENCH-119 | ambiguous input columns | needs_mapping | needs_mapping | approved | 0.9945 | PASS |
| BENCH-120 | stale input mapping | needs_mapping | unsupported | needs_review | 0.9797 | PASS |
| BENCH-121 | dataset-only conditions and comparisons | valid | valid | approved | 0.9525 | PASS |
| BENCH-122 | dataset-only conditions and comparisons | valid | unsupported | needs_review | 0.8666 | FAIL |
| BENCH-123 | dataset-only conditions and comparisons | valid | valid | approved | 0.9639 | PASS |
| BENCH-124 | dataset-only conditions and comparisons | valid | unsupported | needs_review | 0.7771 | FAIL |
| BENCH-125 | dataset-only conditions and comparisons | valid | unsupported | needs_review | 0.9228 | FAIL |
| BENCH-126 | dataset-only conditions and comparisons | valid | valid | approved | 0.9637 | PASS |
| BENCH-127 | dataset-only conditions and comparisons | valid | unsupported | needs_review | 0.9116 | FAIL |
| BENCH-128 | dataset-only conditions and comparisons | valid | valid | approved | 0.9390 | PASS |
| BENCH-129 | dataset-only conditions and comparisons | valid | unsupported | needs_review | 0.6884 | FAIL |
| BENCH-130 | dataset-only conditions and comparisons | valid | valid | approved | 0.9686 | PASS |
| BENCH-131 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.6260 | PASS |
| BENCH-132 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.8616 | PASS |
| BENCH-133 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5228 | PASS |
| BENCH-134 | unquoted fields and single-quoted text fragments | valid | valid | approved | 0.9963 | PASS |
| BENCH-135 | unquoted fields and single-quoted text fragments | valid | valid | approved | 0.9979 | PASS |
| BENCH-136 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5611 | PASS |
| BENCH-137 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5922 | PASS |
| BENCH-138 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.6644 | PASS |
| BENCH-139 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5293 | PASS |
| BENCH-140 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5659 | PASS |
| BENCH-141 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.7813 | PASS |
| BENCH-142 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5989 | PASS |
| BENCH-143 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.7934 | PASS |
| BENCH-144 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.7331 | PASS |
| BENCH-145 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.5765 | PASS |
| BENCH-146 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.6372 | PASS |
| BENCH-147 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.6799 | PASS |
| BENCH-148 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.8264 | PASS |
| BENCH-149 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.7757 | PASS |
| BENCH-150 | unsupported or ambiguous intent | unsupported | unsupported | needs_review | 0.7086 | PASS |

## Rules, priorities and action items

| Case | Natural-language rule | Expected priority | Expected action |
| --- | --- | --- | --- |
| BENCH-001 | Transactional accounts must have a Vegetable owner. If an account is classified as a Transactional Account and its SFDC Veg Owner field is blank, flag a high-priority missing-owner issue. Route it to the Commercial Data Steward to assign an accountable owner. | high | Route it to the Commercial Data Steward to assign an accountable owner. |
| BENCH-002 | The proposed owner must exist. If the Proposed Veg Owner FND ID is blank, flag this as a high-priority issue and route it to the Data Steward for owner master-data correction. | high | route it to the Data Steward for owner master-data correction. |
| BENCH-003 | Owner fields must identify the same person. If SFDC Veg Owner, Veg Owner Name, and Proposed Veg Owner FND ID identify different people, flag a medium-priority ownership conflict. Route it to the account's current owner or the Data Steward to confirm the correct assignment. | medium | Route it to the account's current owner or the Data Steward to confirm the correct assignment. |
| BENCH-004 | The sales structure must match. If the Sales Organization, Sales Group, and Sales Office are different, flag this as a high-priority issue and route it to Commercial Operations or the Data Steward. | high | route it to Commercial Operations or the Data Steward. |
| BENCH-005 | The owner must align with the commercial structure. If the current owner does not exist, flag a medium-priority ownership inconsistency. Route it to Commercial Operations for confirmation. | medium | Route it to Commercial Operations for confirmation. |
| BENCH-006 | Required segmentation must be populated. For account types designated by the SME, the Veg Segmentation Type (SFDC) field must contain a value. If it is blank, flag a medium-priority issue. Route it to the Account Owner to supply the missing value. | medium | Route it to the Account Owner to supply the missing value. |
| BENCH-007 | Country and state must be compatible. For US accounts, the State field must contain a value from the approved US-state list. Flag incompatible values as medium-priority geographic issues and route them to the Account Owner or Data Steward to correct the address data. | medium | route them to the Account Owner or Data Steward to correct the address data. |
| BENCH-008 | Postal codes must follow the country's format. US postal codes must match the ZIP format. Flag invalid formats as medium priority and route them to the Account Owner for verification. | medium | route them to the Account Owner for verification. |
| BENCH-009 | Contact details must meet the minimum standard. For active or transactional accounts, flag a medium-priority issue if both Phone and Email are blank. Route accounts that fail the applicable standard to the Account Owner. | medium | Route accounts that fail the applicable standard to the Account Owner. |
| BENCH-010 | Master identifiers must be unique. If the same MDMi BPID, FNDG ID, or Salesforce ID appears on more than one record, flag a high-priority duplicate master-identifier issue. Route it to the Master Data Steward for investigation. | high | Route it to the Master Data Steward for investigation. |
| BENCH-011 | Potential duplicate customers must be reviewed. Flag records as high-priority probable duplicates when their normalized names and postal codes match exactly. Route them to the Master Data Steward for validation before any governed merge. | high | Route them to the Master Data Steward for validation before any governed merge. |
| BENCH-012 | Email must be a valid email address. Priority: Medium / High. Recommended action: Route it to the Account Owner to correct the email address. | medium_high | Route it to the Account Owner to correct the email address. |
| BENCH-013 | "Email" is required. Priority: Medium. Action: Route to the Account Owner to complete Email. | medium | Route to the Account Owner to complete Email. |
| BENCH-014 | The "Phone" field is mandatory. Priority: Low / Medium. Action item: Route to the Account Owner to complete Phone. | low_medium | Route to the Account Owner to complete Phone. |
| BENCH-015 | "Description" must not be blank. Priority: Low. Recommended action: Route to the Account Owner to complete Description. | low | Route to the Account Owner to complete Description. |
| BENCH-016 | "Customer Code" cannot be empty. Priority: High. Action: Route to the Account Owner to complete Customer Code. | high | Route to the Account Owner to complete Customer Code. |
| BENCH-017 | Flag rows where "Account Name" is missing. Priority: Medium / High. Action item: Route to the Account Owner to complete Account Name. | medium_high | Route to the Account Owner to complete Account Name. |
| BENCH-018 | "Country" must have a value. Priority: Medium. Recommended action: Route to the Account Owner to complete Country. | medium | Route to the Account Owner to complete Country. |
| BENCH-019 | "State" is required. Priority: Low / Medium. Action: Route to the Account Owner to complete State. | low_medium | Route to the Account Owner to complete State. |
| BENCH-020 | The "Postal code" field is mandatory. Priority: Low. Action item: Route to the Account Owner to complete Postal code. | low | Route to the Account Owner to complete Postal code. |
| BENCH-021 | "Tax ID" must not be blank. Priority: High. Recommended action: Route to the Account Owner to complete Tax ID. | high | Route to the Account Owner to complete Tax ID. |
| BENCH-022 | "SKU" cannot be empty. Priority: Medium / High. Action: Route to the Account Owner to complete SKU. | medium_high | Route to the Account Owner to complete SKU. |
| BENCH-023 | Flag rows where "Cost Center" is missing. Priority: Medium. Action item: Route to the Account Owner to complete Cost Center. | medium | Route to the Account Owner to complete Cost Center. |
| BENCH-024 | "Currency" must have a value. Priority: Low / Medium. Recommended action: Route to the Account Owner to complete Currency. | low_medium | Route to the Account Owner to complete Currency. |
| BENCH-025 | "Sales Office" is required. Priority: Low. Action: Route to the Account Owner to complete Sales Office. | low | Route to the Account Owner to complete Sales Office. |
| BENCH-026 | The "External Reference" field is mandatory. Priority: High. Action item: Route to the Account Owner to complete External Reference. | high | Route to the Account Owner to complete External Reference. |
| BENCH-027 | "Nome completo" must not be blank. Priority: Medium / High. Recommended action: Route to the Account Owner to complete Nome completo. | medium_high | Route to the Account Owner to complete Nome completo. |
| BENCH-028 | "Delivery Address" cannot be empty. Priority: Medium. Action: Route to the Account Owner to complete Delivery Address. | medium | Route to the Account Owner to complete Delivery Address. |
| BENCH-029 | Flag rows where "Source System" is missing. Priority: Low / Medium. Action item: Route to the Account Owner to complete Source System. | low_medium | Route to the Account Owner to complete Source System. |
| BENCH-030 | "Approval Notes" must have a value. Priority: Low. Recommended action: Route to the Account Owner to complete Approval Notes. | low | Route to the Account Owner to complete Approval Notes. |
| BENCH-031 | If "Country" is "US", "State" must not be blank. Priority: High. Action: Route to the Data Steward to complete State for the US scope. | high | Route to the Data Steward to complete State for the US scope. |
| BENCH-032 | If "Account Status" is "Active", "Email" must not be blank. Priority: Medium / High. Action item: Route to the Data Steward to complete Email for the Active scope. | medium_high | Route to the Data Steward to complete Email for the Active scope. |
| BENCH-033 | If "Account Type" is "Grower", "Segmentation" must not be blank. Priority: Medium. Recommended action: Route to the Data Steward to complete Segmentation for the Grower scope. | medium | Route to the Data Steward to complete Segmentation for the Grower scope. |
| BENCH-034 | If "Region" is "North", "Sales Team" must not be blank. Priority: Low / Medium. Action: Route to the Data Steward to complete Sales Team for the North scope. | low_medium | Route to the Data Steward to complete Sales Team for the North scope. |
| BENCH-035 | If "Payment Method" is "Transfer", "Bank Reference" must not be blank. Priority: Low. Action item: Route to the Data Steward to complete Bank Reference for the Transfer scope. | low | Route to the Data Steward to complete Bank Reference for the Transfer scope. |
| BENCH-036 | If "Product Type" is "Seed", "Variety" must not be blank. Priority: High. Recommended action: Route to the Data Steward to complete Variety for the Seed scope. | high | Route to the Data Steward to complete Variety for the Seed scope. |
| BENCH-037 | If "Currency" is "USD", "Tax Code" must not be blank. Priority: Medium / High. Action: Route to the Data Steward to complete Tax Code for the USD scope. | medium_high | Route to the Data Steward to complete Tax Code for the USD scope. |
| BENCH-038 | If "Channel" is "Distributor", "Partner ID" must not be blank. Priority: Medium. Action item: Route to the Data Steward to complete Partner ID for the Distributor scope. | medium | Route to the Data Steward to complete Partner ID for the Distributor scope. |
| BENCH-039 | If "Delivery Mode" is "Courier", "Postal code" must not be blank. Priority: Low / Medium. Recommended action: Route to the Data Steward to complete Postal code for the Courier scope. | low_medium | Route to the Data Steward to complete Postal code for the Courier scope. |
| BENCH-040 | If "Approval Status" is "Approved", "Approver" must not be blank. Priority: Low. Action: Route to the Data Steward to complete Approver for the Approved scope. | low | Route to the Data Steward to complete Approver for the Approved scope. |
| BENCH-041 | If "Language" is "PT", "Portuguese Description" must not be blank. Priority: High. Action item: Route to the Data Steward to complete Portuguese Description for the PT scope. | high | Route to the Data Steward to complete Portuguese Description for the PT scope. |
| BENCH-042 | If "Customer Tier" is "Gold", "Account Manager" must not be blank. Priority: Medium / High. Recommended action: Route to the Data Steward to complete Account Manager for the Gold scope. | medium_high | Route to the Data Steward to complete Account Manager for the Gold scope. |
| BENCH-043 | Flag rows where both "Phone" and "Email" are blank. Priority: Medium. Action: Route to Customer Service to provide Phone or Email. | medium | Route to Customer Service to provide Phone or Email. |
| BENCH-044 | Flag rows where both "Mobile" and "Office Phone" are blank. Priority: Low / Medium. Action item: Route to Customer Service to provide Mobile or Office Phone. | low_medium | Route to Customer Service to provide Mobile or Office Phone. |
| BENCH-045 | Flag rows where both "Primary Email" and "Backup Email" are blank. Priority: Low. Recommended action: Route to Customer Service to provide Primary Email or Backup Email. | low | Route to Customer Service to provide Primary Email or Backup Email. |
| BENCH-046 | Flag rows where both "Billing Phone" and "Billing Email" are blank. Priority: High. Action: Route to Customer Service to provide Billing Phone or Billing Email. | high | Route to Customer Service to provide Billing Phone or Billing Email. |
| BENCH-047 | Flag rows where both "Contact Name" and "Contact ID" are blank. Priority: Medium / High. Action item: Route to Customer Service to provide Contact Name or Contact ID. | medium_high | Route to Customer Service to provide Contact Name or Contact ID. |
| BENCH-048 | Flag rows where both "Support Email" and "Support Phone" are blank. Priority: Medium. Recommended action: Route to Customer Service to provide Support Email or Support Phone. | medium | Route to Customer Service to provide Support Email or Support Phone. |
| BENCH-049 | "Description" must contain "seed". Priority: Low / Medium. Action: Route to Content Operations to review the seed fragment in Description. | low_medium | Route to Content Operations to review the seed fragment in Description. |
| BENCH-050 | "Notes" must not contain "obsolete", ignoring case. Priority: Low. Action item: Route to Content Operations to review the obsolete fragment in Notes. | low | Route to Content Operations to review the obsolete fragment in Notes. |
| BENCH-051 | "Account Name" must contain "Ltd". Priority: High. Recommended action: Route to Content Operations to review the Ltd fragment in Account Name. | high | Route to Content Operations to review the Ltd fragment in Account Name. |
| BENCH-052 | "Internal Notes" must not contain "test customer", ignoring case. Priority: Medium / High. Action: Route to Content Operations to review the test customer fragment in Internal Notes. | medium_high | Route to Content Operations to review the test customer fragment in Internal Notes. |
| BENCH-053 | "Portuguese Description" must contain "café", ignoring case. Priority: Medium. Action item: Route to Content Operations to review the café fragment in Portuguese Description. | medium | Route to Content Operations to review the café fragment in Portuguese Description. |
| BENCH-054 | "Product Notes" must not contain "do not sell". Priority: Low / Medium. Recommended action: Route to Content Operations to review the do not sell fragment in Product Notes. | low_medium | Route to Content Operations to review the do not sell fragment in Product Notes. |
| BENCH-055 | "Email" must contain "@". Priority: Low. Action: Route to Content Operations to review the @ fragment in Email. | low | Route to Content Operations to review the @ fragment in Email. |
| BENCH-056 | "Website" must not contain "javascript:", ignoring case. Priority: High. Action item: Route to Content Operations to review the javascript: fragment in Website. | high | Route to Content Operations to review the javascript: fragment in Website. |
| BENCH-057 | "Address" must contain "Street", ignoring case. Priority: Medium / High. Recommended action: Route to Content Operations to review the Street fragment in Address. | medium_high | Route to Content Operations to review the Street fragment in Address. |
| BENCH-058 | "Comment" must not contain "<script>". Priority: Medium. Action: Route to Content Operations to review the <script> fragment in Comment. | medium | Route to Content Operations to review the <script> fragment in Comment. |
| BENCH-059 | "Product Code" must contain "A.B". Priority: Low / Medium. Action item: Route to Content Operations to review the A.B fragment in Product Code. | low_medium | Route to Content Operations to review the A.B fragment in Product Code. |
| BENCH-060 | "Customer Name" must not contain "DUMMY", ignoring case. Priority: Low. Recommended action: Route to Content Operations to review the DUMMY fragment in Customer Name. | low | Route to Content Operations to review the DUMMY fragment in Customer Name. |
| BENCH-061 | "SKU" must start with "VEG-". Priority: High. Action: Route to the Master Data Steward to correct the SKU prefix. | high | Route to the Master Data Steward to correct the SKU prefix. |
| BENCH-062 | "Purchase Order" must start with "PO/". Priority: Medium / High. Action item: Route to the Master Data Steward to correct the Purchase Order prefix. | medium_high | Route to the Master Data Steward to correct the Purchase Order prefix. |
| BENCH-063 | "Country Code" must start with "US". Priority: Medium. Recommended action: Route to the Master Data Steward to correct the Country Code prefix. | medium | Route to the Master Data Steward to correct the Country Code prefix. |
| BENCH-064 | "Telephone" must start with "+1". Priority: Low / Medium. Action: Route to the Master Data Steward to correct the Telephone prefix. | low_medium | Route to the Master Data Steward to correct the Telephone prefix. |
| BENCH-065 | "External Key" must start with "EXT_". Priority: Low. Action item: Route to the Master Data Steward to correct the External Key prefix. | low | Route to the Master Data Steward to correct the External Key prefix. |
| BENCH-066 | "Website" must start with "https://". Priority: High. Recommended action: Route to the Master Data Steward to correct the Website prefix. | high | Route to the Master Data Steward to correct the Website prefix. |
| BENCH-067 | "Batch" must start with "LOT.". Priority: Medium / High. Action: Route to the Master Data Steward to correct the Batch prefix. | medium_high | Route to the Master Data Steward to correct the Batch prefix. |
| BENCH-068 | "Route Code" must start with "N-". Priority: Medium. Action item: Route to the Master Data Steward to correct the Route Code prefix. | medium | Route to the Master Data Steward to correct the Route Code prefix. |
| BENCH-069 | "Email" must end with "@example.test", case-insensitive. Priority: Low / Medium. Recommended action: Route to Data Operations to verify the Email suffix. | low_medium | Route to Data Operations to verify the Email suffix. |
| BENCH-070 | "Filename" must end with ".csv", case-insensitive. Priority: Low. Action: Route to Data Operations to verify the Filename suffix. | low | Route to Data Operations to verify the Filename suffix. |
| BENCH-071 | "Company Name" must end with "Ltd", case-insensitive. Priority: High. Action item: Route to Data Operations to verify the Company Name suffix. | high | Route to Data Operations to verify the Company Name suffix. |
| BENCH-072 | "Product Code" must end with "-US", case-insensitive. Priority: Medium / High. Recommended action: Route to Data Operations to verify the Product Code suffix. | medium_high | Route to Data Operations to verify the Product Code suffix. |
| BENCH-073 | "Document" must end with ".pdf", case-insensitive. Priority: Medium. Action: Route to Data Operations to verify the Document suffix. | medium | Route to Data Operations to verify the Document suffix. |
| BENCH-074 | "Locale" must end with "_BR", case-insensitive. Priority: Low / Medium. Action item: Route to Data Operations to verify the Locale suffix. | low_medium | Route to Data Operations to verify the Locale suffix. |
| BENCH-075 | "Export Name" must end with ".xlsx", case-insensitive. Priority: Low. Recommended action: Route to Data Operations to verify the Export Name suffix. | low | Route to Data Operations to verify the Export Name suffix. |
| BENCH-076 | "Unit Label" must end with "kg", case-insensitive. Priority: High. Action: Route to Data Operations to verify the Unit Label suffix. | high | Route to Data Operations to verify the Unit Label suffix. |
| BENCH-077 | "Status" must be one of "Active", "Inactive", ignoring case. Priority: Medium / High. Action item: Route to the Account Owner to select an approved Status value. | medium_high | Route to the Account Owner to select an approved Status value. |
| BENCH-078 | "Currency" must be one of "USD", "EUR", "BRL", ignoring case. Priority: Medium. Recommended action: Route to the Account Owner to select an approved Currency value. | medium | Route to the Account Owner to select an approved Currency value. |
| BENCH-079 | "Channel" must be one of "Direct", "Partner", ignoring case. Priority: Low / Medium. Action: Route to the Account Owner to select an approved Channel value. | low_medium | Route to the Account Owner to select an approved Channel value. |
| BENCH-080 | "Consent" must be one of "Yes", "No", ignoring case. Priority: Low. Action item: Route to the Account Owner to select an approved Consent value. | low | Route to the Account Owner to select an approved Consent value. |
| BENCH-081 | "Risk Level" must be one of "Low", "Medium", "High", ignoring case. Priority: High. Recommended action: Route to the Account Owner to select an approved Risk Level value. | high | Route to the Account Owner to select an approved Risk Level value. |
| BENCH-082 | "Unit" must be one of "kg", "g", ignoring case. Priority: Medium / High. Action: Route to the Account Owner to select an approved Unit value. | medium_high | Route to the Account Owner to select an approved Unit value. |
| BENCH-083 | "Language" must be one of "en", "pt", "es", ignoring case. Priority: Medium. Action item: Route to the Account Owner to select an approved Language value. | medium | Route to the Account Owner to select an approved Language value. |
| BENCH-084 | "Account Type" must be one of "Grower", "Distributor", ignoring case. Priority: Low / Medium. Recommended action: Route to the Account Owner to select an approved Account Type value. | low_medium | Route to the Account Owner to select an approved Account Type value. |
| BENCH-085 | "Age" must be between 18 and 120 inclusive. Priority: Low. Action: Route to Data Quality to correct the numeric Age input. | low | Route to Data Quality to correct the numeric Age input. |
| BENCH-086 | "Quantity" must be between 1 and 999 inclusive. Priority: High. Action item: Route to Data Quality to correct the numeric Quantity input. | high | Route to Data Quality to correct the numeric Quantity input. |
| BENCH-087 | "Discount" must be between 0 and 100 inclusive. Priority: Medium / High. Recommended action: Route to Data Quality to correct the numeric Discount input. | medium_high | Route to Data Quality to correct the numeric Discount input. |
| BENCH-088 | "Temperature" must be between -20 and 50 inclusive. Priority: Medium. Action: Route to Data Quality to correct the numeric Temperature input. | medium | Route to Data Quality to correct the numeric Temperature input. |
| BENCH-089 | "Score" must be between 0 and 1 inclusive. Priority: Low / Medium. Action item: Route to Data Quality to correct the numeric Score input. | low_medium | Route to Data Quality to correct the numeric Score input. |
| BENCH-090 | "Lead Time" must be between 0 and 365 inclusive. Priority: Low. Recommended action: Route to Data Quality to correct the numeric Lead Time input. | low | Route to Data Quality to correct the numeric Lead Time input. |
| BENCH-091 | "Latitude" must be between -90 and 90 inclusive. Priority: High. Action: Route to Data Quality to correct the numeric Latitude input. | high | Route to Data Quality to correct the numeric Latitude input. |
| BENCH-092 | "Unit Price" must be between 0.01 and 10000 inclusive. Priority: Medium / High. Action item: Route to Data Quality to correct the numeric Unit Price input. | medium_high | Route to Data Quality to correct the numeric Unit Price input. |
| BENCH-093 | "Customer ID" must be unique across records. Priority: Medium. Recommended action: Route to the Master Data Steward to investigate duplicate Customer ID values. | medium | Route to the Master Data Steward to investigate duplicate Customer ID values. |
| BENCH-094 | "Invoice ID" must be unique across records. Priority: Low / Medium. Action: Route to the Master Data Steward to investigate duplicate Invoice ID values. | low_medium | Route to the Master Data Steward to investigate duplicate Invoice ID values. |
| BENCH-095 | "Order ID" must be unique across records. Priority: Low. Action item: Route to the Master Data Steward to investigate duplicate Order ID values. | low | Route to the Master Data Steward to investigate duplicate Order ID values. |
| BENCH-096 | "External Key" must be unique across records. Priority: High. Recommended action: Route to the Master Data Steward to investigate duplicate External Key values. | high | Route to the Master Data Steward to investigate duplicate External Key values. |
| BENCH-097 | "SKU" must be unique across records. Priority: Medium / High. Action: Route to the Master Data Steward to investigate duplicate SKU values. | medium_high | Route to the Master Data Steward to investigate duplicate SKU values. |
| BENCH-098 | "Serial Number" must be unique across records. Priority: Medium. Action item: Route to the Master Data Steward to investigate duplicate Serial Number values. | medium | Route to the Master Data Steward to investigate duplicate Serial Number values. |
| BENCH-099 | "Email" must be unique across records. Priority: Low / Medium. Recommended action: Route to the Master Data Steward to investigate duplicate Email values. | low_medium | Route to the Master Data Steward to investigate duplicate Email values. |
| BENCH-100 | "Registration Code" must be unique across records. Priority: Low. Action: Route to the Master Data Steward to investigate duplicate Registration Code values. | low | Route to the Master Data Steward to investigate duplicate Registration Code values. |
| BENCH-101 | Flag rows with a missing email. Priority: High. Action item: Route to the Account Owner to supply the email. | high | Route to the Account Owner to supply the email. |
| BENCH-102 | Phone is required. Priority: Medium / High. Recommended action: Route to Customer Service to supply the phone. | medium_high | Route to Customer Service to supply the phone. |
| BENCH-103 | Email must have a valid format. Priority: Medium. Action: Route to the Account Owner to verify the email format. | medium | Route to the Account Owner to verify the email format. |
| BENCH-104 | CPF must be valid. Priority: Low / Medium. Action item: Route to the Data Steward to verify the CPF checksum. | low_medium | Route to the Data Steward to verify the CPF checksum. |
| BENCH-105 | CNPJ must be valid. Priority: Low. Recommended action: Route to the Data Steward to verify the CNPJ checksum. | low | Route to the Data Steward to verify the CNPJ checksum. |
| BENCH-106 | Find duplicate customers with the same email. Priority: High. Action: Route to Customer Operations to validate the duplicate email. | high | Route to Customer Operations to validate the duplicate email. |
| BENCH-107 | Find duplicates with the same name and phone. Priority: Medium / High. Action item: Route to the Master Data Steward to review the matching name and phone. | medium_high | Route to the Master Data Steward to review the matching name and phone. |
| BENCH-108 | The same CPF cannot have different names. Priority: Medium. Recommended action: Route to the Account Owner to resolve the conflicting names. | medium | Route to the Account Owner to resolve the conflicting names. |
| BENCH-109 | Customer ID must be unique. Priority: Low / Medium. Action: Route to Master Data to review the repeated customer identifier. | low_medium | Route to Master Data to review the repeated customer identifier. |
| BENCH-110 | Find duplicate names with at least 90% similarity. Priority: Low. Action item: Route to Master Data for similarity review before merging. | low | Route to Master Data for similarity review before merging. |
| BENCH-111 | "Email" is required. Priority: High. Recommended action: Route to the Data Steward to map the missing Email input. | high | Route to the Data Steward to map the missing Email input. |
| BENCH-112 | "State" is required. Priority: Medium / High. Action: Route to the Data Steward to map the missing State input. | medium_high | Route to the Data Steward to map the missing State input. |
| BENCH-113 | "Postal code" is required. Priority: Medium. Action item: Route to the Data Steward to map the missing Postal code input. | medium | Route to the Data Steward to map the missing Postal code input. |
| BENCH-114 | "Proposed Veg Owner FND ID" is required. Priority: Low / Medium. Recommended action: Route to the Data Steward to map the missing Proposed Veg Owner FND ID input. | low_medium | Route to the Data Steward to map the missing Proposed Veg Owner FND ID input. |
| BENCH-115 | "Tax ID" is required. Priority: Low. Action: Route to the Data Steward to map the missing Tax ID input. | low | Route to the Data Steward to map the missing Tax ID input. |
| BENCH-116 | "Sales Office" is required. Priority: High. Action item: Route to the Data Steward to map the missing Sales Office input. | high | Route to the Data Steward to map the missing Sales Office input. |
| BENCH-117 | "Segmentation" is required. Priority: Medium / High. Recommended action: Route to the Data Steward to map the missing Segmentation input. | medium_high | Route to the Data Steward to map the missing Segmentation input. |
| BENCH-118 | "Description" is required. Priority: Medium. Action: Route to the Data Steward to map the missing Description input. | medium | Route to the Data Steward to map the missing Description input. |
| BENCH-119 | "Email" must not be blank. Priority: Low / Medium. Action item: Route to the analyst to choose the intended email column. | low_medium | Route to the analyst to choose the intended email column. |
| BENCH-120 | "Customer Code" is mandatory. Priority: Low. Recommended action: Route to the analyst to replace the stale column mapping. | low | Route to the analyst to replace the stale column mapping. |
| BENCH-121 | The proposed owner must be identifiable. If the Proposed Veg Owner FND ID is blank. Priority: High. Action: Route to the Account Owner to resolve local validation 1. | high | Route to the Account Owner to resolve local validation 1. |
| BENCH-122 | SFDC Veg Owner, Veg Owner Name and Proposed Veg Owner FND ID must identify the same person. Priority: Medium / High. Action item: Route to the Account Owner to resolve local validation 2. | medium_high | Route to the Account Owner to resolve local validation 2. |
| BENCH-123 | If Sales Organization, Sales Group and Sales Office be different. Priority: Medium. Recommended action: Route to the Account Owner to resolve local validation 3. | medium | Route to the Account Owner to resolve local validation 3. |
| BENCH-124 | The owner must align with the commercial structure. If the current owner does not exists. Priority: Low / Medium. Action: Route to the Account Owner to resolve local validation 4. | low_medium | Route to the Account Owner to resolve local validation 4. |
| BENCH-125 | "Billing Country" and "Shipping Country" must match. Priority: Low. Action item: Route to the Account Owner to resolve local validation 5. | low | Route to the Account Owner to resolve local validation 5. |
| BENCH-126 | If "Status" = "Active", "Phone" cannot be empty. Priority: High. Recommended action: Route to the Account Owner to resolve local validation 6. | high | Route to the Account Owner to resolve local validation 6. |
| BENCH-127 | If "Country" = "US", "Postal code" must match ZIP format. Priority: Medium / High. Action: Route to the Account Owner to resolve local validation 7. | medium_high | Route to the Account Owner to resolve local validation 7. |
| BENCH-128 | If Account Type equals SME and Veg Segmentation Type (SFDC) is blank. Priority: Medium. Action item: Route to the Account Owner to resolve local validation 8. | medium | Route to the Account Owner to resolve local validation 8. |
| BENCH-129 | "Postal code" must match ZIP or ZIP+4 format. Priority: Low / Medium. Recommended action: Route to the Account Owner to resolve local validation 9. | low_medium | Route to the Account Owner to resolve local validation 9. |
| BENCH-130 | If "Status" is "Active", "Email" must be a valid email address. Priority: Low. Action: Route to the Account Owner to resolve local validation 10. | low | Route to the Account Owner to resolve local validation 10. |
| BENCH-131 | Make every customer record perfect. Priority: High. Action item: Route to the analyst to clarify the requested operation 1. | high | Route to the analyst to clarify the requested operation 1. |
| BENCH-132 | Predict likely customer churn from Notes. Priority: Medium / High. Recommended action: Route to the analyst to clarify the requested operation 2. | medium_high | Route to the analyst to clarify the requested operation 2. |
| BENCH-133 | If "Status" is "Active", "Email" is required unless the customer opted out. Priority: Medium. Action: Route to the analyst to clarify the requested operation 3. | medium | Route to the analyst to clarify the requested operation 3. |
| BENCH-134 | Email must end with '@example.test'. Priority: Low / Medium. Action item: Route to the analyst to clarify the requested operation 4. | low_medium | Route to the analyst to clarify the requested operation 4. |
| BENCH-135 | Customer Name must contain 'Ltd'. Priority: Low. Recommended action: Route to the analyst to clarify the requested operation 5. | low | Route to the analyst to clarify the requested operation 5. |
| BENCH-136 | "Notes" must match the regular expression "(a+)+$". Priority: High. Action: Route to the analyst to clarify the requested operation 6. | high | Route to the analyst to clarify the requested operation 6. |
| BENCH-137 | "Score" must be between 100 and 0. Priority: Medium / High. Action item: Route to the analyst to clarify the requested operation 7. | medium_high | Route to the analyst to clarify the requested operation 7. |
| BENCH-138 | "SKU" must contain "". Priority: Medium. Recommended action: Route to the analyst to clarify the requested operation 8. | medium | Route to the analyst to clarify the requested operation 8. |
| BENCH-139 | Email must have a valid format only if Account Type is Corporate. Priority: Low / Medium. Action: Route to the analyst to clarify the requested operation 9. | low_medium | Route to the analyst to clarify the requested operation 9. |
| BENCH-140 | Do not flag missing email values. Priority: Low. Action item: Route to the analyst to clarify the requested operation 10. | low | Route to the analyst to clarify the requested operation 10. |
| BENCH-141 | Never check invalid CPF values. Priority: High. Recommended action: Route to the analyst to clarify the requested operation 11. | high | Route to the analyst to clarify the requested operation 11. |
| BENCH-142 | "Amount" must be numeric and greater than 0. Priority: Medium / High. Action: Route to the analyst to clarify the requested operation 12. | medium_high | Route to the analyst to clarify the requested operation 12. |
| BENCH-143 | Birth Date must be before today. Priority: Medium. Action item: Route to the analyst to clarify the requested operation 13. | medium | Route to the analyst to clarify the requested operation 13. |
| BENCH-144 | "Notes" must contain "alpha" or "beta". Priority: Low / Medium. Recommended action: Route to the analyst to clarify the requested operation 14. | low_medium | Route to the analyst to clarify the requested operation 14. |
| BENCH-145 | "Notes" must contain "alpha" and "Email" must be valid. Priority: Low. Action: Route to the analyst to clarify the requested operation 15. | low | Route to the analyst to clarify the requested operation 15. |
| BENCH-146 | Delete every row whose email is invalid. Priority: High. Action item: Route to the analyst to clarify the requested operation 16. | high | Route to the analyst to clarify the requested operation 16. |
| BENCH-147 | Automatically merge duplicate customers using email. Priority: Medium / High. Recommended action: Route to the analyst to clarify the requested operation 17. | medium_high | Route to the analyst to clarify the requested operation 17. |
| BENCH-148 | For customers in the north region, flag a missing phone. Priority: Medium. Action: Route to the analyst to clarify the requested operation 18. | medium | Route to the analyst to clarify the requested operation 18. |
| BENCH-149 | Flag overdue invoices. Priority: Low / Medium. Action item: Route to the analyst to clarify the requested operation 19. | low_medium | Route to the analyst to clarify the requested operation 19. |
| BENCH-150 | Validate Tax Code against the tax authority website. Priority: Low. Recommended action: Route to the analyst to clarify the requested operation 20. | low | Route to the analyst to clarify the requested operation 20. |

## Failures

### BENCH-013

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-016

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-017

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-019

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-022

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-023

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-025

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-028

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-029

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-040

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-043

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-044

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-045

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-086

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-094

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-097

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-102

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-107

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-108

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-110

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-122

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-124

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-125

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-127

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.

### BENCH-129

- Supported rule did not pass the mandatory Laya approval and compilation gates.
- Laya AI did not confidently approve this rule intent. Rephrase the rule and validate again; it will not run without AI approval.
