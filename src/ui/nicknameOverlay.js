/** 메인메뉴에서 사용하는 닉네임 입력 오버레이 */
import { t } from "../i18n.js";

const STORAGE_KEY = "A_lonely_green_slime_nickname";
const OVERLAY_ID = "nickname-overlay";
const WASD_KEYS = new Set(["w", "a", "s", "d"]);

let currentNicknameForSubmit = "";
let bound = false;
let boundWASDFix = false;

function getOverlay() {
  return document.getElementById(OVERLAY_ID);
}

function getStoredNickname() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return typeof raw === "string" ? raw : "";
  } catch (_) {
    return "";
  }
}

function setStoredNickname(nickname) {
  try {
    if (!nickname) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, nickname);
    }
  } catch (_) {
    // ignore storage errors
  }
}

/**
 * 닉네임 검증.
 * - 공백만 입력은 닉네임 없음으로 처리
 * - Player 그대로면 닉네임 없음으로 처리
 * - 한글 포함: 2~20자
 * - 그 외: 2~32자
 * @param {string} raw
 * @returns {{ ok: true, nickname: string } | { ok: false, errorKey: string }}
 */
function validateNickname(raw) {
  const original = typeof raw === "string" ? raw : "";
  const trimmed = original.trim();

  if (!trimmed || trimmed === "Player") {
    // 닉네임을 설정하지 않은 것으로 간주 → 서버에서 PlayerN 자동 부여
    return { ok: true, nickname: "" };
  }

  const hasHangul = /[ㄱ-ㅎ가-힣]/.test(trimmed);
  const len = trimmed.length;

  if (len < 2) {
    return { ok: false, errorKey: "overlay.nicknameTooShort" };
  }

  if (hasHangul && len > 20) {
    return { ok: false, errorKey: "overlay.nicknameTooLongKo" };
  }
  if (!hasHangul && len > 32) {
    return { ok: false, errorKey: "overlay.nicknameTooLongEn" };
  }

  return { ok: true, nickname: trimmed };
}

export function getNicknameForSubmit() {
  return currentNicknameForSubmit;
}

/**
 * 메인메뉴에서 "시작" 클릭 시 호출.
 * 닉네임을 입력(또는 기본 Player 유지)한 뒤 게임 씬을 시작한다.
 * @param {Phaser.Scene} scene
 */
