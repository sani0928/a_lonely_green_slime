import { acceptEventConsent, completeEventSignup, createEventEntry, getEventLeaderboard, getEventStatus, googleEventLogin } from "../api/eventApi.js";
import { getLocale, t } from "../i18n.js";

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
      <h2 id="event-title" class="guide-overlay-title"></h2>
      <p id="event-status-text" class="overlay-score"></p>
      <div id="event-signup-row" class="field-row" hidden><input id="event-nickname-input" maxlength="32" /><button id="event-signup-btn" class="primary-btn"></button></div>
      <label id="event-consent-row" class="event-consent-row" hidden><input id="event-consent" type="checkbox" /><span id="event-consent-label"></span></label>
      <div class="event-overlay-actions"><button id="event-login-btn" class="primary-btn"></button><button id="event-play-btn" class="primary-btn" hidden></button><button id="event-close-btn" class="secondary-btn"></button></div>
      <div class="event-board-grid"><section><h3 id="event-high-score-title"></h3><ol id="event-high-score-list"></ol></section><section><h3 id="event-aggregate-title"></h3><ol id="event-aggregate-list"></ol></section></div>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function rows(target, data) {
  target.replaceChildren();
  for (const row of data || []) {
    const item = document.createElement("li");
    item.textContent = `${row.nickname} - ${row.score.toLocaleString(getLocale())}`;
    target.appendChild(item);
  }
  if (!target.children.length) target.textContent = t("event.noVerifiedRecords");
}

function applyTranslations(el) {
  el.querySelector("#event-title").textContent = t("event.title");
  el.querySelector("#event-nickname-input").placeholder = t("event.nicknamePlaceholder");
  el.querySelector("#event-signup-btn").textContent = t("event.createNickname");
  el.querySelector("#event-consent-label").textContent = t("event.consent");
  el.querySelector("#event-login-btn").textContent = t("event.googleLogin");
  el.querySelector("#event-play-btn").textContent = t("event.enter");
  el.querySelector("#event-close-btn").textContent = t("common.close");
  el.querySelector("#event-high-score-title").textContent = t("event.highestScore");
  el.querySelector("#event-aggregate-title").textContent = t("event.totalScore");
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
  applyTranslations(el);
  const close = () => { el.classList.remove("visible"); el.setAttribute("aria-hidden", "true"); scene?.enableMenuButtons?.(); };
  el.querySelector(".guide-overlay-backdrop").onclick = close;
  closeBtn.onclick = close;
  loginBtn.onclick = () => googleEventLogin();
  signupBtn.onclick = async () => {
    try { await completeEventSignup(signupInput.value.trim()); window.location.assign("/"); } catch (error) { statusText.textContent = t("event.requestFailed"); }
  };
  playBtn.onclick = async () => {
    try {
      if (!consent.checked) { statusText.textContent = t("event.consentRequired"); return; }
      await acceptEventConsent();
      const entry = await createEventEntry();
      close();
      scene?.startEventGame?.(entry);
    } catch (error) { statusText.textContent = t("event.requestFailed"); }
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
    if (status.status === "maintenance") statusText.textContent = t("event.maintenance");
    else if (status.status !== "open") statusText.textContent = t("event.closed");
    else {
      const locale = getLocale() === "ko" ? "ko-KR" : "en-US";
      const endsAt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.ends_at));
      statusText.textContent = t("event.endsAt", { endsAt });
    }
  } catch (error) {
    statusText.textContent = t("event.requestFailed");
    loginBtn.hidden = true;
    playBtn.hidden = true;
  }
}
