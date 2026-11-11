import { useState } from 'react';
import { PALETTE } from '../utils/colorUtils.js';
import { generateId } from '../utils/drawingUtils.js';

const ADJECTIVES = [
  'Blue', 'Red', 'Green', 'Swift', 'Brave', 'Clever', 'Bold', 'Happy',
  'Cool', 'Wild', 'Dark', 'Bright', 'Sharp', 'Calm', 'Quick', 'Proud',
  'Wise', 'Fierce', 'Warm', 'Neat',
];

const ANIMALS = [
  'Tiger', 'Wolf', 'Eagle', 'Fox', 'Bear', 'Shark', 'Lion', 'Hawk',
  'Panda', 'Lynx', 'Deer', 'Raven', 'Otter', 'Moose', 'Cobra', 'Viper',
  'Crane', 'Bison', 'Gecko', 'Finch',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Storage can be unavailable (private mode, blocked cookies). The board must
// still work; the person just gets a fresh identity on each visit.
function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; nothing else to do.
  }
}

function stored(key, create) {
  const existing = readStored(key);
  if (existing) return existing;
  const value = create();
  writeStored(key, value);
  return value;
}

function buildIdentity() {
  return {
    // Who the person is: shared by every tab in this browser.
    userId: stored('cb_userId', generateId),
    displayName: stored(
      'cb_displayName',
      () => `${pick(ADJECTIVES)}${pick(ANIMALS)}${Math.floor(Math.random() * 90) + 10}`
    ),
    userColor: stored('cb_userColor', () => pick(PALETTE)),
    // Which tab this is: unique per page load, never stored. Two tabs of the
    // same person must be able to tell each other's changes from their own.
    clientId: generateId(),
  };
}

/** @returns {{ userId: string, displayName: string, userColor: string, clientId: string }} */
export default function useUserIdentity() {
  const [identity] = useState(buildIdentity);
  return identity;
}
