// An original sorcerer borrows one existing combat kit, never a character model.
export const TECHNIQUES = ['yuji', 'sukuna', 'gojo', 'megumi'];
export const SKINS = ['#f0c8a0', '#c99470', '#855b47', '#f1d4bd'];
export const HAIRS = ['#222230', '#6b4438', '#d7d9e7', '#813e48'];
export const UNIFORMS = ['#232a3a', '#35242f', '#26382f', '#30304a'];
export const STYLES = ['spiky', 'wild', 'buzz'];
export function sorcererLook(appearance = {}) {
  const skin = SKINS[appearance.skin] || SKINS[0];
  const hair = HAIRS[appearance.hair] || HAIRS[0];
  const top = UNIFORMS[appearance.uniform] || UNIFORMS[0];
  return { skin, hair, hairStyle: STYLES[appearance.style] || STYLES[0], top,
    topDark: '#151923', topLight: '#465166', bottom: '#1c2230', bottomDark: '#141926',
    accent: '#8fa8e8', eye: '#f7f7f7', weapon: 'none' };
}
export function createSorcerer(name, appearance, random = Math.random) {
  const technique = TECHNIQUES[Math.min(TECHNIQUES.length - 1, Math.floor(random() * TECHNIQUES.length))];
  return { name: String(name || '').trim().slice(0, 20) || 'Sorcerer', appearance, technique, unlocked: 2, trainingWins: 0, mastery: 0 };
}
