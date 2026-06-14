import { describe, expect, it } from 'vitest';
import {
  ARRL_DIVISIONS,
  ARRL_SECTIONS,
  getLoggedCount,
  isLogged,
  getDivisionBySection,
  getDivisionProgress,
  getLoggedSectionsCount,
  getTotalSections,
  isDivisionComplete,
  normalizeArrlClass,
  normalizeArrlSection,
  validateArrlClass,
  validateArrlSection,
} from '@/constants/arrl-sections';

describe('ARRL helper coverage', () => {
  it('validates and normalizes section identifiers', () => {
    expect(validateArrlSection('ct')).to.equal(true);
    expect(validateArrlSection('DX')).to.equal(true);
    expect(validateArrlSection('invalid')).to.equal(false);
    expect(normalizeArrlSection(' ema ')).to.equal('EMA');
    expect(normalizeArrlSection('invalid')).to.equal(null);
  });

  it('finds the correct division for a section', () => {
    expect(getDivisionBySection('CT')).to.equal('Section 1');
    expect(getDivisionBySection('AL')).to.equal('Section 4');
    expect(getDivisionBySection('ZZ')).to.equal(null);
  });

  it('reports division completion progress', () => {
    const workedSections = [...ARRL_DIVISIONS['Section 1'].sections];
    const progress = getDivisionProgress(workedSections);

    expect(progress['Section 1'].completed).to.equal(true);
    expect(progress['Section 1'].worked).to.deep.equal(workedSections);
    expect(progress['Section 1'].total).to.equal(ARRL_DIVISIONS['Section 1'].sections.length);
    expect(progress['Section 2'].completed).to.equal(false);
  });

  it('counts only valid logged sections', () => {
    expect(getLoggedSectionsCount(['CT', 'EMA', 'DX', 'MX', 'ZZ'])).to.equal(2);
    expect(getLoggedCount(['CT', 'CT', 'MA', 'ZZ'], [{ section: 'CT' }, { section: 'MA' }])).to.equal(3);
    expect(isLogged('CT', [{ section: 'CT' }, { section: 'MA' }])).to.equal(true);
    expect(isLogged('EMA', [{ section: 'CT' }, { section: 'MA' }])).to.equal(false);
    expect(getTotalSections()).to.equal(ARRL_SECTIONS.length - 2);
  });

  it('recognizes complete divisions and class formats', () => {
    expect(isDivisionComplete('Section 1', ARRL_DIVISIONS['Section 1'].sections)).to.equal(true);
    expect(isDivisionComplete('Section 1', ['CT', 'ME'])).to.equal(false);
    expect(validateArrlClass('1A')).to.equal(true);
    expect(validateArrlClass('12h')).to.equal(true);
    expect(validateArrlClass('0A')).to.equal(false);
    expect(normalizeArrlClass(' 12h ')).to.equal('12H');
    expect(normalizeArrlClass('bad')).to.equal(null);
  });
});
