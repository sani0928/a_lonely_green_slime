import { getSettings, setSetting, t } from "../i18n.js";

const BGM_SETTING_KEY = "bgm_enabled";
const DEFAULT_BGM_VOLUME = 0.25;

function ensureBgmState(scene) {
  if (!scene._bgm) {
    scene._bgm = {
      currentKey: null,
      currentSound: null,
      sounds: {},
      crossfadeTween: null,
      fadeOutTween: null,
    };
  }
  return scene._bgm;
}

function stopTween(tween) {
  if (tween && tween.stop) tween.stop();
}

function stopSound(sound) {
  if (!sound) return;
  if (sound.isPlaying && sound.stop) sound.stop();
  if (sound.setVolume) sound.setVolume(DEFAULT_BGM_VOLUME);
}

export function getBgmEnabled() {
  const raw = getSettings()[BGM_SETTING_KEY];
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (v === "false" || v === "0" || v === "off") return false;
    if (v === "true" || v === "1" || v === "on") return true;
  }
  return true;
}

export function setBgmEnabled(enabled) {
  setSetting(BGM_SETTING_KEY, !!enabled);
}

export function getBgmVolume() {
  return DEFAULT_BGM_VOLUME;
}

export function getBgmToggleLabel() {
  return `${t("common.bgm")}: ${getBgmEnabled() ? t("common.on") : t("common.off")}`;
}

export function resumeAudioContext(scene) {
  const context = scene?.sound?.context;
  if (!context || context.state !== "suspended" || typeof context.resume !== "function") {
    return Promise.resolve();
  }
  return context.resume().catch(() => {});
}

export function initSceneBgm(scene, key, options = {}) {
  if (!scene?.sound || !key) return null;
  const bgm = ensureBgmState(scene);
  if (bgm.sounds[key]) return bgm.sounds[key];

  const sound = scene.sound.add(key, {
    loop: true,
    volume: getBgmVolume(),
    ...options,
  });
  if (sound && sound.setVolume) sound.setVolume(getBgmVolume());
  bgm.sounds[key] = sound;
  return sound;
}

export function stopSceneBgm(scene, fadeMs = 0) {
  const bgm = ensureBgmState(scene);
  stopTween(bgm.crossfadeTween);
  stopTween(bgm.fadeOutTween);
  bgm.crossfadeTween = null;
  bgm.fadeOutTween = null;

  const current = bgm.currentSound;
  if (!current) return;

  if (!fadeMs || fadeMs <= 0 || !scene?.tweens || !current.isPlaying) {
    stopSound(current);
    bgm.currentSound = null;
    return;
  }

  const from = typeof current.volume === "number" ? current.volume : getBgmVolume();
  bgm.fadeOutTween = scene.tweens.addCounter({
    from,
    to: 0,
    duration: fadeMs,
    ease: "Sine.easeOut",
    onUpdate: (tw) => {
      if (current.setVolume) current.setVolume(tw.getValue());
    },
    onComplete: () => {
      stopSound(current);
      bgm.fadeOutTween = null;
      if (bgm.currentSound === current) {
        bgm.currentSound = null;
      }
    },
  });
}

export function playSceneBgm(scene, key) {
  if (!scene?.sound || !key) return null;
  const bgm = ensureBgmState(scene);
  bgm.currentKey = key;

  const target = initSceneBgm(scene, key);
  if (!target) return null;

  if (!getBgmEnabled()) {
    if (bgm.currentSound && bgm.currentSound !== target) {
      stopSound(bgm.currentSound);
      bgm.currentSound = null;
    }
    return null;
  }

  stopTween(bgm.crossfadeTween);
  stopTween(bgm.fadeOutTween);
  bgm.crossfadeTween = null;
  bgm.fadeOutTween = null;

  if (bgm.currentSound && bgm.currentSound !== target) {
    stopSound(bgm.currentSound);
  }

  const targetVol = getBgmVolume();
  if (!target.isPlaying) {
    target.play({ loop: true, volume: targetVol });
  } else if (target.setVolume) {
    target.setVolume(targetVol);
  }

  bgm.currentSound = target;
  return target;
}

export function switchSceneBgm(scene, nextKey, fadeMs = 800) {
  if (!scene?.sound || !nextKey) return null;
  const bgm = ensureBgmState(scene);
  if (bgm.currentKey === nextKey) {
    return playSceneBgm(scene, nextKey);
  }
  bgm.currentKey = nextKey;

  if (!getBgmEnabled()) {
    return null;
  }

  const nextSound = initSceneBgm(scene, nextKey);
  if (!nextSound) return null;

  const prevSound = bgm.currentSound;
  if (!prevSound || prevSound === nextSound) {
    return playSceneBgm(scene, nextKey);
  }

  stopTween(bgm.crossfadeTween);
  stopTween(bgm.fadeOutTween);
  bgm.crossfadeTween = null;
  bgm.fadeOutTween = null;

  const targetVol = getBgmVolume();
  if (!nextSound.isPlaying) {
    nextSound.play({ loop: true, volume: 0 });
  } else if (nextSound.setVolume) {
    nextSound.setVolume(0);
  }

  if (!fadeMs || fadeMs <= 0 || !scene.tweens) {
    stopSound(prevSound);
    if (nextSound.setVolume) nextSound.setVolume(targetVol);
    bgm.currentSound = nextSound;
    return nextSound;
  }

  bgm.crossfadeTween = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: fadeMs,
    ease: "Sine.easeInOut",
    onUpdate: (tw) => {
      const p = tw.getValue();
      if (prevSound.setVolume) prevSound.setVolume(targetVol * (1 - p));
      if (nextSound.setVolume) nextSound.setVolume(targetVol * p);
    },
    onComplete: () => {
      stopSound(prevSound);
      if (nextSound.setVolume) nextSound.setVolume(targetVol);
      bgm.crossfadeTween = null;
    },
  });

  bgm.currentSound = nextSound;
  return nextSound;
}

export function applyBgmEnabled(scene, enabled) {
  if (!scene?.sound) return;
  const bgm = ensureBgmState(scene);
  setBgmEnabled(enabled);

  if (!enabled) {
    stopSceneBgm(scene, 150);
    return;
  }

  if (!bgm.currentKey) return;
  playSceneBgm(scene, bgm.currentKey);
}
