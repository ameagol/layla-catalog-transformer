import type { DatasetFormat } from '../model/businessRules'
import type { CellValue } from '../model/domain'
import { stringifyCellValue } from '../normalization/normalizers'
import { validateValue } from './validators'

export const DATASET_FORMAT_LABELS: Record<DatasetFormat, string> = {
  email: 'email address format', zip: 'US ZIP format (exactly five digits)', zip4: 'US ZIP+4 format (five digits, a hyphen and four digits)',
  zip_or_zip4: 'US ZIP or ZIP+4 format', us_state: 'US state name or two-letter abbreviation (50 states and District of Columbia)'
}

const US_STATES = new Set([
  'AL', 'Alabama', 'AK', 'Alaska', 'AZ', 'Arizona', 'AR', 'Arkansas', 'CA', 'California', 'CO', 'Colorado',
  'CT', 'Connecticut', 'DE', 'Delaware', 'FL', 'Florida', 'GA', 'Georgia', 'HI', 'Hawaii', 'ID', 'Idaho',
  'IL', 'Illinois', 'IN', 'Indiana', 'IA', 'Iowa', 'KS', 'Kansas', 'KY', 'Kentucky', 'LA', 'Louisiana',
  'ME', 'Maine', 'MD', 'Maryland', 'MA', 'Massachusetts', 'MI', 'Michigan', 'MN', 'Minnesota', 'MS', 'Mississippi',
  'MO', 'Missouri', 'MT', 'Montana', 'NE', 'Nebraska', 'NV', 'Nevada', 'NH', 'New Hampshire', 'NJ', 'New Jersey',
  'NM', 'New Mexico', 'NY', 'New York', 'NC', 'North Carolina', 'ND', 'North Dakota', 'OH', 'Ohio', 'OK', 'Oklahoma',
  'OR', 'Oregon', 'PA', 'Pennsylvania', 'RI', 'Rhode Island', 'SC', 'South Carolina', 'SD', 'South Dakota',
  'TN', 'Tennessee', 'TX', 'Texas', 'UT', 'Utah', 'VT', 'Vermont', 'VA', 'Virginia', 'WA', 'Washington',
  'WV', 'West Virginia', 'WI', 'Wisconsin', 'WY', 'Wyoming', 'DC', 'District of Columbia'
].map((value) => value.toLowerCase()))

export function matchesDatasetFormat(value: CellValue, format: DatasetFormat): boolean {
  const text = stringifyCellValue(value).trim()
  if (format === 'email') return validateValue(value, 'email').valid
  if (format === 'us_state') return US_STATES.has(text.toLowerCase().replace(/\s+/gu, ' '))
  if (format === 'zip') return /^\d{5}$/u.test(text)
  if (format === 'zip4') return /^\d{5}-\d{4}$/u.test(text)
  return /^\d{5}(?:-\d{4})?$/u.test(text)
}
