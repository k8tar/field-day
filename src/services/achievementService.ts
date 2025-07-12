/**
 * Achievement Notification Service
 * Handles automatic system notifications for Field Day achievements
 */

import { getCompletedSections, qsos, getTotalQsoPoints } from '@/store/qso';
import { bonuses } from '@/store/bonus';
import { fileStorage } from './fileStorage';

export interface Achievement {
  id: string;
  type: 'section' | 'bonus' | 'multiplier' | 'milestone' | 'announcement';
  title: string;
  description: string;
  achieved: boolean;
  timestamp?: number;
}

class AchievementService {
  private achievements: Map<string, Achievement> = new Map();
  private messageCallback: ((type: string, message: string) => void) | null = null;
  private lastSectionCount = 0;
  private lastQsoCount = 0;
  private lastBonusCount = 0;
  private checkIntervalId: number | null = null;

  constructor() {
    this.initializeTracking();
  }

  // Set the callback function for sending messages
  setMessageCallback(callback: ((type: string, message: string) => void) | null) {
    this.messageCallback = callback;
  }

  private initializeTracking() {
    // Start periodic checking for achievements
    this.checkIntervalId = window.setInterval(() => {
      this.checkAchievements();
    }, 5000); // Check every 5 seconds

    // Initial check
    setTimeout(() => {
      this.initializeBaseline();
      this.checkAchievements();
    }, 1000);
  }

  private initializeBaseline() {
    // Set initial baseline values
    this.lastSectionCount = getCompletedSections().length;
    this.lastQsoCount = qsos.value.length;
    this.lastBonusCount = bonuses.value.filter(b => b.completed).length;
  }

  private async checkAchievements() {
    await this.checkSectionAchievements();
    await this.checkQsoMilestones();
    await this.checkBonusAchievements();
    await this.checkMultiplierAchievements();
    await this.checkDivisionCompletion();
  }

  private async checkSectionAchievements() {
    const completedSections = getCompletedSections();
    const currentCount = completedSections.length;

    // Check for new sections worked
    if (currentCount > this.lastSectionCount) {
      const newSections = currentCount - this.lastSectionCount;
      
      if (newSections === 1) {
        // Find the newest section
        const newestSection = completedSections[completedSections.length - 1];
        this.sendNotification('section', `New section worked: ${newestSection}!`);
      } else {
        this.sendNotification('section', `${newSections} new sections worked! Total: ${currentCount}`);
      }
      
      this.lastSectionCount = currentCount;
    }

    // Check for section milestones
    this.checkSectionMilestones(currentCount);
  }

  private checkSectionMilestones(sectionCount: number) {
    const milestones = [10, 25, 50, 75, 83]; // 83 is all US/VE sections
    
    milestones.forEach(milestone => {
      const achievementId = `sections_${milestone}`;
      if (sectionCount >= milestone && !this.achievements.has(achievementId)) {
        this.achievements.set(achievementId, {
          id: achievementId,
          type: 'milestone',
          title: `${milestone} Sections Worked`,
          description: `Worked ${milestone} ARRL sections`,
          achieved: true,
          timestamp: Date.now()
        });

        if (milestone === 83) {
          this.sendNotification('announcement', `🏆 ALL SECTIONS WORKED! Amazing achievement - worked all 83 US and VE sections!`);
        } else {
          this.sendNotification('multiplier', `🎯 ${milestone} sections worked milestone achieved!`);
        }
      }
    });
  }

  private async checkQsoMilestones() {
    const currentQsoCount = qsos.value.length;
    
    if (currentQsoCount > this.lastQsoCount) {
      // Check QSO count milestones
      const milestones = [50, 100, 250, 500, 1000, 2000];
      
      milestones.forEach(milestone => {
        const achievementId = `qsos_${milestone}`;
        if (currentQsoCount >= milestone && this.lastQsoCount < milestone && !this.achievements.has(achievementId)) {
          this.achievements.set(achievementId, {
            id: achievementId,
            type: 'milestone',
            title: `${milestone} QSOs`,
            description: `Logged ${milestone} QSOs`,
            achieved: true,
            timestamp: Date.now()
          });

          this.sendNotification('multiplier', `🚀 ${milestone} QSOs logged! Great work!`);
        }
      });

      this.lastQsoCount = currentQsoCount;
    }
  }

