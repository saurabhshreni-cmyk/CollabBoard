export const PALETTE = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#F8B500',
  '#98D8C8',
];

export function getRandomColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

// Deterministically map a userId string to one of the palette colors so the
// same user always renders with the same color across clients.
export function getUserColor(userId) {
  if (!userId) {
    return PALETTE[0];
  }
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}
