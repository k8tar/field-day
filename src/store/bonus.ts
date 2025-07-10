import { ref, watch } from 'vue';

export interface Bonus {
  id: string;
  name: string;
  description: string;
  points: number;
  completed: boolean;
}

const BONUS_STORAGE_KEY = 'field_day_bonuses';

// Default Field Day bonuses based on ARRL rules
const defaultBonuses: Bonus[] = [
  {
    id: 'emergency_power',
    name: 'Emergency Power',
    description: 'All contacts made using emergency power (no commercial power)',
    points: 100,
    completed: false
  },
  {
    id: 'media_publicity',
    name: 'Media Publicity',
    description: 'Getting publicity from local media (newspaper, TV, radio)',
    points: 100,
    completed: false
  },
  {
    id: 'public_location',
    name: 'Public Location',
    description: 'Operating from a public location (park, beach, etc.)',
    points: 100,
    completed: false
  },
  {
    id: 'public_info_table',
    name: 'Public Information Table',
    description: 'Set up a table with ARRL info for the public',
    points: 100,
    completed: false
  },
  {
    id: 'nts_message',
    name: 'NTS Message',
    description: 'Originate one formal NTS message to the ARRL Section Manager',
    points: 100,
    completed: false
  },
  {
    id: 'w1aw_bulletin',
    name: 'W1AW Bulletin',
    description: 'Copy W1AW Field Day bulletin (transmitted on 40m, 80m)',
    points: 100,
    completed: false
  },
  {
    id: 'satellite_contact',
    name: 'Satellite Contact',
    description: 'Make at least one satellite contact',
    points: 100,
    completed: false
  },
  {
    id: 'alternate_power',
    name: 'Alternate Power',
    description: 'Use natural/renewable power source (solar, wind, water)',
    points: 100,
    completed: false
  },
  {
    id: 'educational_activity',
    name: 'Educational Activity',
    description: 'Conduct youth or educational activity related to amateur radio',
    points: 100,
    completed: false
  },
  {
    id: 'web_submission',
    name: 'Web Submission',
    description: 'Submit log via web (ARRL website) within 30 days',
    points: 50,
    completed: false
  }
];

// Load bonuses from localStorage or use defaults
const loadBonuses = (): Bonus[] => {
  const stored = localStorage.getItem(BONUS_STORAGE_KEY);
  if (stored) {
    const parsedBonuses = JSON.parse(stored);
    // Merge with defaults to add any new bonuses
    const mergedBonuses = defaultBonuses.map(defaultBonus => {
      const storedBonus = parsedBonuses.find((b: Bonus) => b.id === defaultBonus.id);
      return storedBonus ? { ...defaultBonus, completed: storedBonus.completed } : defaultBonus;
    });
    return mergedBonuses;
  }
  return defaultBonuses;
};

export const bonuses = ref<Bonus[]>(loadBonuses());

export function toggleBonus(bonusId: string) {
  const bonus = bonuses.value.find(b => b.id === bonusId);
  if (bonus) {
    bonus.completed = !bonus.completed;
    // No need to call saveBonuses() manually since we have a watcher
  }
}

export function resetAllBonuses() {
  bonuses.value.forEach(bonus => {
    bonus.completed = false;
  });
  // No need to call saveBonuses() manually since we have a watcher
}

function saveBonuses() {
  localStorage.setItem(BONUS_STORAGE_KEY, JSON.stringify(bonuses.value));
}

// Watch for changes and save automatically
watch(bonuses, saveBonuses, { deep: true });

// Computed values for total bonus points
export function getTotalBonusPoints(): number {
  return bonuses.value
    .filter(bonus => bonus.completed)
    .reduce((total, bonus) => total + bonus.points, 0);
}

export function getCompletedBonusCount(): number {
  return bonuses.value.filter(bonus => bonus.completed).length;
}
