/**
 * Key-based i18n: load locale JSON, t(key, params), formatBold for DOM.
 * Locale: localStorage > navigator.language > "en".
 */

const SUPPORTED_LOCALES = ["en", "ko"];
const SETTINGS_STORAGE_KEY = "A_lonely_green_slime_settings";

let currentLocale = "en";
let messages = {};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    return obj && typeof obj === "object" ? obj : {};
  } catch (_) {
    return {};
  }
}

/**
 * @param {string} key
 * @param {string|number|boolean} value
 */
export function setSetting(key, value) {
  try {
    const settings = getSettings();
    settings[key] = value;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
}

/** 타격음 설정값(1|2|3)에 해당하는 사운드 키. 기본값 1. (문자열 "1"/"2"/"3"도 허용) */
export function getSfxAttackKey() {
  const v = getSettings().sfx_attack;
  const n = Number(v);
  const valid = n === 1 || n === 2 || n === 3 ? n : 1;
  return `sfx_attack_${valid}`;
}

function getStoredLocale() {
  const lang = getSettings().language;
  if (lang && SUPPORTED_LOCALES.includes(lang)) return lang;
  return null;
}

/**
 * Detect locale: stored > browser > "en".
 * @returns {string} "en" | "ko"
 */
export function detectLocale() {
  const stored = getStoredLocale();
  if (stored) return stored;

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const lang = nav && (nav.language || (nav.languages && nav.languages[0]));
  const tag = typeof lang === "string" ? lang.slice(0, 2).toLowerCase() : "";

  if (tag === "ko") return "ko";
  if (tag === "en") return "en";
  return "en";
}

/**
 * @returns {string} Current locale code.
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Load messages for a locale and set as current.
 * @param {string} locale "en" | "ko"
 * @returns {Promise<void>}
 */
export function setLocale(locale) {
  const safe = SUPPORTED_LOCALES.includes(locale) ? locale : "en";
  currentLocale = safe;
  try {
    const settings = getSettings();
    settings.language = safe;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}

  const path = new URL(`./locales/${safe}.json`, import.meta.url).href;
  return fetch(path)
    .then((r) => {
      if (!r.ok) throw new Error(`i18n load failed: ${r.status}`);
      return r.json();
    })
    .then((data) => {
      messages = data || {};
    })
    .catch((err) => {
      console.warn("[i18n] load failed, using empty messages", err);
      messages = {};
    });
}

/**
 * Get message by dot-key; replace {{param}} with params.
 * @param {string} key e.g. "common.score"
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function t(key, params = {}) {
  const parts = key.split(".");
  let value = messages;
  for (const part of parts) {
    value = value != null && typeof value === "object" ? value[part] : undefined;
  }
  let str = typeof value === "string" ? value : key;

  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
  }
  return str;
}

/**
 * Escape HTML for safe insertion, then turn **text** into <strong>text</strong>.
 * Use for DOM innerHTML where content comes from locale JSON.
 * @param {string} str
 * @returns {string} HTML snippet (only ** and entities escaped)
 */
export function formatBold(str) {
  if (typeof str !== "string") return "";
  const escaped = str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
