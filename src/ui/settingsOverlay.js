/** 설정 오버레이 (언어, 재개 카운트다운, 공격 사운드). localStorage에 저장. */
import { GAME_VERSION } from "../config/constants.js";
import { getLocale, getSettings, setLocale, setSetting, t } from "../i18n.js";

const OVERLAY_ID = "settings-overlay";
const LABEL_ID = "settings-language-label";
const CLOSE_ID = "settings-close-btn";
const LANG_EN_ID = "settings-lang-en";
const LANG_KO_ID = "settings-lang-ko";
const RESUME_LABEL_ID = "settings-resume-countdown-label";
const RESUME_NORMAL_ID = "settings-resume-normal";
const RESUME_FAST_ID = "settings-resume-fast";
const ATTACK_SOUND_LABEL_ID = "settings-attack-sound-label";
const ATTACK_SOUND_1_ID = "settings-attack-sound-1";
const ATTACK_SOUND_2_ID = "settings-attack-sound-2";
const ATTACK_SOUND_3_ID = "settings-attack-sound-3";

const RESUME_SPEED_VALUES = ["normal", "fast"];
function getResumeCountdownSpeed() {
  const v = getSettings().resume_counting_speed;
  return RESUME_SPEED_VALUES.includes(v) ? v : "normal";
}

function getSfxAttackNumber() {
  const v = getSettings().sfx_attack;
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

let bound = false;

function getOverlay() {
  return document.getElementById(OVERLAY_ID);
}

function getEl(id) {
  return document.getElementById(id);
}

function updateOverlayTexts() {
  const label = getEl(LABEL_ID);
  const closeBtn = getEl(CLOSE_ID);
  const enBtn = getEl(LANG_EN_ID);
  const koBtn = getEl(LANG_KO_ID);
  const resumeLabel = getEl(RESUME_LABEL_ID);
  const resumeNormalBtn = getEl(RESUME_NORMAL_ID);
  const resumeFastBtn = getEl(RESUME_FAST_ID);
  const attackSoundLabel = getEl(ATTACK_SOUND_LABEL_ID);
  const attack1Btn = getEl(ATTACK_SOUND_1_ID);
  const attack2Btn = getEl(ATTACK_SOUND_2_ID);
  const attack3Btn = getEl(ATTACK_SOUND_3_ID);
  if (label) label.textContent = t("settings.language");
  if (closeBtn) closeBtn.textContent = t("settings.close");
  if (enBtn) enBtn.textContent = t("settings.en");
  if (koBtn) koBtn.textContent = t("settings.ko");
  if (resumeLabel) resumeLabel.textContent = t("settings.resumeCountdown");
  if (resumeNormalBtn) resumeNormalBtn.textContent = t("settings.resumeNormal");
  if (resumeFastBtn) resumeFastBtn.textContent = t("settings.resumeFast");
  if (attackSoundLabel) attackSoundLabel.textContent = t("settings.attackSound");
  if (attack1Btn) attack1Btn.textContent = t("settings.attackSound1");
  if (attack2Btn) attack2Btn.textContent = t("settings.attackSound2");
  if (attack3Btn) attack3Btn.textContent = t("settings.attackSound3");
}

function updateActiveResumeSpeed() {
  const cur = getResumeCountdownSpeed();
  const normalBtn = getEl(RESUME_NORMAL_ID);
  const fastBtn = getEl(RESUME_FAST_ID);
  if (normalBtn) normalBtn.classList.toggle("active", cur === "normal");
  if (fastBtn) fastBtn.classList.toggle("active", cur === "fast");
}

function updateActiveLang() {
  const cur = getLocale();
  const enBtn = getEl(LANG_EN_ID);
  const koBtn = getEl(LANG_KO_ID);
  if (enBtn) enBtn.classList.toggle("active", cur === "en");
  if (koBtn) koBtn.classList.toggle("active", cur === "ko");
}

function updateActiveSfxAttack() {
  const cur = getSfxAttackNumber();
  const btn1 = getEl(ATTACK_SOUND_1_ID);
  const btn2 = getEl(ATTACK_SOUND_2_ID);
  const btn3 = getEl(ATTACK_SOUND_3_ID);
  if (btn1) btn1.classList.toggle("active", cur === 1);
  if (btn2) btn2.classList.toggle("active", cur === 2);
  if (btn3) btn3.classList.toggle("active", cur === 3);
}

/**
 * Show settings overlay. Call from MainMenuScene when Settings is clicked.
 * 닫을 때 설정이 바뀌었을 때만 씬을 재시작해 메뉴 문구를 갱신하고, 그 외에는 재시작하지 않음.
 */
export function showSettingsOverlay(scene) {
  const overlay = getOverlay();
  if (!overlay) return;

  overlay.dataset.localeWhenOpened = getLocale();

  if (!bound) {
    bound = true;
    const closeBtn = getEl(CLOSE_ID);
    const enBtn = getEl(LANG_EN_ID);
    const koBtn = getEl(LANG_KO_ID);
    const resumeNormalBtn = getEl(RESUME_NORMAL_ID);
    const resumeFastBtn = getEl(RESUME_FAST_ID);
    const attack1Btn = getEl(ATTACK_SOUND_1_ID);
    const attack2Btn = getEl(ATTACK_SOUND_2_ID);
    const attack3Btn = getEl(ATTACK_SOUND_3_ID);

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const openedWith = overlay.dataset.localeWhenOpened;
        overlay.classList.remove("visible");
        if (scene && typeof scene.scene !== "undefined" && getLocale() !== openedWith) {
          scene.scene.restart();
        }
      });
    }

    const onLangClick = async (e) => {
      const btn = e.currentTarget;
      const lang = btn && btn.dataset && btn.dataset.lang;
      if (lang !== "en" && lang !== "ko") return;
      await setLocale(lang);
      updateOverlayTexts();
      updateActiveLang();
    };

    const onResumeSpeedClick = (e) => {
      const btn = e.currentTarget;
      const speed = btn && btn.dataset && btn.dataset.speed;
      if (speed !== "normal" && speed !== "fast") return;
      setSetting("resume_counting_speed", speed);
      updateActiveResumeSpeed();
    };

    if (enBtn) enBtn.addEventListener("click", onLangClick);
    if (koBtn) koBtn.addEventListener("click", onLangClick);
    const onHitSoundClick = (e) => {
      const btn = e.currentTarget;
      const n = btn && btn.dataset && btn.dataset.sfx;
      const num = n === "1" ? 1 : n === "2" ? 2 : n === "3" ? 3 : null;
      if (num !== null) {
        setSetting("sfx_attack", num);
        updateActiveSfxAttack();
        if (scene && scene.sound && scene.sound.play) {
          try {
            scene.sound.play(`sfx_attack_${num}`, { volume: 0.7 });
          } catch (_) {}
        }
      }
    };

    if (resumeNormalBtn) resumeNormalBtn.addEventListener("click", onResumeSpeedClick);
    if (resumeFastBtn) resumeFastBtn.addEventListener("click", onResumeSpeedClick);
    if (attack1Btn) attack1Btn.addEventListener("click", onHitSoundClick);
    if (attack2Btn) attack2Btn.addEventListener("click", onHitSoundClick);
    if (attack3Btn) attack3Btn.addEventListener("click", onHitSoundClick);
  }

  updateOverlayTexts();
  updateActiveLang();
  updateActiveResumeSpeed();
  updateActiveSfxAttack();
  const versionEl = document.getElementById("settings-version");
  if (versionEl) versionEl.textContent = `v${GAME_VERSION}`;
  overlay.classList.add("visible");
}
