/** 게임설명 오버레이 (메인 메뉴에서 열기). 탭: 게임 소개 / 뱃지 목록 */
import { t, formatBold } from "../i18n.js";
import { BADGES } from "../badges/badgeDefinitions.js";

const OVERLAY_ID = "guide-overlay";
const TITLE_ID = "guide-overlay-title";
const CLOSE_ID = "guide-overlay-close";
const TAB_INTRO_ID = "guide-tab-intro";
const TAB_BADGES_ID = "guide-tab-badges";
const CONTENT_INTRO_ID = "guide-content-intro";
const CONTENT_BADGES_ID = "guide-content-badges";

let bound = false;
/** 가이드가 열린 동안 메뉴 버튼 비활성화 해제용 (닫을 때 enableMenuButtons 호출) */
let menuSceneRef = null;

function getOverlay() {
  return document.getElementById(OVERLAY_ID);
}

function closeOverlay() {
  const overlay = getOverlay();
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
  }
  if (menuSceneRef && typeof menuSceneRef.enableMenuButtons === "function") {
    menuSceneRef.enableMenuButtons();
    menuSceneRef = null;
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderIntroContent(container) {
  if (!container) return;
  const story = escapeHtml(t("menu.guideStory"));
  const goal = escapeHtml(t("menu.guideGoal")).replace(/\n/g, "<br>");
  const controls = escapeHtml(t("menu.guideControls")).replace(/\n/g, "<br>");
  const combat = escapeHtml(t("menu.guideCombat")).replace(/\n/g, "<br>");
  const growth = escapeHtml(t("menu.guideGrowth")).replace(/\n/g, "<br>");
  container.innerHTML = `
    <p class="guide-story">${story}</p>
    <div class="guide-section">${goal}</div>
    <div class="guide-section">${controls}</div>
    <div class="guide-section">${combat}</div>
    <div class="guide-section">${growth}</div>
  `;
}

const RARITY_ORDER = ["normal", "epic", "unique"];
const RARITY_KEYS = { normal: "rarity.normal", epic: "rarity.epic", unique: "rarity.unique" };

function renderBadgeList(container) {
  if (!container) return;
  const byRarity = { unique: [], epic: [], normal: [] };
  for (const b of BADGES) {
    const r = b.rarity || "normal";
    if (byRarity[r]) byRarity[r].push(b);
  }
  let tabsHtml = '<div class="guide-rarity-tabs" id="guide-rarity-tabs">';
  let panelsHtml = '<div class="guide-rarity-panels">';
  for (const r of RARITY_ORDER) {
    const list = byRarity[r] || [];
    const label = t(RARITY_KEYS[r]);
    const activeClass = r === "normal" ? " active" : "";
    tabsHtml += `<button type="button" class="guide-rarity-tab${activeClass}" data-rarity="${r}">${label}</button>`;
    panelsHtml += `<div class="guide-rarity-panel${activeClass}" data-rarity="${r}"><ul class="guide-badge-list">`;
    for (const b of list) {
      const name = t(`badge.${b.id}.name`);
      const desc = formatBold(t(`badge.${b.id}.description`) || "");
      panelsHtml += `<li class="guide-badge-item"><span class="guide-badge-name">${name}</span><p class="guide-badge-desc">${desc}</p></li>`;
    }
    panelsHtml += "</ul></div>";
  }
  tabsHtml += "</div>";
  panelsHtml += "</div>";
  container.innerHTML = tabsHtml + panelsHtml;

  const rarityTabs = container.querySelectorAll(".guide-rarity-tab");
  const rarityPanels = container.querySelectorAll(".guide-rarity-panel");
  rarityTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const r = tab.getAttribute("data-rarity");
      rarityTabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-rarity") === r));
      rarityPanels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-rarity") === r));
    });
  });
}

function switchTab(tabName) {
  const introTab = document.getElementById(TAB_INTRO_ID);
  const badgesTab = document.getElementById(TAB_BADGES_ID);
  const introContent = document.getElementById(CONTENT_INTRO_ID);
  const badgesContent = document.getElementById(CONTENT_BADGES_ID);
  if (tabName === "intro") {
    introTab?.classList.add("active");
    badgesTab?.classList.remove("active");
    introContent?.classList.add("active");
    badgesContent?.classList.remove("active");
  } else {
    introTab?.classList.remove("active");
    badgesTab?.classList.add("active");
    introContent?.classList.remove("active");
    badgesContent?.classList.add("active");
  }
}

/**
 * @param {Phaser.Scene} [scene] - 메인메뉴 씬. 넘기면 오버레이가 떠 있는 동안 메뉴 버튼 비활성화.
 */
export function showGuideOverlay(scene) {
  const overlay = getOverlay();
  if (!overlay) return;

  if (scene && typeof scene.disableMenuButtons === "function") {
    menuSceneRef = scene;
    scene.disableMenuButtons();
  }

  const titleEl = document.getElementById(TITLE_ID);
  const closeBtn = document.getElementById(CLOSE_ID);
  const introContent = document.getElementById(CONTENT_INTRO_ID);
  const badgesContent = document.getElementById(CONTENT_BADGES_ID);

  if (titleEl) titleEl.textContent = t("menu.howToPlay");
  if (closeBtn) closeBtn.textContent = t("menu.howToPlayClose");

  const tabIntro = document.getElementById(TAB_INTRO_ID);
  const tabBadges = document.getElementById(TAB_BADGES_ID);
  if (tabIntro) tabIntro.textContent = t("menu.guideTabIntro");
  if (tabBadges) tabBadges.textContent = t("menu.guideTabBadges");

  renderIntroContent(introContent);
  renderBadgeList(badgesContent);
  switchTab("intro");

  if (!bound) {
    bound = true;
    closeBtn?.addEventListener("click", closeOverlay);
    overlay.querySelector(".guide-overlay-backdrop")?.addEventListener("click", closeOverlay);
    tabIntro?.addEventListener("click", () => switchTab("intro"));
    tabBadges?.addEventListener("click", () => switchTab("badges"));
  }

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
}