export function showNicknameOverlay(scene) {
  const overlay = getOverlay();
  if (!overlay || !scene || !scene.scene) {
    // 오버레이가 없으면 닉네임 없이 바로 시작
    currentNicknameForSubmit = "";
    if (scene && scene.scene) {
      scene.scene.start("MainScene", { nicknameForSubmit: "" });
    }
    return;
  }

  const input = document.getElementById("nickname-overlay-input");
  const titleEl = document.getElementById("nickname-overlay-title");
  const descEl = document.getElementById("nickname-overlay-description");
  const errorEl = document.getElementById("nickname-overlay-error");
  const cancelBtn = document.getElementById("nickname-overlay-cancel");
  const confirmBtn = document.getElementById("nickname-overlay-confirm");
  const backdrop = overlay.querySelector(".nickname-overlay-backdrop");

  if (titleEl) {
    titleEl.textContent = t("overlay.nicknameTitle");
  }
  if (descEl) {
    descEl.textContent = t("overlay.nicknameDescription");
  }
  if (confirmBtn) {
    confirmBtn.textContent = t("overlay.nicknamePlay");
  }
  if (cancelBtn) {
    cancelBtn.textContent = t("overlay.nicknameClose");
  }

  const stored = getStoredNickname();
  const base = stored && stored.trim() ? stored : "Player";
  if (input) {
    input.value = base;
  }
  if (errorEl) {
    errorEl.textContent = "";
  }

  function closeOverlay(options = {}) {
    const { reenableMenu = true } = options;
    overlay.classList.remove("visible");
    overlay.setAttribute("aria-hidden", "true");
    if (errorEl) errorEl.textContent = "";
    if (input && document.activeElement === input) {
      input.blur();
      input.onkeydown = null;
    }
    if (reenableMenu && scene && typeof scene.enableMenuButtons === "function") {
      scene.enableMenuButtons();
    }
  }

  function handleConfirm() {
    if (!input) {
      currentNicknameForSubmit = "";
      if (scene && scene.sound && scene.sound.play) {
        try {
          scene.sound.play("sfx_play", { volume: 0.9 });
        } catch (_) {}
      }
      closeOverlay({ reenableMenu: false });
      scene.scene.start("MainScene", { nicknameForSubmit: "" });
      return;
    }
    const raw = input.value || "";
    const result = validateNickname(raw);
    if (!result.ok) {
      if (errorEl) {
        errorEl.textContent = t(result.errorKey);
      }
      if (input) {
        input.classList.remove("nickname-input-shake");
        // force reflow to restart animation
        // eslint-disable-next-line no-unused-expressions
        void input.offsetWidth;
        input.classList.add("nickname-input-shake");
        setTimeout(() => {
          input.classList.remove("nickname-input-shake");
        }, 220);
      }
      return;
    }

    currentNicknameForSubmit = result.nickname;
    if (currentNicknameForSubmit) {
      setStoredNickname(currentNicknameForSubmit);
    } else {
      // 닉네임 미설정: 저장된 값은 유지하되, 이번 판은 PlayerN 자동 부여만 사용
    }

    if (scene && scene.sound && scene.sound.play) {
      try {
        scene.sound.play("sfx_play", { volume: 0.9 });
      } catch (_) {}
    }
    closeOverlay({ reenableMenu: false });
    scene.scene.start("MainScene", { nicknameForSubmit: currentNicknameForSubmit });
  }

  // 버튼/입력 이벤트는 호출할 때마다 최신 scene/closeOverlay/handleConfirm 를 참조하도록 덮어쓴다.
  if (confirmBtn) {
    confirmBtn.onclick = handleConfirm;
  }
  if (cancelBtn) {
    cancelBtn.onclick = () => closeOverlay();
  }
  if (backdrop) {
    backdrop.onclick = () => closeOverlay();
  }
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // 키 이벤트 처리가 완전히 끝난 뒤에 게임 씬을 시작하도록,
        // 다음 tick 에 Play 버튼 클릭을 위임한다.
        if (confirmBtn) {
          setTimeout(() => {
            confirmBtn.click();
          }, 0);
        } else {
          setTimeout(() => {
            handleConfirm();
          }, 0);
        }
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => {
            closeOverlay();
          }, 0);
        }
    };
  }

  // 메인메뉴 닉네임 입력 시 WASD가 Phaser에 잡혀 입력되지 않는 문제: capture 단계에서 가로채서 input에 직접 삽입
  if (!boundWASDFix && typeof document !== "undefined") {
    boundWASDFix = true;
    document.addEventListener(
      "keydown",
      (e) => {
        const overlayEl = getOverlay();
        if (!overlayEl || !overlayEl.classList.contains("visible")) return;
        const inputEl = document.getElementById("nickname-overlay-input");
        if (!inputEl || document.activeElement !== inputEl) return;

        const key = e.key?.toLowerCase();
        if (!WASD_KEYS.has(key) || e.ctrlKey || e.metaKey || e.altKey) return;

        e.preventDefault();
        e.stopPropagation();

        const char = e.shiftKey ? key.toUpperCase() : key;
        const maxLen = inputEl.getAttribute("maxlength");
        const limit = maxLen ? parseInt(maxLen, 10) : 32;
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? start;
        const val = inputEl.value;
        const newVal = val.slice(0, start) + char + val.slice(end);
        if (newVal.length <= limit) {
          inputEl.value = newVal;
          const pos = start + 1;
          inputEl.setSelectionRange(pos, pos);
        }
      },
      true
    );
  }

  if (scene && typeof scene.disableMenuButtons === "function") {
    scene.disableMenuButtons();
  }

  overlay.classList.add("visible");
  overlay.setAttribute("aria-hidden", "false");
  if (input) {
    input.focus();
    input.select();
  }
}

