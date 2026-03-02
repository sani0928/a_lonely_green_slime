import {
  ENEMY_SPAWN_MARGIN,
  ENEMY_BASE_HP,
  ENEMY_HP_PER_DIFFICULTY,
  ENEMY_TYPES,
  EXTRA_ENEMIES_CAP,
  EXTRA_ENEMIES_CAP_STRONG,
  ENEMY_CULL_DISTANCE,
  USE_PIXEL_SPRITES,
} from "../config/constants.js";
import {
  pickEnemyTier,
  isStrongPlayer,
  getPlayerStrength,
  getMaxActiveEnemies,
} from "./difficultySystem.js";
import { getEnemySpawnMultiplier } from "./badgeSystem.js";
import {
  getDirIndexFromVector,
  getEntityMappingForEnemyType,
  getFrameIndex,
  getScaleForSize,
} from "../render/entitySprites.js";

const TIER_TO_TYPES = {
  weak: ["runner", "mite"],
  mid: ["grunt", "soldier"],
  strong: ["brute", "titan"],
};

function pickEnemyType(scene) {
  const tier = pickEnemyTier(scene);
  const pool = TIER_TO_TYPES[tier] || TIER_TO_TYPES.mid || ["grunt"];
  if (!pool.length) {
    return "grunt";
  }
  const index = Phaser.Math.Between(0, pool.length - 1);
  return pool[index];
}

function countEnemiesOfType(scene, type) {
  if (!scene.enemies) return 0;
  let count = 0;
  scene.enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    if (enemy.getData("type") === type) {
      count += 1;
    }
  });
  return count;
}

/** 시간·플레이어 강함에 따라 shooter 필드 상한(1~6)과 스폰 확률(5%~60%) 조절 후 타입 반환 */
function pickSpawnType(scene) {
  const shootersNow = countEnemiesOfType(scene, "shooter");
  const t = scene.elapsedTime || 0;
  const strength = getPlayerStrength(scene); // 0.0 ~ 1.0

  let tNorm;
  if (t <= 600) {
    tNorm = Phaser.Math.Clamp(t / 900, 0, 1);
  } else if (t <= 900) {
    tNorm = 2 / 3 + ((t - 600) / 300) * 0.2;
  } else {
    tNorm = 0.8666666667 + ((t - 900) / 300) * 0.1333333333;
  }
  tNorm = Phaser.Math.Clamp(tNorm, 0, 1);
  const mix = Phaser.Math.Clamp(0.5 * tNorm + 0.5 * strength, 0, 1);

  // 필드에 존재 가능한 shooter 최대 수: 초반 1~2 → 후반 5~6
  const maxShooters = Phaser.Math.Clamp(
    Math.round(1 + mix * 5),
    1,
    6
  );

  let enemyType = pickEnemyType(scene);

  if (shootersNow < maxShooters) {
    const baseChance = 0.08;
    const extra = 0.34 * mix; // 후반/강할수록 원거리 비율 증가(상승 폭 완화)
    const shooterChance = Phaser.Math.Clamp(baseChance + extra, 0.05, 0.45);

    if (Math.random() < shooterChance) {
      enemyType = "shooter";
    }
  }

  return enemyType;
}

// 적 타입별 tint + scale
const ENEMY_TYPE_VISUALS = {
  runner: { tint: 0x4fc3f7, scale: 0.9 },
  mite: { tint: 0x26a69a, scale: 0.75 },
  grunt: { tint: 0xef5350, scale: 0.95 },
  soldier: { tint: 0xff9800, scale: 1.0 },
  shooter: { tint: 0xff9800, scale: 1.0 },
  brute: { tint: 0xab47bc, scale: 1.08 },
  titan: { tint: 0x5e35b1, scale: 1.2 },
};

function applyTierVisuals(enemy, type) {
  const vis = ENEMY_TYPE_VISUALS[type];
  if (vis) {
    enemy.setTint(vis.tint);
    enemy.setScale(vis.scale);
  } else {
    enemy.setTint(0xef5350);
    enemy.setScale(1.0);
  }
}

