import { fetchLeaderboard } from "../api/scoreApi.js";
import { t } from "../i18n.js";
import { formatPlaySecondsForLeaderboard } from "../utils/timeFormat.js";

const OVERLAY_ID = "leaderboard-overlay";
const LIST_ID = "leaderboard-overlay-list";
const PERIOD_ID = "leaderboard-overlay-period";
const CLOSE_ID = "leaderboard-overlay-close";
const TITLE_ID = "leaderboard-overlay-title";

let initialized = false;
let currentPeriod = "30d";
let activeScene = null;

function getOverlay() {
  return document.getElementById(OVERLAY_ID);
}

function setPeriodButtonState() {
  const periodContainer = document.getElementById(PERIOD_ID);
  if (!periodContainer) return;
  periodContainer.querySelectorAll(".period-btn[data-period]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-period") === currentPeriod);
  });
}

function renderLeaderboardRows(list, items) {
  list.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "status-text";
    empty.textContent = t("overlay.noScoresYet");
    list.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-item";

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;

    const name = document.createElement("span");
    name.className =
      "leaderboard-name" +
      (index === 0
        ? " leaderboard-name--gold"
        : index === 1
          ? " leaderboard-name--silver"
          : index === 2
            ? " leaderboard-name--bronze"
            : "");
    const playTimeText = formatPlaySecondsForLeaderboard(item.play_seconds);
    const nameText = document.createElement("span");
    nameText.className = "leaderboard-name-text";
    nameText.textContent = item.nickname || "";
    name.appendChild(nameText);
    if (playTimeText) {
      const timeText = document.createElement("span");
      timeText.className = "leaderboard-play-time";
      timeText.textContent = playTimeText;
      name.appendChild(timeText);
    }

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = String(item.score ?? 0);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(score);
    list.appendChild(row);
  });
}

async function refreshLeaderboard() {
  const list = document.getElementById(LIST_ID);
  if (!list) return;

  list.innerHTML = `<div class="status-text">${t("overlay.loadingLeaderboard")}</div>`;
  try {
    const items = await fetchLeaderboard(20, currentPeriod);
    renderLeaderboardRows(list, items);
  } catch (_) {
    const errEl = document.createElement("div");
    errEl.className = "status-text error";
    errEl.textContent = t("overlay.leaderboardFailed");
    list.innerHTML = "";
    list.appendChild(errEl);
  }
}

function refreshTexts() {
  const title = document.getElementById(TITLE_ID);
  if (title) title.textContent = t("overlay.topPlayers");

  const closeBtn = document.getElementById(CLOSE_ID);
  if (closeBtn) closeBtn.textContent = t("common.close");

  const periodContainer = document.getElementById(PERIOD_ID);
  if (periodContainer) {
    periodContainer.querySelectorAll(".period-btn[data-period]").forEach((btn) => {
      const period = btn.getAttribute("data-period");
      if (period === "7d") btn.textContent = t("overlay.period7d");
      else if (period === "30d") btn.textContent = t("overlay.period30d");
      else if (period === "1y") btn.textContent = t("overlay.period1y");
    });
  }
}

function closeOverlay() {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.classList.remove("visible");
  overlay.setAttribute("aria-hidden", "true");
  if (activeScene && typeof activeScene.enableMenuButtons === "function") {
    activeScene.enableMenuButtons();
  }
  activeScene = null;
}

function initOnce() {
  if (initialized) return;
  initialized = true;

  const overlay = getOverlay();
  const closeBtn = document.getElementById(CLOSE_ID);
  const periodContainer = document.getElementById(PERIOD_ID);

  closeBtn?.addEventListener("click", closeOverlay);
  overlay?.querySelector(".leaderboard-overlay-backdrop")?.addEventListener("click", closeOverlay);

  periodContainer?.querySelectorAll(".period-btn[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = btn.getAttribute("data-period");
      if (!period) return;
      currentPeriod = period;
      setPeriodButtonState();
      refreshLeaderboard();
    });
  });
}

export function showLeaderboardOverlay(scene = null) {
  const overlay = getOverlay();
  if (!overlay) return;

  initOnce();
  activeScene = scene;
  if (activeScene && typeof activeScene.disableMenuButtons === "function") {
    activeScene.disableMenuButtons();
  }
  refreshTexts();
  setPeriodButtonState();
  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  refreshLeaderboard();
}
