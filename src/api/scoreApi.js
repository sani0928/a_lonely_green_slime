/** Score/leaderboard API helpers */
const API_BASE_URL =
  window.GAME_API_BASE_URL || "http://localhost:8000";

const ANONYMOUS_ID_KEY = "als_anonymous_id";
const LEGACY_ANONYMOUS_SEQ_KEY = "als_anonymous_seq";
const LEGACY_RUN_SEQ_KEY = "als_run_seq";

function makeUniqueId(prefix) {
  try {
    if (typeof crypto !== "undefined" && crypto && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch (_) {
    // Fallback below
  }

  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `${prefix}_${ts}_${rand}`;
}

function makeAnonymousId() {
  return makeUniqueId("anon");
}

function isLegacyAnonymousId(value) {
  return /^anon_\d+$/.test(String(value || ""));
}

export function getOrCreateAnonymousId() {
  try {
    const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing && !isLegacyAnonymousId(existing)) return existing;

    const generated = makeAnonymousId();
    localStorage.setItem(ANONYMOUS_ID_KEY, generated);
    localStorage.removeItem(LEGACY_ANONYMOUS_SEQ_KEY);
    return generated;
  } catch (_) {
    return makeAnonymousId();
  }
}

export function getNextRunId() {
  try {
    localStorage.removeItem(LEGACY_RUN_SEQ_KEY);
  } catch (_) {
    // ignore
  }
  return makeUniqueId("run");
}

export async function submitScore(nickname, score) {
  const url = `${API_BASE_URL}/api/scores/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname, score }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data && data.detail ? data.detail : "Failed to submit score.";
    throw new Error(message);
  }

  return response.json();
}

export async function fetchLeaderboard(limit = 20, period = "30d") {
  const params = new URLSearchParams({ limit: String(limit), period });
  const url = `${API_BASE_URL}/api/scores/?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Leaderboard request failed");
  }

  const data = await response.json().catch(async () => {
    const fallbackText = await response.text().catch(() => "");
    throw new Error(
      `Invalid leaderboard response format. status=${response.status} body=${fallbackText.slice(0, 120)}`
    );
  });

  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function submitFeedback(content) {
  const response = await fetch(`${API_BASE_URL}/api/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.detail || "Failed to send feedback.";
    throw new Error(message);
  }
  return response.json();
}

export async function submitPlayLog(payload) {
  const response = await fetch(`${API_BASE_URL}/api/playlogs/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.detail || "Failed to submit playlog.";
    throw new Error(message);
  }
  return response.json();
}
