// ARRL Sections for Field Day
export const ARRL_SECTIONS = [
  // Atlantic Division
  'EPA', 'MDC', 'NLI', 'NNJ', 'SNJ', 'WPA',
  
  // Central Division
  'IL', 'IN', 'WI',
  
  // Dakota Division
  'MN', 'ND', 'SD',
  
  // Delta Division
  'AR', 'LA', 'MS', 'TN',
  
  // Great Lakes Division
  'KY', 'MI', 'OH',
  
  // Hudson Division
  'ENY', 'NNY', 'WNY',
  
  // Midwest Division
  'IA', 'KS', 'MO', 'NE',
  
  // New England Division
  'CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA',
  
  // Northwestern Division
  'AK', 'EWA', 'ID', 'MT', 'OR', 'WWA',
  
  // Pacific Division
  'EB', 'LAX', 'ORG', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV',
  
  // Roanoke Division
  'NC', 'SC', 'VA', 'WV',
  
  // Rocky Mountain Division
  'CO', 'NM', 'UT', 'WY',
  
  // Southeastern Division
  'AL', 'GA', 'NFL', 'SFL',
  
  // Southwestern Division
  'AZ', 'NV',
  
  // West Gulf Division
  'NTX', 'OK', 'STX', 'WTX',
  
  // Canada (RAC Sections)
  'AB', 'BC', 'GTA', 'MB', 'NB', 'NL', 'NS', 'NT', 'ON', 'PE', 'QC', 'SK', 'YT',
  
  // DX
  'DX'
];

/**
 * Validates if a section string matches a valid ARRL section
 * @param section The section string to validate (case-insensitive)
 * @returns true if the section is valid, false otherwise
 */
export function validateArrlSection(section: string): boolean {
  if (!section || typeof section !== 'string') {
    return false;
  }
  
  const normalizedSection = section.trim().toUpperCase();
  return ARRL_SECTIONS.includes(normalizedSection);
}

/**
 * Gets the normalized (uppercase) version of a section if it's valid
 * @param section The section string to normalize
 * @returns The normalized section or null if invalid
 */
export function normalizeArrlSection(section: string): string | null {
  if (!section || typeof section !== 'string') {
    return null;
  }
  
  const normalizedSection = section.trim().toUpperCase();
  return ARRL_SECTIONS.includes(normalizedSection) ? normalizedSection : null;
}

// Valid ARRL class letters for Field Day
const VALID_CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Validates if a class string matches valid ARRL Field Day format
 * Format: 1-3 digits followed by a valid class letter (A, B, C, D, E, F)
 * Examples: 1A, 2A, 10B, 123F
 * @param classStr The class string to validate (case-insensitive)
 * @returns true if the class is valid, false otherwise
 */
export function validateArrlClass(classStr: string): boolean {
  if (!classStr || typeof classStr !== 'string') {
    return false;
  }
  
  const normalizedClass = classStr.trim().toUpperCase();
  
  // Match 1-3 digits followed by a valid class letter
  const classPattern = /^(\d{1,3})([A-F])$/;
  const match = normalizedClass.match(classPattern);
  
  if (!match) {
    return false;
  }
  
  const [, digits, letter] = match;
  const number = parseInt(digits, 10);
  
  // Number should be between 1 and 999, and letter should be valid
  return number >= 1 && number <= 999 && VALID_CLASS_LETTERS.includes(letter);
}

/**
 * Gets the normalized (uppercase) version of a class if it's valid
 * @param classStr The class string to normalize
 * @returns The normalized class or null if invalid
 */
export function normalizeArrlClass(classStr: string): string | null {
  if (!classStr || typeof classStr !== 'string') {
    return null;
  }
  
  const normalizedClass = classStr.trim().toUpperCase();
  return validateArrlClass(normalizedClass) ? normalizedClass : null;
}
