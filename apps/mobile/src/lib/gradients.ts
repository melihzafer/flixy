/**
 * Generate a deterministic gradient for a title based on its ID.
 * Returns an array of [color1, color2, color3, color4] for expo-linear-gradient.
 * Matches the aesthetic of the HTML prototype's card backgrounds.
 */
export function getTitleGradient(titleId: string): readonly [string, string, string, string] {
  // Hash the UUID string to a number
  let hash = 0;
  for (let i = 0; i < titleId.length; i++) {
    hash = titleId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash);

  // Preset palettes that rotate
  const fallback: readonly [string, string, string, string] = [
    '#1c1c2e',
    '#2d1b00',
    '#4a2800',
    '#ff7000',
  ];
  const palettes: Array<readonly [string, string, string, string]> = [
    ['#1c1c2e', '#2d1b00', '#4a2800', '#ff7000'],
    ['#200606', '#3d0000', '#600808', '#c0003a'],
    ['#0a1a0a', '#1a2d1a', '#406050', '#80b090'],
    ['#0a0f1a', '#1a2040', '#204080', '#4080c0'],
    ['#1a150a', '#2d2510', '#604000', '#d4920a'],
    ['#1a0f00', '#2d1f00', '#802010', '#c03020'],
    ['#0f0f00', '#1f1f05', '#205040', '#40a050'],
    ['#0d0a1a', '#1a1230', '#600808', '#a02010'],
    ['#0a1510', '#152015', '#1a3550', '#c04080'],
    ['#00050f', '#001020', '#101040', '#4080c0'],
    ['#001a1a', '#003333', '#1a3020', '#80b090'],
    ['#050505', '#111111', '#1f1f05', '#604000'],
  ];

  const idx = h % palettes.length;
  return palettes[idx] ?? fallback;
}
