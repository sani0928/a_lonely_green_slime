const API_BASE_URL = window.GAME_API_BASE_URL || "http://localhost:8000";

function csrfToken() {
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("csrftoken="));
  return item ? decodeURIComponent(item.slice("csrftoken=".length)) : "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken(), ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Event request failed.");
  return data;
}

export const getEventStatus = () => request("/api/events/current/", { method: "GET" });
export const getEventLeaderboard = () => request("/api/events/leaderboard/", { method: "GET" });
export const acceptEventConsent = () => request("/api/events/consent/", { method: "POST", body: "{}" });
export const createEventEntry = () => request("/api/events/entry/", { method: "POST", body: "{}" });
export const completeEventSignup = (nickname) => request("/auth/signup/", { method: "POST", body: JSON.stringify({ nickname }) });
export const googleEventLogin = () => { window.location.assign(`${API_BASE_URL}/auth/google/login/?next=/`); };
