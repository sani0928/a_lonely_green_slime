/** Deterministic random stream for server-issued event seeds. */
export function createSeededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed ?? "")) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomFrom(scene) {
  return typeof scene?.random === "function" ? scene.random : Math.random;
}

export function randomInt(scene, min, max) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return lower + Math.floor(randomFrom(scene)() * (upper - lower + 1));
}
