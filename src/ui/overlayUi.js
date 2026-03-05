/** 게임오버/업그레이드/일시정지 등 DOM 오버레이 콜백 */
import { submitScore, fetchLeaderboard, submitFeedback } from "../api/scoreApi.js";
import { renderBadgeSlots } from "./badgeSlotsUi.js";
import { BADGES } from "../badges/badgeDefinitions.js";
import { t, formatBold } from "../i18n.js";
import { getDashboardStatsForOverlay } from "../systems/hudSystem.js";
import { getNicknameForSubmit } from "./nicknameOverlay.js";
import {
  applyBgmEnabled,
  getBgmEnabled,
  getBgmToggleLabel,
  resumeAudioContext,
} from "../systems/bgmSystem.js";

let overlayTextsRefreshFn = null;

/**
 * 언어 변경 시 게임오버·리더보드·피드백·일시정지·확인 다이얼로그 등 모든 오버레이 문구를 다시 그립니다.
 * 설정에서 언어를 바꾼 뒤 호출하면 새로고침 없이 적용됩니다.
 */
export function refreshOverlayTexts() {
  if (typeof overlayTextsRefreshFn === "function") overlayTextsRefreshFn();
}

export function setupOverlayCallbacks(phaserGame) {
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay
    ? overlay.querySelector(".overlay-title")
    : null;
  const scoreText = document.getElementById("overlay-score-text");
  const scoreMultiplier = document.getElementById("overlay-score-multiplier");
  const nicknameValue = document.getElementById("overlay-nickname-value");
  const statusText = document.getElementById("status-text");
  const overlayMainBtn = document.getElementById("overlay-main-btn");
  const restartBtn = document.getElementById("restart-btn");
  const leaderboardList = document.getElementById("leaderboard-list");
  const leaderboardPeriodContainer = document.getElementById("leaderboard-period");
  const feedbackOpenBtn = document.getElementById("feedback-open-btn");
  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackModalText = document.getElementById("feedback-modal-text");
  const feedbackModalSubmit = document.getElementById("feedback-modal-submit");
  const feedbackModalClose = document.getElementById("feedback-modal-close");
  const feedbackModalHeader = document.getElementById("feedback-modal-header");
  let currentLeaderboardPeriod = "30d";
  /** 게임 오버 오버레이에 표시한 최종 점수 — 제출 시 이 값을 사용해 화면·DB 불일치 방지 */
  let lastGameOverScore = 0;
  const upgradeOverlay = document.getElementById("upgrade-overlay");
  const upgradeBadgeSlotsContainer = document.getElementById("upgrade-badge-slots");
  const upgradeOptionsContainer = document.getElementById("upgrade-options");
  const upgradeDescription = document.getElementById("upgrade-description");
  const upgradeTitle = upgradeOverlay
    ? upgradeOverlay.querySelector(".overlay-title")
    : null;
  const upgradeSubtitle = upgradeOverlay
    ? upgradeOverlay.querySelector(".overlay-score")
    : null;
  const pauseOverlay = document.getElementById("pause-overlay");
  const pauseBadgeSlotsContainer = document.getElementById("pause-badge-slots");
  const pauseBtnMain = document.getElementById("pause-btn-main");
  const pauseBtnQuit = document.getElementById("pause-btn-quit");
  const pauseBtnBgm = document.getElementById("pause-btn-bgm");
  const pauseConfirmEl = document.getElementById("pause-confirm");
  const pauseConfirmMsg = document.getElementById("pause-confirm-msg");
  const pauseConfirmYes = document.getElementById("pause-confirm-yes");
  const pauseConfirmNo = document.getElementById("pause-confirm-no");
  const confirmReplaceEl = document.getElementById("confirm-replace");
  const confirmReplaceMsg = document.getElementById("confirm-replace-msg");
  const confirmReplaceYes = document.getElementById("confirm-replace-yes");
  const confirmReplaceNo = document.getElementById("confirm-replace-no");
  const upgradeOverlayStatsBar = document.getElementById("upgrade-overlay-stats-bar");
  const overlayStatsHp = document.getElementById("overlay-stats-hp");
  const overlayStatsCells = document.getElementById("overlay-stats-cells");
  const overlayStatsAttack = document.getElementById("overlay-stats-attack");
  const overlayStatsBadges = document.getElementById("overlay-stats-badges");

  function refreshOverlayTextsInternal() {
    const overlayScoreP = overlay?.querySelector(".overlay-score");
    if (overlayScoreP?.firstChild) overlayScoreP.firstChild.nodeValue = t("overlay.scoreLabel") + " ";
    if (overlayMainBtn) overlayMainBtn.textContent = t("pause.toMain");
    if (restartBtn) restartBtn.textContent = t("common.restart");
    const topPlayersH3 = document.getElementById("leaderboard")?.querySelector("h3");
    if (topPlayersH3 && topPlayersH3.firstChild) topPlayersH3.firstChild.nodeValue = t("overlay.topPlayers");
    const periodBtns = document.querySelectorAll(".period-btn[data-period]");
    periodBtns.forEach((btn) => {
      const p = btn.getAttribute("data-period");
      if (p === "7d") btn.textContent = t("overlay.period7d");
      else if (p === "30d") btn.textContent = t("overlay.period30d");
      else if (p === "1y") btn.textContent = t("overlay.period1y");
    });
    if (feedbackOpenBtn) feedbackOpenBtn.textContent = t("overlay.feedbackLabel");
    if (feedbackModalHeader) feedbackModalHeader.textContent = t("overlay.feedbackModalHeader");
    if (feedbackModalText) feedbackModalText.placeholder = t("overlay.feedbackPlaceholder");
    if (feedbackModalClose) feedbackModalClose.textContent = t("overlay.feedbackClose");
    if (feedbackModalSubmit) feedbackModalSubmit.textContent = t("overlay.feedbackSend");
    if (confirmReplaceYes) confirmReplaceYes.textContent = t("common.yes");
    if (confirmReplaceNo) confirmReplaceNo.textContent = t("common.no");
    const pauseTitleEl = document.querySelector("#pause-overlay .pause-title");
    if (pauseTitleEl) pauseTitleEl.textContent = t("pause.paused");
    const pauseSubEl = document.querySelector("#pause-overlay .pause-sub");
    if (pauseSubEl) pauseSubEl.textContent = t("pause.pressEscToResume");
    if (pauseBtnMain) pauseBtnMain.textContent = t("pause.toMain");
    if (pauseBtnQuit) pauseBtnQuit.textContent = t("pause.quitGame");
    if (pauseBtnBgm) pauseBtnBgm.textContent = getBgmToggleLabel();
    if (pauseConfirmYes) pauseConfirmYes.textContent = t("common.yes");
    if (pauseConfirmNo) pauseConfirmNo.textContent = t("common.no");
  }
  overlayTextsRefreshFn = refreshOverlayTextsInternal;
  refreshOverlayTextsInternal();

  function playUiSound(key, config) {
    if (!phaserGame || !phaserGame.sound || !phaserGame.sound.play) return;
    try {
      phaserGame.sound.play(key, config);
    } catch (e) {
      // ignore audio errors
    }
  }

  function clearStatus() {
    statusText.textContent = "";
    statusText.classList.remove("error");
  }

  function setStatus(message, isError = false) {
    statusText.textContent = message;
    statusText.classList.toggle("error", isError);
  }

  async function refreshLeaderboard() {
    leaderboardList.innerHTML = "";
    try {
      const items = await fetchLeaderboard(20, currentLeaderboardPeriod);
      if (!items || items.length === 0) {
        leaderboardList.innerHTML =
          '<div class="status-text">' + t("overlay.noScoresYet") + '</div>';
        return;
      }
      items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "leaderboard-item";
        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = `#${index + 1}`;
        const name = document.createElement("span");
        name.className = "leaderboard-name" + (index === 0 ? " leaderboard-name--gold" : index === 1 ? " leaderboard-name--silver" : index === 2 ? " leaderboard-name--bronze" : "");
        name.textContent = item.nickname || "";
        const score = document.createElement("span");
        score.className = "leaderboard-score";
        score.textContent = String(item.score ?? 0);
        row.appendChild(rank);
        row.appendChild(name);
        row.appendChild(score);
        leaderboardList.appendChild(row);
      });
    } catch (err) {
        const errEl = document.createElement("div");
        errEl.className = "status-text error";
        errEl.textContent = t("overlay.leaderboardFailed");
        leaderboardList.innerHTML = "";
        leaderboardList.appendChild(errEl);
    }
  }

  if (leaderboardPeriodContainer) {
    leaderboardPeriodContainer.querySelectorAll(".period-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const period = btn.getAttribute("data-period");
        if (!period) return;
        currentLeaderboardPeriod = period;
        leaderboardPeriodContainer.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        refreshLeaderboard();
      });
    });
  }

  function openFeedbackModal() {
    if (feedbackModal && feedbackModalText) {
      feedbackModalText.value = "";
      feedbackModal.classList.add("visible");
      feedbackModal.setAttribute("aria-hidden", "false");
      feedbackModalText.focus();
    }
  }
  function closeFeedbackModal() {
    if (feedbackModal) {
      feedbackModal.classList.remove("visible");
      feedbackModal.setAttribute("aria-hidden", "true");
    }
  }
  if (feedbackOpenBtn) {
    feedbackOpenBtn.addEventListener("click", openFeedbackModal);
  }
  if (feedbackModalClose) {
    feedbackModalClose.addEventListener("click", closeFeedbackModal);
  }
  if (feedbackModal && feedbackModal.querySelector(".feedback-modal-backdrop")) {
    feedbackModal.querySelector(".feedback-modal-backdrop").addEventListener("click", closeFeedbackModal);
  }
  // 피드백 입력 시 띄어쓰기 등이 동작하도록 키 이벤트가 문서/게임으로 전파되지 않게 함
  if (feedbackModalText) {
    feedbackModalText.addEventListener("keydown", (e) => e.stopPropagation());
  }
  if (feedbackModalSubmit && feedbackModalText) {
    feedbackModalSubmit.addEventListener("click", async () => {
      const content = feedbackModalText.value.trim();
      if (!content) return;
      feedbackModalSubmit.disabled = true;
      clearStatus();
      try {
        await submitFeedback(content);
        setStatus(t("overlay.feedbackSent") || "Feedback sent.");
        feedbackModalText.value = "";
        closeFeedbackModal();
      } catch (err) {
        setStatus(err.message || "Failed to send feedback.", true);
      } finally {
        feedbackModalSubmit.disabled = false;
      }
    });
  }

  window.showGameOverOverlay = async (
    score,
    isClear = false,
    baseScore = null
  ) => {
    lastGameOverScore = typeof score === "number" ? score : 0;
    clearStatus();

    const nicknameForSubmit =
      typeof getNicknameForSubmit === "function" ? getNicknameForSubmit() : "";
    if (nicknameValue) {
      nicknameValue.textContent = nicknameForSubmit || "";
    }

    if (overlayTitle) {
      overlayTitle.textContent = isClear ? t("overlay.clear") : t("overlay.gameOver");
      overlayTitle.classList.remove(
        "ending-title-gameover",
        "ending-title-clear"
      );
      overlayTitle.classList.add(
        isClear ? "ending-title-clear" : "ending-title-gameover"
      );
    }

    // 기본 상태 초기화
    if (scoreText) {
      scoreText.style.color = "";
    }
    if (scoreMultiplier) {
      scoreMultiplier.textContent = "";
      scoreMultiplier.classList.remove("visible");
    }

    // Clear 시: 원래 점수 → "× 1.5" 등장 → 점수 증가 애니메이션 → 최종 점수(초록색)
    if (isClear && baseScore != null && baseScore >= 0 && baseScore < score) {
      const from = baseScore;
      const to = score;
      const duration = 900;

      if (scoreText) {
        scoreText.textContent = String(from);
      }

      // "× 1.5" 표시
      if (scoreMultiplier) {
        scoreMultiplier.textContent = t("overlay.clearBonus");
        scoreMultiplier.classList.remove("visible");
        setTimeout(() => {
          scoreMultiplier.classList.add("visible");
        }, 250);
      }

      // 약간의 텀 이후 점수 증가 애니메이션 시작
      setTimeout(() => {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const current = Math.round(from + (to - from) * t);
          if (scoreText) {
            scoreText.textContent = String(current);
          }
          if (t < 1) {
            requestAnimationFrame(step);
          } else if (scoreText) {
            scoreText.textContent = String(to);
            scoreText.style.color = "#66bb6a";
          }
        };
        requestAnimationFrame(step);
      }, 600);
    } else if (scoreText) {
      // Game Over 등 일반 케이스
      scoreText.textContent = String(score);
    }

    overlay.classList.add("visible");
    await refreshLeaderboard();

    // 점수 자동 제출
    try {
      const submittingMsg = t("overlay.submittingScore");
      if (nicknameValue) {
        const baseName = nicknameForSubmit || "";
        nicknameValue.textContent = baseName
          ? `${baseName} / ${submittingMsg}`
          : submittingMsg;
      } else {
        setStatus(submittingMsg);
      }

      const result = await submitScore(nicknameForSubmit, lastGameOverScore);

      const submittedName =
        (result && typeof result.nickname === "string" && result.nickname) ||
        nicknameForSubmit ||
        "";

      let messageKey = "overlay.scoreSubmitted";
      if (result && result.status === "created") {
        messageKey = "overlay.scoreCreated";
      } else if (result && result.status === "updated") {
        messageKey = "overlay.scoreUpdated";
      } else if (result && result.status === "kept") {
        messageKey = "overlay.scoreKept";
      }
      const message = t(messageKey);

      if (nicknameValue) {
        nicknameValue.textContent = submittedName
          ? `${submittedName}, ${message}`
          : message;
      }
      clearStatus();
      await refreshLeaderboard();
    } catch (err) {
      const errMsg = err.message || t("overlay.submitScoreFailed");
      if (nicknameValue) {
        const baseName = nicknameForSubmit || "";
        nicknameValue.textContent = baseName
          ? `${baseName} / ${errMsg}`
          : errMsg;
      } else {
        setStatus(errMsg, true);
      }
    }
  };

  let confirmReplaceOnYes = null;
  let confirmFocus = "no";

  function focusConfirmButton() {
    if (!confirmReplaceEl) return;
    if (confirmReplaceYes) confirmReplaceYes.classList.remove("selected");
    if (confirmReplaceNo) confirmReplaceNo.classList.remove("selected");

    const target = confirmFocus === "yes" ? confirmReplaceYes : confirmReplaceNo;
    if (target) {
      target.classList.add("selected");
      target.focus();
    }
  }

  function showConfirmReplace(currentName, newName, onYes) {
    if (!confirmReplaceMsg || !confirmReplaceEl) return;
    confirmReplaceMsg.textContent = t("overlay.replaceConfirm", {
      current: currentName,
      new: newName,
    });
    confirmReplaceOnYes = onYes;
    confirmFocus = "no";
    confirmReplaceEl.classList.add("visible");
    focusConfirmButton();
  }

  function hideConfirmReplace() {
    confirmReplaceOnYes = null;
    if (confirmReplaceEl) confirmReplaceEl.classList.remove("visible");
  }

  if (confirmReplaceYes) {
    confirmReplaceYes.addEventListener("click", () => {
      if (typeof confirmReplaceOnYes === "function") confirmReplaceOnYes();
      hideConfirmReplace();
    });
  }
  if (confirmReplaceNo) {
    confirmReplaceNo.addEventListener("click", hideConfirmReplace);
  }
  document.addEventListener("keydown", (e) => {
    if (!confirmReplaceEl || !confirmReplaceEl.classList.contains("visible")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hideConfirmReplace();
      return;
    }

    const navKeys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "a", "A", "w", "W", "d", "D", "s", "S"];
    if (navKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      confirmFocus = confirmFocus === "yes" ? "no" : "yes";
      focusConfirmButton();
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (confirmFocus === "yes" && confirmReplaceYes) {
        confirmReplaceYes.click();
      } else if (confirmReplaceNo) {
        confirmReplaceNo.click();
      }
    }
  });

  window.showUpgradeOverlay = (choices, onSelect, overlayContext) => {
    if (!upgradeOverlay) {
      if (typeof onSelect === "function" && choices && choices.length > 0) {
        onSelect(choices[0]);
      }
      return;
    }

    if (!Array.isArray(choices) || choices.length === 0) {
      if (typeof onSelect === "function") {
        onSelect(null);
      }
      return;
    }

    if (upgradeOptionsContainer) {
      upgradeOptionsContainer.innerHTML = "";
    }
    const rarityDescClasses = ["badge-rarity-normal", "badge-rarity-epic", "badge-rarity-unique"];
    if (upgradeDescription) {
      upgradeDescription.textContent = "";
      rarityDescClasses.forEach((c) => upgradeDescription.classList.remove(c));
    }

    function setDescriptionText(text, rarity) {
      if (!upgradeDescription) return;
      upgradeDescription.innerHTML = formatBold(text || "");
      rarityDescClasses.forEach((c) => upgradeDescription.classList.remove(c));
      if (rarity) {
        upgradeDescription.classList.add("badge-rarity-" + rarity);
      }
    }
    if (upgradeBadgeSlotsContainer) {
      upgradeBadgeSlotsContainer.innerHTML = "";
    }

    const buttons = [];
    let currentIndex = 0;
    let handled = false;

    // 선택지 중 type === "info"는 상단 설명 영역(헤더 타이틀/설명)에 사용하고,
    // 버튼은 type !== "info"만 생성한다.
    const headerChoice = choices.find((c) => c && c.type === "info");
    const buttonChoices = choices.filter((c) => !c || c.type !== "info");

    // 뱃지 획득/교체 모드: 슬롯 UI 렌더링
    const ctx = overlayContext || {};
    const scene = ctx.scene;
    const badge = ctx.badge;
    const badgeMode = ctx.badgeMode;
    const canEquip = ctx.canEquip !== false;

    if (upgradeBadgeSlotsContainer && scene && badge && badgeMode === "unified") {
      const modeForSlots = canEquip ? "unified" : "display";
      renderBadgeSlots(upgradeBadgeSlotsContainer, scene, {
        mode: modeForSlots,
        newBadge: badge,
        onSlotClick(slotIndex) {
          if (!canEquip) return;
          const equipped = scene.badgesEquipped || [];
          const currentId = equipped[slotIndex];
          const currentDef = currentId ? BADGES.find((b) => b.id === currentId) : null;
          const currentName = currentId ? t(`badge.${currentId}.name`) : "Slot";
          const newName = t(`badge.${badge.id}.name`);

          if (!currentId) {
            // 빈 슬롯: 바로 장착
            handleChoice({ type: "equip_badge", badgeId: badge.id, slotIndex });
          } else {
            // 기존 뱃지와 교체: 확인 다이얼로그 후 장착
            showConfirmReplace(currentName, newName, () => {
              handleChoice({ type: "equip_badge", badgeId: badge.id, slotIndex });
            });
          }
        },
      });
    } else if (upgradeBadgeSlotsContainer && scene && badge && badgeMode === "acquisition") {
      // 빈 슬롯에만 장착
      renderBadgeSlots(upgradeBadgeSlotsContainer, scene, {
        mode: "acquisition",
        newBadge: badge,
        onSlotClick(slotIndex) {
          handleChoice({ type: "equip_badge", badgeId: badge.id, slotIndex });
        },
      });
    } else if (upgradeBadgeSlotsContainer && scene && badge && badgeMode === "replace") {
      // 교체 전용
      renderBadgeSlots(upgradeBadgeSlotsContainer, scene, {
        mode: "replace",
        newBadge: badge,
        onSlotClick(slotIndex) {
          const equipped = scene.badgesEquipped || [];
          const currentId = equipped[slotIndex];
          const currentDef = currentId ? BADGES.find((b) => b.id === currentId) : null;
          const currentName = currentId ? t(`badge.${currentId}.name`) : "Slot";
          const newName = t(`badge.${badge.id}.name`);
          showConfirmReplace(currentName, newName, () => {
            handleChoice({ type: "equip_badge", badgeId: badge.id, slotIndex });
          });
        },
      });
    }

    // 헤더: 획득 화면(등급 타이틀)일 때만 등급 색상 적용, 교체 화면(Badge Replace)은 기본 색상
    const rarityClasses = ["badge-rarity-normal", "badge-rarity-epic", "badge-rarity-unique"];
    const isAcquisitionHeader = headerChoice?.label && headerChoice.label !== t("upgrade.badgeReplace") && headerChoice.rarity;

    if (upgradeTitle) {
      rarityClasses.forEach((cls) => upgradeTitle.classList.remove(cls));
      upgradeTitle.textContent = headerChoice?.label ?? t("upgrade.title");
      if (isAcquisitionHeader) {
        upgradeTitle.classList.add(`badge-rarity-${headerChoice.rarity}`);
      }
    }
    if (upgradeSubtitle) {
      rarityClasses.forEach((cls) => upgradeSubtitle.classList.remove(cls));
      if (headerChoice && Object.prototype.hasOwnProperty.call(headerChoice, "description")) {
        upgradeSubtitle.innerHTML = formatBold(headerChoice.description || "");
      } else {
        upgradeSubtitle.textContent = headerChoice
          ? t("upgrade.chooseWhatYouWant")
          : t("upgrade.chooseUpgrade");
      }
      if (isAcquisitionHeader) {
        upgradeSubtitle.classList.add(`badge-rarity-${headerChoice.rarity}`);
      }
    }

    buttonChoices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const rarityCls = choice.type !== "skip" && choice.rarity ? ` badge-rarity-${choice.rarity}` : "";
      const badgeDrawCls = choice.id === "badge_draw" ? " badge-draw-btn" : "";
      btn.className = "primary-btn" + rarityCls + badgeDrawCls + (choice.disabled ? " disabled" : "");
      btn.textContent = choice.label || choice.id;
      btn.disabled = !!choice.disabled;
      btn.onclick = () => {
        if (choice.disabled) return;
        handleChoice(choice);
      };
      btn.addEventListener("mouseenter", () => {
        setDescriptionText(choice.description || "", choice.rarity);
      });
      btn.addEventListener("focus", () => {
        setDescriptionText(choice.description || "", choice.rarity);
      });
      buttons.push(btn);
      if (upgradeOptionsContainer) {
        upgradeOptionsContainer.appendChild(btn);
      }
    });

    // 키보드: 슬롯 카드(클릭 가능한 것) + 버튼을 하나의 포커스 목록으로
    const slotCards = upgradeBadgeSlotsContainer
      ? Array.from(upgradeBadgeSlotsContainer.querySelectorAll(".badge-slot-card.clickable"))
      : [];
    const allFocusables = [...slotCards, ...buttons];
    const totalFocusables = allFocusables.length;

    const isSlotCard = (el) => slotCards.includes(el);
    const getButtonChoiceAtIndex = (focusIndex) => {
      if (focusIndex < slotCards.length) return null;
      return buttonChoices[focusIndex - slotCards.length] || null;
    };

    const getFocusedSlotDescription = (_slotCardEl) => "";

    const setSelection = (focusIndex) => {
      currentIndex = Math.max(0, Math.min(focusIndex, totalFocusables - 1));
      buttons.forEach((btn) => btn.classList.remove("selected"));
      const currentEl = allFocusables[currentIndex];
      if (currentEl) {
        if (currentEl.classList && currentEl.classList.contains("primary-btn")) {
          currentEl.classList.add("selected");
        }
        currentEl.focus();
      }
      if (upgradeDescription) {
        const choice = getButtonChoiceAtIndex(currentIndex);
        if (isSlotCard(currentEl)) {
          setDescriptionText(getFocusedSlotDescription(currentEl), null);
        } else {
          setDescriptionText((choice && choice.description) || "", choice && choice.rarity);
        }
      }
    };

    function hideUpgradeStatsBar() {
      if (upgradeOverlayStatsBar) {
        upgradeOverlayStatsBar.classList.remove("visible");
        upgradeOverlayStatsBar.setAttribute("aria-hidden", "true");
      }
    }

    function handleChoice(choice) {
      if (handled) return;
      if (choice.disabled) return;
      playUiSound("sfx_select", { volume: 0.8 });
      handled = true;
      upgradeOverlay.classList.remove("visible");
      hideUpgradeStatsBar();
      window.removeEventListener("keydown", handleKeyDown);
      if (typeof onSelect === "function") {
        onSelect(choice);
      }
    }

    const handleKeyDown = (event) => {
      if (!upgradeOverlay.classList.contains("visible")) return;
      if (confirmReplaceEl && confirmReplaceEl.classList.contains("visible")) return;
      if (totalFocusables === 0) return;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
        case "w":
        case "W":
        case "a":
        case "A": {
          event.preventDefault();
          let next = currentIndex;
          for (let i = 0; i < totalFocusables; i += 1) {
            next = (next - 1 + totalFocusables) % totalFocusables;
            const choice = getButtonChoiceAtIndex(next);
            if (!choice || !choice.disabled) break;
          }
          if (next !== currentIndex) playUiSound("sfx_tab", { volume: 0.6 });
          setSelection(next);
          break;
        }
        case "ArrowRight":
        case "ArrowDown":
        case "s":
        case "S":
        case "d":
        case "D": {
          event.preventDefault();
          let next = currentIndex;
          for (let i = 0; i < totalFocusables; i += 1) {
            next = (next + 1) % totalFocusables;
            const choice = getButtonChoiceAtIndex(next);
            if (!choice || !choice.disabled) break;
          }
          if (next !== currentIndex) playUiSound("sfx_tab", { volume: 0.6 });
          setSelection(next);
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          event.stopPropagation();
          const el = allFocusables[currentIndex];
          if (!el) break;
          if (isSlotCard(el)) {
            el.click();
          } else {
            const c = getButtonChoiceAtIndex(currentIndex);
            if (c && !c.disabled) handleChoice(c);
          }
          break;
        }
        default:
          break;
      }
    };

    slotCards.forEach((card) => {
      card.addEventListener("focus", () => {
        if (upgradeDescription) upgradeDescription.textContent = getFocusedSlotDescription(card);
      });
      card.addEventListener("mouseenter", () => {
        if (upgradeDescription) upgradeDescription.textContent = getFocusedSlotDescription(card);
      });
    });

    const firstEnabledIndex = allFocusables.findIndex((el, i) => {
      if (isSlotCard(el)) return true;
      const c = getButtonChoiceAtIndex(i);
      return c && !c.disabled;
    });
    // 빈 슬롯이 있으면 초기 포커스를 빈 슬롯으로 (빈 슬롯에 장착하는 경우가 많으므로)
    const firstEmptySlotIndex = slotCards.findIndex((el) => el.classList.contains("empty"));
    const initialIndex =
      canEquip && firstEmptySlotIndex >= 0 ? firstEmptySlotIndex : firstEnabledIndex;
    setSelection(initialIndex >= 0 ? initialIndex : 0);
    window.addEventListener("keydown", handleKeyDown);

    if (scene && upgradeOverlayStatsBar && overlayStatsHp && overlayStatsCells && overlayStatsAttack && overlayStatsBadges) {
      const stats = getDashboardStatsForOverlay(scene);
      overlayStatsHp.textContent = stats.hp;
      overlayStatsHp.style.color = stats.hpColor || "#ffab91";
      overlayStatsCells.textContent = stats.cells;
      overlayStatsAttack.textContent = stats.attack;
      overlayStatsBadges.textContent = stats.badges;
      upgradeOverlayStatsBar.classList.add("visible");
      upgradeOverlayStatsBar.setAttribute("aria-hidden", "false");
    } else if (upgradeOverlayStatsBar) {
      upgradeOverlayStatsBar.classList.remove("visible");
      upgradeOverlayStatsBar.setAttribute("aria-hidden", "true");
    }

    upgradeOverlay.classList.add("visible");
  };

  if (overlayMainBtn) {
    overlayMainBtn.addEventListener("click", () => {
      overlay.classList.remove("visible");
      phaserGame.scene.stop("MainScene");
      phaserGame.scene.start("MainMenu");
    });
  }
  restartBtn.addEventListener("click", () => {
    overlay.classList.remove("visible");
    phaserGame.scene.stop("MainScene");
    phaserGame.scene.start("MainScene");
  });

  let currentPauseScene = null;
  let pauseConfirmOnYes = null;

  function showPauseConfirm(message, onYes) {
    if (!pauseConfirmMsg || !pauseConfirmEl) return;
    pauseConfirmMsg.textContent = message;
    pauseConfirmOnYes = onYes;
    pauseConfirmEl.classList.add("visible");
  }

  function hidePauseConfirm() {
    pauseConfirmOnYes = null;
    if (pauseConfirmEl) pauseConfirmEl.classList.remove("visible");
  }

  if (pauseBtnMain) {
    pauseBtnMain.addEventListener("click", () => {
      showPauseConfirm(t("pause.confirmToMain"), () => {
        hidePauseConfirm();
        if (pauseOverlay) pauseOverlay.classList.remove("visible");
        currentPauseScene = null;
        if (phaserGame && phaserGame.scene) {
          phaserGame.scene.stop("MainScene");
          phaserGame.scene.start("MainMenu");
        }
      });
    });
  }
  if (pauseBtnQuit) {
    pauseBtnQuit.addEventListener("click", () => {
      showPauseConfirm(t("pause.confirmQuit"), () => {
        hidePauseConfirm();
        if (pauseOverlay) pauseOverlay.classList.remove("visible");
        const scene = currentPauseScene || (phaserGame && phaserGame.scene && phaserGame.scene.getScene("MainScene"));
        if (scene && typeof scene.endGame === "function") scene.endGame(false);
        currentPauseScene = null;
      });
    });
  }
  if (pauseBtnBgm) {
    pauseBtnBgm.addEventListener("click", async () => {
      const scene =
        currentPauseScene ||
        (phaserGame && phaserGame.scene && phaserGame.scene.getScene("MainScene"));
      if (!scene) return;
      await resumeAudioContext(scene);
      const next = !getBgmEnabled();
      applyBgmEnabled(scene, next);
      pauseBtnBgm.textContent = getBgmToggleLabel();
    });
  }
  if (pauseConfirmYes) {
    pauseConfirmYes.addEventListener("click", () => {
      if (typeof pauseConfirmOnYes === "function") pauseConfirmOnYes();
      hidePauseConfirm();
    });
  }
  if (pauseConfirmNo) {
    pauseConfirmNo.addEventListener("click", hidePauseConfirm);
  }
  document.addEventListener("keydown", (e) => {
    if (!pauseConfirmEl || !pauseConfirmEl.classList.contains("visible")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hidePauseConfirm();
    }
  });

  window.showPauseOverlay = (scene) => {
    if (!pauseOverlay || !pauseBadgeSlotsContainer) return;
    currentPauseScene = scene;
    if (scene) {
      renderBadgeSlots(pauseBadgeSlotsContainer, scene, { mode: "display" });
    }
    if (pauseBtnMain) pauseBtnMain.textContent = t("pause.toMain");
    if (pauseBtnQuit) pauseBtnQuit.textContent = t("pause.quitGame");
    if (pauseBtnBgm) pauseBtnBgm.textContent = getBgmToggleLabel();
    pauseOverlay.classList.add("visible");
  };

  window.hidePauseOverlay = () => {
    if (pauseOverlay) pauseOverlay.classList.remove("visible");
    currentPauseScene = null;
  };

  window.isPauseConfirmVisible = () =>
    !!(pauseConfirmEl && pauseConfirmEl.classList.contains("visible"));
}
