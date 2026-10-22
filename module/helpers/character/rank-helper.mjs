/**
 * Get the image path for a given rank
 * @param {number} rank - The rank number (1-8)
 * @returns {string} Path to the rank image
 */
export function getRankImage(rank) {
  const clampedRank = Math.max(1, Math.min(8, rank || 1));
  return `systems/deathwatch/icons/ranks/rank-${clampedRank}.webp`;
}
