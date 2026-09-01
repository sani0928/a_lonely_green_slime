import { acceptEventConsent, completeEventSignup, createEventEntry, getEventLeaderboard, getEventStatus, googleEventLogin } from "../api/eventApi.js";

let overlay;

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "event-overlay";
  overlay.className = "guide-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="guide-overlay-backdrop"></div>
    <div class="guide-overlay-panel event-overlay-panel">
      <h2 class="guide-overlay-title">Weekly Ranking Event</h2>
      <p id="event-status-text" class="overlay-score"></p>
      <div id="event-signup-row" class="field-row" hidden><input id="event-nickname-input" maxlength="32" placeholder="Event nickname (cannot be changed)" /><button id="event-signup-btn" class="primary-btn">Create</button></div>
      <label id="event-consent-row" class="event-consent-row" hidden><input id="event-consent" type="checkbox" /> I agree: runs last up to 60 minutes, only verified server records count, and prize email is used only for delivery.</label>
      <div class="event-overlay-actions"><button id="event-login-btn" class="primary-btn">Sign in with Google</button><button id="event-play-btn" class="primary-btn" hidden>Enter event</button><button id="event-close-btn" class="secondary-btn">Close</button></div>
      <div class="event-board-grid"><section><h3>Highest score</h3><ol id="event-high-score-list"></ol></section><section><h3>Total score</h3><ol id="event-aggregate-list"></ol></section></div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function rows(target, data) {
  target.replaceChildren();
  for (const row of data || []) {
    const item = document.createElement("li");
    item.textContent = `${row.nickname} - ${row.score.toLocaleString()}`;
    target.appendChild(item);
  }
  if (!target.children.length) target.textContent = "No verified records yet.";
}

export async function showEventOverlay(scene) {
  const el = ensureOverlay();
  const statusText = el.querySelector("#event-status-text");
  const loginBtn = el.querySelector("#event-login-btn");
  const playBtn = el.querySelector("#event-play-btn");
  const closeBtn = el.querySelector("#event-close-btn");
  const signupRow = el.querySelector("#event-signup-row");
  const signupInput = el.querySelector("#event-nickname-input");
  const signupBtn = el.querySelector("#event-signup-btn");
  const consentRow = el.querySelector("#event-consent-row");
  const consent = el.querySelector("#event-consent");
  const close = () => { el.classList.remove("visible"); el.setAttribute("aria-hidden", "true"); scene?.enableMenuButtons?.(); };
  el.querySelector(".guide-overlay-backdrop").onclick = close;
  closeBtn.onclick = close;
  loginBtn.onclick = () => googleEventLogin();
  signupBtn.onclick = async () => {
    try { await completeEventSignup(signupInput.value.trim()); window.location.assign("/"); } catch (error) { statusText.textContent = error.message; }
  };
  playBtn.onclick = async () => {
    try {
      if (!consent.checked) { statusText.textContent = "You must accept the event rules."; return; }
      await acceptEventConsent();
      const entry = await createEventEntry();
      close();
      scene?.startEventGame?.(entry);
    } catch (error) { statusText.textContent = error.message; }
  };
  scene?.disableMenuButtons?.();
  el.classList.add("visible");
  el.setAttribute("aria-hidden", "false");
  try {
    const [status, leaderboard] = await Promise.all([getEventStatus(), getEventLeaderboard()]);
    rows(el.querySelector("#event-high-score-list"), leaderboard.high_score);
    rows(el.querySelector("#event-aggregate-list"), leaderboard.aggregate);
    signupRow.hidden = !status.signup_required;
    consentRow.hidden = !status.authenticated || status.signup_required || status.status !== "open";
    loginBtn.hidden = status.authenticated || status.signup_required;
    playBtn.hidden = !status.authenticated || status.signup_required || status.status !== "open";
    if (status.status === "maintenance") statusText.textContent = "Weekly maintenance: Sunday 00:00-05:59 (KST).";
    else if (status.status !== "open") statusText.textContent = "The event is closed.";
    else statusText.textContent = `Event ends ${new Date(status.ends_at).toLocaleString()}. A run can last up to 60 minutes.`;
  } catch (error) {
    statusText.textContent = error.message;
    loginBtn.hidden = true;
    playBtn.hidden = true;
  }
}