/** 슈터가 플레이어 방향으로 발사체 1발. 속도는 난이도 계수 sqrt 보정, 수명 2.6초 */
function fireRangedShot(scene, enemy, player) {
  if (!scene.enemyProjectiles || !player) return;

  const proj = scene.enemyProjectiles.create(enemy.x, enemy.y, "bullet");
  if (!proj || !proj.body) return;

  proj.setActive(true);
  proj.setVisible(true);
  proj.body.setAllowGravity(false);
  proj.setCircle(3);
  // shooter(ARCHER)의 본체 색상과 비슷한 노란색 틴트
  proj.setTint(0xf5dc46);

   // 자신을 쏜 슈터와의 즉시 충돌은 무시하기 위해 출처 enemy 를 기록
   if (proj.setData) {
     proj.setData("sourceEnemy", enemy);
   }

  // 일시정지 상태에서도 수명이 흐르지 않도록,
  // expiring 은 GameScene.update에서 elapsedTime 기준으로 처리한다.
  if (proj.setData && typeof scene.elapsedTime === "number") {
    const lifeSec = 2.6;
    proj.setData("expireAt", scene.elapsedTime + lifeSec);
  }

  const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
  const difficulty = scene.enemyDifficultyFactor || 1;
  const baseSpeed = 220;
  // difficulty 1 → 220, difficulty 21 → 660 (sqrt로 점진적 상승)
  const diffBonus = Math.max(0, difficulty - 1);
  const speed = baseSpeed + 440 * Math.sqrt(diffBonus / 20);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  proj.setVelocity(vx, vy);
}

function initializeEnemyStats(scene, enemy, type, difficulty) {
  const cfg = ENEMY_TYPES[type] || {};
  const baseHpFromType = cfg.baseHp ?? ENEMY_BASE_HP;
  const rawHp =
    baseHpFromType + ENEMY_HP_PER_DIFFICULTY * (Math.max(difficulty, 1) - 1);
  const hp = Math.max(10, Math.round(rawHp));

  enemy.setData("type", type);
  enemy.setData("maxHp", hp);
  enemy.setData("hp", hp);
  enemy.setData("scoreValue", cfg.score ?? 10);
}

/** 플레이어에서 너무 먼 적 제거. 화면 밖에 300마리 쌓여 스폰이 막히는 버그 방지 */
export function cullDistantEnemies(scene) {
  const player = scene.player;
  if (!player || !scene.enemies) return;
  const limitSq = (ENEMY_CULL_DISTANCE || 1400) ** 2;
  const toCull = [];
  scene.enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (dx * dx + dy * dy > limitSq) toCull.push(enemy);
  });
  for (let i = 0; i < toCull.length; i += 1) {
    if (toCull[i].destroy) toCull[i].destroy();
  }
}

/** 뷰 기준 랜덤 가장자리(상/우/하/좌) 한 점 반환 */
function getRandomSpawnPosition(view, margin) {
  const side = Phaser.Math.Between(0, 3);
  switch (side) {
    case 0:
      return {
        x: Phaser.Math.Between(view.x, view.x + view.width),
        y: view.y - margin,
      };
    case 1:
      return {
        x: view.x + view.width + margin,
        y: Phaser.Math.Between(view.y, view.y + view.height),
      };
    case 2:
      return {
        x: Phaser.Math.Between(view.x, view.x + view.width),
        y: view.y + view.height + margin,
      };
    case 3:
    default:
      return {
        x: view.x - margin,
        y: Phaser.Math.Between(view.y, view.y + view.height),
      };
  }
}