  private async checkBonusAchievements() {
    const completedBonuses = bonuses.value.filter(b => b.completed);
    const currentBonusCount = completedBonuses.length;

    if (currentBonusCount > this.lastBonusCount) {
      const newBonuses = currentBonusCount - this.lastBonusCount;
      
      // Find newly completed bonuses
      const recentBonus = completedBonuses[completedBonuses.length - 1];
      if (recentBonus) {
        this.sendNotification('bonus', `Bonus completed: ${recentBonus.name} (+${recentBonus.points} points)`);
      }

      // Check if all bonuses completed
      if (currentBonusCount === bonuses.value.length) {
        this.sendNotification('announcement', `🏆 ALL BONUSES COMPLETED! Maximum bonus points achieved!`);
      }

      this.lastBonusCount = currentBonusCount;
    }
  }

  private async checkMultiplierAchievements() {
    const points = getTotalQsoPoints();
    const sections = getCompletedSections().length;
    const score = points * sections;

    // Score milestones
    const scoreMilestones = [1000, 5000, 10000, 25000, 50000, 100000];
    
    scoreMilestones.forEach(milestone => {
      const achievementId = `score_${milestone}`;
      if (score >= milestone && !this.achievements.has(achievementId)) {
        this.achievements.set(achievementId, {
          id: achievementId,
          type: 'multiplier',
          title: `${milestone.toLocaleString()} Points`,
          description: `Achieved ${milestone.toLocaleString()} total points`,
          achieved: true,
          timestamp: Date.now()
        });

        this.sendNotification('multiplier', `✨ ${milestone.toLocaleString()} point milestone reached!`);
      }
    });
  }

  private async checkDivisionCompletion() {
    const sections = getCompletedSections();
    const divisions = this.getDivisionProgress(sections);
    
    // Check each division for completion
    Object.entries(divisions).forEach(([divisionName, divisionData]) => {
      const achievementId = `division_${divisionName.toLowerCase().replace(/\s+/g, '_')}`;
      
      if (divisionData.completed && !this.achievements.has(achievementId)) {
        this.achievements.set(achievementId, {
          id: achievementId,
          type: 'announcement',
          title: `${divisionName} Division Complete`,
          description: `Worked all sections in ${divisionName} Division`,
          achieved: true,
          timestamp: Date.now()
        });

        // Get station designator for the announcement
        this.getStationDesignator().then(designator => {
          this.sendNotification('announcement', `${designator} just completed out ${divisionName} Division!`);
        });
      }
    });
  }

  private getDivisionProgress(sections: string[]) {
    const divisions = {
      'Dakota': ['CO', 'IA', 'KS', 'MN', 'MO', 'ND', 'NE', 'SD'],
      'New England': ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA'],
      'Hudson': ['ENY', 'NLI', 'NNJ', 'NNY', 'SNJ', 'WNY'],
      'Atlantic': ['DE', 'EPA', 'MDC', 'WPA'],
      'Southeastern': ['AL', 'GA', 'KY', 'NC', 'NFL', 'PR', 'SC', 'SFL', 'TN', 'VA', 'VI', 'WCF'],
      'West Gulf': ['AR', 'LA', 'MS', 'NM', 'NTX', 'OK', 'STX', 'WTX'],
      'Pacific': ['EB', 'LAX', 'ORG', 'PAC', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV'],
      'Northwestern': ['AK', 'AZ', 'EWA', 'ID', 'MT', 'NV', 'OR', 'UT', 'WWA', 'WY'],
      'Great Lakes': ['MI', 'OH'],
      'Central': ['IL', 'IN', 'WI'],
      'Canada': ['AB', 'BC', 'GTA', 'MAR', 'MB', 'NL', 'NT', 'ONE', 'ONN', 'ONS', 'QC', 'SK'],
      'DX': ['DX']
    };

    const progress: { [key: string]: { completed: boolean; worked: string[]; total: number } } = {};

    Object.entries(divisions).forEach(([name, divisionSections]) => {
      const workedSections = sections.filter(s => divisionSections.includes(s));
      progress[name] = {
        completed: workedSections.length === divisionSections.length,
        worked: workedSections,
        total: divisionSections.length
      };
    });

    return progress;
  }

  private async getStationDesignator(): Promise<string> {
    try {
      const config = await fileStorage.getStationConfig();
      return config.designator || 'STATION';
    } catch (error) {
      return 'STATION';
    }
  }

  private sendNotification(type: string, message: string) {
    
    if (this.messageCallback) {
      this.messageCallback(type, message);
    }
  }

  // Public method to get all achievements
  getAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  // Method to manually trigger achievement check
  async checkNow(): Promise<void> {
    await this.checkAchievements();
  }

  // Cleanup method
  destroy() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }
}

// Export singleton instance
export const achievementService = new AchievementService();
