import { useState } from 'react';
import { PALETTE } from '../utils/colorUtils.js';

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

function generateUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'user-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildIdentity() {
  let userId = localStorage.getItem('cb_userId');
  let displayName = localStorage.getItem('cb_displayName');
  let userColor = localStorage.getItem('cb_userColor');

  if (!userId) {
    userId = generateUserId();
    localStorage.setItem('cb_userId', userId);
  }
  if (!displayName) {
    const number = Math.floor(Math.random() * 90) + 10; // two-digit 10-99
    displayName = `${pick(ADJECTIVES)}${pick(ANIMALS)}${number}`;
    localStorage.setItem('cb_displayName', displayName);
  }
  if (!userColor) {
    userColor = pick(PALETTE);
    localStorage.setItem('cb_userColor', userColor);
  }

  return { userId, displayName, userColor };
}

export default function useUserIdentity() {
  const [identity] = useState(buildIdentity);
  return identity;
}