export function spawnEnemy(scene) {
  const baseCap = getMaxActiveEnemies(scene);
  const cap = Math.round(baseCap * getEnemySpawnMultiplier(scene));
  if (scene.enemies && scene.enemies.countActive(true) >= cap) {
    return;
  }
  const cam = scene.cameras.main;
  const view = cam.worldView;
  const margin = ENEMY_SPAWN_MARGIN;

  const extraCapBase = isStrongPlayer(scene)
    ? EXTRA_ENEMIES_CAP_STRONG
    : EXTRA_ENEMIES_CAP;
  const spawnMul = getEnemySpawnMultiplier(scene);
  const extraCap = Math.round(extraCapBase * spawnMul);
  const strength = getPlayerStrength(scene);
  const extraEnemies = Phaser.Math.Clamp(
    Math.round(extraCap * strength),
    0,
    extraCap
  );
  const totalToSpawn = 1 + extraEnemies;

  const usePixel =
    USE_PIXEL_SPRITES && scene.textures && scene.textures.exists("entities");
  const difficulty = scene.enemyDifficultyFactor || 1;
  const speedFactor = scene.enemySpeedFactor ?? 1;

  for (let i = 0; i < totalToSpawn; i += 1) {
    if (scene.enemies.countActive(true) >= cap) break;

    const { x, y } = getRandomSpawnPosition(view, margin);
    const enemyType = pickSpawnType(scene);
    const textureKey = usePixel
      ? "entities"
      : enemyType === "shooter"
      ? "shooter"
      : "enemy";

    const enemy = scene.enemies.create(x, y, textureKey);
    enemy.setCollideWorldBounds(false);

    const typeCfg = ENEMY_TYPES[enemyType] || {};
    const speedMultiplier = typeCfg.speedMultiplier ?? 1;
    const baseMin = scene.enemyBaseSpeedMin * speedMultiplier;
    const baseMax = scene.enemyBaseSpeedMax * speedMultiplier;
    const speedMin = baseMin * speedFactor;
    const speedMax = baseMax * speedFactor;

    enemy.setData("speed", Phaser.Math.Between(speedMin, speedMax));
    initializeEnemyStats(scene, enemy, enemyType, difficulty);

    if (usePixel) {
      const mapping = getEntityMappingForEnemyType(enemyType);
      enemy.setData("entityIndex", mapping.entityIndex);
      enemy.setData("dirIndex", 4);
      const baseScale = getScaleForSize(mapping.size);
      enemy.setScale(baseScale);
      if (enemy.body && enemy.body.setCircle) {
        const radius =
          mapping.size === "small"
            ? 12
            : mapping.size === "large"
            ? 20
            : 14;
        const offset = 64 - radius;
        enemy.body.setCircle(radius, offset, offset);
      }
      const frame = getFrameIndex(mapping.entityIndex, 4);
      if (enemy.setFrame) enemy.setFrame(frame);
    } else {
      applyTierVisuals(enemy, enemyType);
    }
    let behavior;
    if (enemyType === "shooter") {
      behavior = "shooter_behavior";
      enemy.setData("nextShotAt", (scene.elapsedTime || 0) + 1.4);
      // 플레이어 주변 원 위에서 흩어지기 위한 목표 각도 (스폰 시 랜덤 부여)
      enemy.setData("preferredAngle", Math.random() * Math.PI * 2);
    } else {
      behavior = "monsters_behavior";
      const baseAggro = 260;
      const variance = 40;
      const aggroRadius = baseAggro + Phaser.Math.Between(-variance, variance);
      enemy.setData("monsters_behaviorRoamAngle", Math.random() * Math.PI * 2);
      enemy.setData("monsters_behaviorAggro", false);
      enemy.setData("monsters_behaviorAggroRadius", aggroRadius);
    }
    enemy.setData("behavior", behavior);
  }
}

const GRID_CELL_SIZE = 64;

/**
 * 그리드 기반 공간 해시 구성. separation/타겟팅에서 O(n×k)로 비용 축소용.
 * @returns {{ grid: Map<string, import("phaser").GameObjects.GameObject[]>, enemies: import("phaser").GameObjects.GameObject[] }}
 */
export function buildEnemyGrid(scene, cellSize = GRID_CELL_SIZE) {
  const grid = new Map();
  const enemies = scene.enemies ? scene.enemies.getChildren() : [];
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy || !enemy.active) continue;
    const cx = Math.floor(enemy.x / cellSize);
    const cy = Math.floor(enemy.y / cellSize);
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(enemy);
  }
  return { grid, enemies };
}

function getNeighborsForSeparation(enemy, grid, cellSize) {
  const cx = Math.floor(enemy.x / cellSize);
  const cy = Math.floor(enemy.y / cellSize);
  const out = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const key = `${cx + dx},${cy + dy}`;
      const list = grid.get(key);
      if (list) {
        for (let i = 0; i < list.length; i += 1) out.push(list[i]);
      }
    }
  }
  return out;
}

