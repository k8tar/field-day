// ARRL Divisions and their sections - organized by U.S. Call Area
// Source: https://contests.arrl.org/contestmultipliers.php?a=wve
export const ARRL_DIVISIONS = {
  'Section 0': {
    sections: ['CO', 'IA', 'KS', 'MN', 'MO', 'ND', 'NE', 'SD']
  },
  'Section 1': {
    sections: ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA']
  },
  'Section 2': {
    sections: ['ENY', 'NLI', 'NNJ', 'NNY', 'SNJ', 'WNY']
  },
  'Section 3': {
    sections: ['DE', 'EPA', 'MDC', 'WPA']
  },
  'Section 4': {
    sections: ['AL', 'GA', 'KY', 'NC', 'NFL', 'PR', 'SC', 'SFL', 'TN', 'VA', 'VI', 'WCF']
  },
  'Section 5': {
    sections: ['AR', 'LA', 'MS', 'NM', 'NTX', 'OK', 'STX', 'WTX']
  },
  'Section 6': {
    sections: ['EB', 'LAX', 'ORG', 'PAC', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV']
  },
  'Section 7': {
    sections: ['AK', 'AZ', 'EWA', 'ID', 'MT', 'NV', 'OR', 'UT', 'WWA', 'WY']
  },
  'Section 8': {
    sections: ['MI', 'OH', 'WV']
  },
  'Section 9': {
    sections: ['IL', 'IN', 'WI']
  },
  'Canada': {
    sections: ['AB', 'BC', 'GH', 'MB', 'NB', 'NL', 'NS', 'ONE', 'ONN', 'ONS', 'PE', 'QC', 'SK', 'TER']
  },
  'DX': {
    sections: ['DX', 'MX']
  }
};

// ARRL Sections for Field Day - derived from divisions
export const ARRL_SECTIONS: string[] = Object.values(ARRL_DIVISIONS).flatMap(division => division.sections);

// Field Day bands and modes - the single source of truth
export const FIELD_DAY_BANDS = ['160m', '80m', '40m', '20m', '15m', '10m', '6m', '2m'] as const;
export const FIELD_DAY_MODES = ['PH', 'CW', 'DIG'] as const;

// Division helper functions
export function getDivisionBySection(section: string): string | null {
  for (const [divisionName, divisionData] of Object.entries(ARRL_DIVISIONS)) {
    if (divisionData.sections.includes(section)) {
      return divisionName;
    }
  }
  return null;
}

export function getDivisionProgress(workedSections: string[]) {
  const progress: { [key: string]: { completed: boolean; worked: string[]; total: number } } = {};

  Object.entries(ARRL_DIVISIONS).forEach(([name, divisionData]) => {
    const workedInDivision = workedSections.filter(s => divisionData.sections.includes(s));
    progress[name] = {
      completed: workedInDivision.length === divisionData.sections.length,
      worked: workedInDivision,
      total: divisionData.sections.length
    };
  });

  return progress;
}

export function getTotalSections(): number {
  return ARRL_SECTIONS.length;
}

export function isDivisionComplete(divisionName: string, workedSections: string[]): boolean {
  const division = ARRL_DIVISIONS[divisionName as keyof typeof ARRL_DIVISIONS];
  if (!division) return false;
  
  return division.sections.every(section => workedSections.includes(section));
}

export function getLoggedSectionsCount(workedSections: string[]): number {
  return workedSections.filter(section => ARRL_SECTIONS.includes(section)).length;
}

// Utility function for checking which sections are logged from a list
export function getLoggedCount(sections: string[], qsos: any[]): number {
  return sections.filter(section => qsos.some(qso => qso.section === section)).length;
}

// Utility function for checking if a section is logged
export function isLogged(section: string, qsos: any[]): boolean {
  return qsos.some(qso => qso.section === section);
}

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

// Valid class letters for Field Day (A-F) and Winter Field Day (H, I, O, M)
const VALID_CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'I', 'O', 'M'];

/**
 * Validates if a class string matches valid Field Day format
 * Format: 1-3 digits followed by a valid class letter
 * Field Day (A-F): A=Battery, B=Home, C=Emergency, D=Home+Alternate, E=Home+Battery, F=EOC
 * Winter Field Day (H, I, O, M): H=Home, I=Indoor, O=Outdoor, M=Mobile
 * Examples: 1A, 2B, 1H, 1I, 1O, 1M
 * @param classStr The class string to validate (case-insensitive)
 * @returns true if the class is valid, false otherwise
 */
export function validateArrlClass(classStr: string): boolean {
  if (!classStr || typeof classStr !== 'string') {
    return false;
  }
  
  const normalizedClass = classStr.trim().toUpperCase();
  
  // Match 1-3 digits followed by a valid class letter (A-F for Field Day, H/I/O/M for Winter Field Day)
  const classPattern = /^(\d{1,3})([A-FHIOM])$/;
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
