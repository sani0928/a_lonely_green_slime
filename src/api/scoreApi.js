/** ?ìˆ˜ ?œì¶œÂ·ë¦¬ë”ë³´ë“œ API */
const API_BASE_URL =
  window.GAME_API_BASE_URL || "http://localhost:8000";
const ANONYMOUS_ID_KEY = "als_anonymous_id";
const ANONYMOUS_SEQ_KEY = "als_anonymous_seq";
const RUN_SEQ_KEY = "als_run_seq";

function toPositiveInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function makeAnonymousId() {
  try {
    const seq = toPositiveInt(localStorage.getItem(ANONYMOUS_SEQ_KEY), 0) + 1;
    localStorage.setItem(ANONYMOUS_SEQ_KEY, String(seq));
    return `anon_${seq}`;
  } catch (_) {
    return `anon_${Date.now()}`;
  }
}

export function getOrCreateAnonymousId() {
  try {
    const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const generated = makeAnonymousId();
    localStorage.setItem(ANONYMOUS_ID_KEY, generated);
    return generated;
  } catch (_) {
    return makeAnonymousId();
  }
}

export function getNextRunId() {
  try {
    const seq = toPositiveInt(localStorage.getItem(RUN_SEQ_KEY), 0) + 1;
    localStorage.setItem(RUN_SEQ_KEY, String(seq));
    return `run_${seq}`;
  } catch (_) {
    return `run_${Date.now()}`;
  }
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
      data && data.detail ? data.detail : "?ìˆ˜ ?±ë¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.";
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
    const message = data?.detail || "?¼ë“œë°??„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.";
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
    const message = data?.detail || "?Œë ˆ??ë¡œê·¸ ?„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤.";
    throw new Error(message);
  }
  return response.json();
}