export function moveEnemiesTowardsPlayer(scene, builtOrGrid = null) {
  const player = scene.player;
  if (!player) return;

  const cellSize = GRID_CELL_SIZE;
  let grid;
  let enemies;
  if (builtOrGrid && builtOrGrid.grid && Array.isArray(builtOrGrid.enemies)) {
    grid = builtOrGrid.grid;
    enemies = builtOrGrid.enemies;
  } else if (builtOrGrid && typeof builtOrGrid.get === "function") {
    grid = builtOrGrid;
    enemies = scene.enemies ? scene.enemies.getChildren() : [];
  } else {
    const built = buildEnemyGrid(scene, cellSize);
    grid = built.grid;
    enemies = built.enemies;
  }

  for (let idx = 0; idx < enemies.length; idx += 1) {
    const enemy = enemies[idx];
    if (!enemy || !enemy.active) continue;

    const knockUntil = enemy.getData("knockbackUntil") || 0;
    if ((scene.elapsedTime || 0) < knockUntil) {
      const dirX = enemy.getData("knockbackDirX") || 0;
      const dirY = enemy.getData("knockbackDirY") || 0;
      const kbSpeed = enemy.getData("knockbackSpeed") || 140;
      enemy.setVelocity(dirX * kbSpeed, dirY * kbSpeed);
      continue;
    }

    const speed = enemy.getData("speed") || 60;
    let speedScale = 1;
    const type = enemy.getData("type") || "grunt";
    const behaviorRaw = enemy.getData("behavior");
    const behavior =
      behaviorRaw ||
      (type === "shooter" ? "shooter_behavior" : "monsters_behavior");

    const baseAngle = Phaser.Math.Angle.Between(
      enemy.x,
      enemy.y,
      player.x,
      player.y
    );

    // 기본 진행 방향 벡터 (정규화)
    let dirX;
    let dirY;

    if (behavior === "shooter_behavior" && type === "shooter") {
      const dist = Phaser.Math.Distance.Between(
        enemy.x,
        enemy.y,
        player.x,
        player.y
      );
      const desiredMin = 220;
      const desiredMax = 320;

      if (dist < desiredMin * 0.85) {
        // 너무 가까우면 뒤로 빠지기
        dirX = -Math.cos(baseAngle);
        dirY = -Math.sin(baseAngle);
      } else if (dist > desiredMax * 1.1) {
        // 너무 멀면 살짝 다가가기
        dirX = Math.cos(baseAngle);
        dirY = Math.sin(baseAngle);
      } else {
        // 적당한 거리: 선호 각도로 원 위를 이동해 다른 슈터와 위치가 흩어지게
        const currentAngle = Phaser.Math.Angle.Wrap(baseAngle + Math.PI);
        const preferred = enemy.getData("preferredAngle") ?? currentAngle;
        let diff = Phaser.Math.Angle.Wrap(preferred - currentAngle);
        const tangentSign = diff > 0 ? 1 : -1;
        const tangentWeight = 0.65;
        dirX = tangentSign * -Math.sin(currentAngle) * tangentWeight;
        dirY = tangentSign * Math.cos(currentAngle) * tangentWeight;
      }

      const now = scene.elapsedTime || 0;
      const nextShotAt = enemy.getData("nextShotAt") || 0;
      if (now >= nextShotAt) {
        fireRangedShot(scene, enemy, player);
        const difficulty = scene.enemyDifficultyFactor || 1;
        const baseCd = 2.4;
        const minCd = 1.1;
        const cd = Math.max(minCd, baseCd - 0.12 * (difficulty - 1));
        enemy.setData("nextShotAt", now + cd);
      }
    } else {
      if (behavior === "monsters_behavior") {
        const distToPlayer = Phaser.Math.Distance.Between(
          enemy.x,
          enemy.y,
          player.x,
          player.y
        );
        const aggroRadius = enemy.getData("monsters_behaviorAggroRadius") || 260;
        let monsters_behaviorAggro = enemy.getData("monsters_behaviorAggro");

        if (!monsters_behaviorAggro && distToPlayer <= aggroRadius) {
          monsters_behaviorAggro = true;
          enemy.setData("monsters_behaviorAggro", true);
        }

        if (monsters_behaviorAggro) {
          // aggro 상태: 플레이어를 향해 직선 추적
          dirX = Math.cos(baseAngle);
          dirY = Math.sin(baseAngle);
        } else {
          // 평시 로밍: 천천히 방향이 변하는 랜덤 배회
          let roamAngle = enemy.getData("monsters_behaviorRoamAngle");
          if (typeof roamAngle !== "number") {
            roamAngle = Math.random() * Math.PI * 2;
          }
          const jitter = Phaser.Math.FloatBetween(-0.08, 0.08);
          roamAngle += jitter;
          enemy.setData("monsters_behaviorRoamAngle", roamAngle);

          dirX = Math.cos(roamAngle);
          dirY = Math.sin(roamAngle);

          // 로밍 시에는 체감 속도를 낮춰 난이도 완화
          speedScale = 0.55;
        }
      } else {
        // 예외 상황 fallback: 단순 추적
        dirX = Math.cos(baseAngle);
        dirY = Math.sin(baseAngle);
      }
    }

    // --- 집단 행동: 주변 적과의 간격을 벌려 큰 무리 뭉침 완화 (separation, 그리드 기반 O(n×k)) ---
    let sepX = 0;
    let sepY = 0;
    let sepCount = 0;
    const separationRadius = 72;
    const separationRadiusSq = separationRadius * separationRadius;
    const neighbors = getNeighborsForSeparation(enemy, grid, cellSize);
    for (let i = 0; i < neighbors.length; i += 1) {
      const other = neighbors[i];
      if (!other || other === enemy || !other.active) continue;
      const dx = enemy.x - other.x;
      const dy = enemy.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < separationRadiusSq) {
        const dist = Math.sqrt(distSq) || 1;
        sepX += dx / dist;
        sepY += dy / dist;
        sepCount += 1;
      }
    }

    let finalDirX = dirX;
    let finalDirY = dirY;

    if (sepCount > 0) {
      const lenSep = Math.sqrt(sepX * sepX + sepY * sepY) || 1;
      const normSepX = sepX / lenSep;
      const normSepY = sepY / lenSep;

      // separation 가중치: 적당히 퍼지게 (뭉침 완화)
      const w = 0.9;
      finalDirX += normSepX * w;
      finalDirY += normSepY * w;

      const lenFinal = Math.sqrt(
        finalDirX * finalDirX + finalDirY * finalDirY
      ) || 1;
      finalDirX /= lenFinal;
      finalDirY /= lenFinal;
    }

    // 슈터 전용: 반경 96 내 다른 슈터와만 추가 separation으로 흩어져 다양한 위치에서 포격
    if (type === "shooter") {
      let shSepX = 0;
      let shSepY = 0;
      let shCount = 0;
      const shooterSepRadius = 96;
      const shooterSepRadiusSq = shooterSepRadius * shooterSepRadius;
      for (let i = 0; i < neighbors.length; i += 1) {
        const other = neighbors[i];
        if (!other || other === enemy || !other.active) continue;
        if (other.getData && other.getData("type") !== "shooter") continue;
        const dx = enemy.x - other.x;
        const dy = enemy.y - other.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0 && distSq < shooterSepRadiusSq) {
          const dist = Math.sqrt(distSq) || 1;
          shSepX += dx / dist;
          shSepY += dy / dist;
          shCount += 1;
        }
      }
      if (shCount > 0) {
        const lenSh = Math.sqrt(shSepX * shSepX + shSepY * shSepY) || 1;
        const shW = 1.2;
        finalDirX += (shSepX / lenSh) * shW;
        finalDirY += (shSepY / lenSh) * shW;
        const lenFinal = Math.sqrt(
          finalDirX * finalDirX + finalDirY * finalDirY
        ) || 1;
        finalDirX /= lenFinal;
        finalDirY /= lenFinal;
      }
    }

    const effectiveSpeed = speed * speedScale;
    const vx = finalDirX * effectiveSpeed;
    const vy = finalDirY * effectiveSpeed;

    enemy.setVelocity(vx, vy);

    if (USE_PIXEL_SPRITES && enemy.texture && enemy.texture.key === "entities") {
      const isMoving = vx !== 0 || vy !== 0;
      const prevDir =
        typeof enemy.getData("dirIndex") === "number"
          ? enemy.getData("dirIndex")
          : 4;

      let dirIndex = prevDir;
      if (isMoving) {
        dirIndex = getDirIndexFromVector(vx, vy, prevDir);
      }

      enemy.setData("dirIndex", dirIndex);

      const entityIndex = enemy.getData("entityIndex");
      if (typeof entityIndex === "number" && enemy.setFrame) {
        const frame = getFrameIndex(entityIndex, dirIndex);
        enemy.setFrame(frame);
      }
    }
  }
}

