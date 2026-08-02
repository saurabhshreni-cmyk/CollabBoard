import { describe, it, expect } from 'vitest';
import { PALETTE, getRandomColor, getUserColor } from './colorUtils.js';

describe('PALETTE', () => {
  it('contains eight valid hex colours', () => {
    expect(PALETTE).toHaveLength(8);
    PALETTE.forEach((c) => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
  });
});

describe('getRandomColor', () => {
  it('always returns a palette colour', () => {
    for (let i = 0; i < 50; i++) {
      expect(PALETTE).toContain(getRandomColor());
    }
  });
});

describe('getUserColor', () => {
  it('is deterministic for the same id', () => {
    const id = 'a1b2c3d4-e5f6';
    expect(getUserColor(id)).toBe(getUserColor(id));
  });

  it('always returns a palette colour', () => {
    ['abc', 'zzz', '', 'user-1', '9f8e7d6c'].forEach((id) => {
      expect(PALETTE).toContain(getUserColor(id));
    });
  });

  it('falls back to the first colour for missing ids', () => {
    expect(getUserColor(null)).toBe(PALETTE[0]);
    expect(getUserColor(undefined)).toBe(PALETTE[0]);
    expect(getUserColor('')).toBe(PALETTE[0]);
  });

  it('spreads different ids across more than one colour', () => {
    const seen = new Set();
    for (let i = 0; i < 100; i++) seen.add(getUserColor(`user-${i}`));
    expect(seen.size).toBeGreaterThan(1);
  });
});
