import { describe, expect, it } from 'vitest';
import {
  ARRL_SECTIONS,
  getDivisionBySection,
  getDivisionProgress,
  getLoggedCount,
  getLoggedSectionsCount,
  getTotalSections,
  isDivisionComplete,
  isLogged,
  normalizeArrlClass,
  normalizeArrlSection,
  validateArrlClass,
  validateArrlSection
} from '@/constants/arrl-sections';

describe('ARRL section helpers', () => {
  it('resolves sections to the expected division', () => {
    expect(getDivisionBySection('CT')).to.equal('Section 1');
    expect(getDivisionBySection('ONN')).to.equal('Canada');
    expect(getDivisionBySection('DX')).to.equal('DX');
    expect(getDivisionBySection('ZZ')).to.equal(null);
  });

  it('computes division progress and completion status', () => {
    const progress = getDivisionProgress(['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA', 'DX']);

    expect(progress['Section 1'].completed).to.equal(true);
    expect(progress['Section 1'].worked).to.deep.equal(['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA']);
    expect(progress['Section 1'].total).to.equal(7);
    expect(progress['Section 0'].completed).to.equal(false);
    expect(progress.DX.total).to.equal(2);
  });

  it('counts total valid sections and ignores DX', () => {
    expect(getTotalSections()).to.equal(85);
  });

  it('detects complete and incomplete divisions', () => {
    expect(isDivisionComplete('Section 1', ['CT', 'EMA', 'ME', 'NH', 'RI', 'VT', 'WMA'])).to.equal(true);
    expect(isDivisionComplete('Section 1', ['CT', 'EMA'])).to.equal(false);
    expect(isDivisionComplete('Missing Division', ['CT'])).to.equal(false);
  });

  it('normalizes and validates ARRL sections', () => {
    expect(validateArrlSection(' ct ')).to.equal(true);
    expect(validateArrlSection('zz')).to.equal(false);
    expect(normalizeArrlSection(' ema ')).to.equal('EMA');
    expect(normalizeArrlSection('unknown')).to.equal(null);
  });

  it('normalizes and validates ARRL class values', () => {
    expect(validateArrlClass('1a')).to.equal(true);
    expect(validateArrlClass('12m')).to.equal(true);
    expect(validateArrlClass('0A')).to.equal(false);
    expect(validateArrlClass('1000A')).to.equal(false);
    expect(normalizeArrlClass(' 2b ')).to.equal('2B');
    expect(normalizeArrlClass('bad')).to.equal(null);
  });

  it('counts logged sections and detects logged entries', () => {
    const qsos = [{ section: 'CT' }, { section: 'EMA' }, { section: 'DX' }, { section: 'MX' }];

    expect(getLoggedSectionsCount(['CT', 'EMA', 'DX', 'MX', 'ZZ'])).to.equal(2);
    expect(getLoggedCount(['CT', 'EMA', 'ME', 'ZZ'], qsos)).to.equal(2);
    expect(isLogged('CT', qsos)).to.equal(true);
    expect(isLogged('RI', qsos)).to.equal(false);
  });

  it('exposes the full section list without duplicates in length expectations', () => {
    expect(ARRL_SECTIONS).to.include('CT');
    expect(ARRL_SECTIONS).to.include('ONN');
    expect(ARRL_SECTIONS).to.include('DX');
    expect(ARRL_SECTIONS.length).to.equal(87);
  });
});