export function onEnemyHitByEnemyProjectile(scene, enemy, proj) {
  if (!scene || !enemy || !proj) return;
  if (!enemy.active || !proj.active) return;

  // 자신의 탄(발사한 슈터 본인)과의 충돌은 무시
  if (proj.getData && proj.getData("sourceEnemy") === enemy) {
    return;
  }

  // 발사체는 한 번 충돌 후 바로 제거
  if (proj.destroy) {
    proj.destroy();
  }

  // 적이 이미 넉백 중이면 추가 넉백은 무시(난이도 과도 상승 방지)
  const now = scene.elapsedTime || 0;
  const existingUntil = enemy.getData("knockbackUntil") || 0;
  if (now < existingUntil) return;

  let dirX = 0;
  let dirY = 0;

  // 가능하면 발사체의 속도 방향을 기준으로 넉백 방향을 정한다.
  const body = proj.body;
  if (body && typeof body.velocity === "object") {
    const vx = body.velocity.x || 0;
    const vy = body.velocity.y || 0;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    dirX = vx / len;
    dirY = vy / len;
  } else {
    // fallback: 발사체 위치 → 적 위치 방향
    const dx = enemy.x - proj.x;
    const dy = enemy.y - proj.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dirX = dx / len;
    dirY = dy / len;
  }

  // 체력은 줄이지 않고, 짧은 넉백만 적용
  const kbSpeed = 140;
  const duration = 0.12;
  enemy.setData("knockbackDirX", dirX);
  enemy.setData("knockbackDirY", dirY);
  enemy.setData("knockbackSpeed", kbSpeed);
  enemy.setData("knockbackUntil", now + duration);
}

export function applyDamage(scene, enemy, damage, isCritical = false) {
  if (!enemy || !enemy.active) return false;

  const currentHp =
    enemy.getData("hp") ?? enemy.getData("maxHp") ?? 1;

  const nextHp = currentHp - (damage || 0);
  enemy.setData("hp", nextHp);

  // 피격 데미지 숫자 표시 (플로팅 텍스트) — 크리티컬 시 굵고 진한 스타일
  if (damage && scene && scene.add && scene.tweens) {
    const dmgValue = Math.round(damage);
    const style = isCritical
      ? {
          fontFamily: "Mulmaru",
          fontSize: "18px",
          fill: "#ff5722",
          stroke: "#bf360c",
          strokeThickness: 3,
        }
      : {
          fontFamily: "Mulmaru",
          fontSize: "14px",
          fill: "#ffeb3b",
          stroke: "#000000",
          strokeThickness: 3,
        };
    const dmgText = scene.add
      .text(enemy.x, enemy.y - 18, `${dmgValue}`, style)
      .setOrigin(0.5)
      .setDepth(50);

    scene.tweens.add({
      targets: dmgText,
      y: dmgText.y - (isCritical ? 32 : 24),
      alpha: 0,
      duration: isCritical ? 650 : 500,
      ease: "Cubic.easeOut",
      onComplete: () => dmgText.destroy(),
    });
  }

  // 피격 이펙트 (생존 시 작은 이펙트, 사망 시 큰 이펙트)
  if (scene.hitEmitter) {
    const count = nextHp <= 0 ? 14 : 5;
    scene.hitEmitter.explode(count, enemy.x, enemy.y);
  }

  if (nextHp <= 0) {
    enemy.destroy();
    return true;
  }

  return false;
}

/** 적 투사체 만료: expireAt 데이터 기반 제거 */
export function updateEnemyProjectilesExpiry(scene, now) {
  if (!scene.enemyProjectiles) return;
  scene.enemyProjectiles.children.iterate((proj) => {
    if (!proj || !proj.active) return;
    if (!proj.getData) return;
    const expireAt =
      typeof proj.getData("expireAt") === "number"
        ? proj.getData("expireAt")
        : null;
    if (expireAt != null && now >= expireAt && proj.destroy) {
      proj.destroy();
    }
  });
}
