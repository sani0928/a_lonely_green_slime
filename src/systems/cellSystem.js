import { hasBadge } from "./badgeSystem.js";

const POOL_MAX_CELLS = 24;

export function initCellProjectiles(scene) {
  // 실제 활성 최대 탄환 수(업그레이드/뱃지로 증가)는 이 풀 크기 이하로만 사용
  const max = POOL_MAX_CELLS;
  const player = scene.player;

  // 탄환 본체 생성
  for (let i = 0; i < max; i += 1) {
    const b = scene.bullets.create(player.x, player.y, "bullet");
    b.setScale(1);
    b.setImmovable(true);
    b.body.allowGravity = false;
    b.setCircle(3);
    // 플레이어 슬라임과 동일한 계열의 초록색 틴트
    b.setTint(0x46d278);
  }

  // Phaser 3.60+ 파티클 Emitter (단일 emitter를 수동으로 사용)
  // https://docs.phaser.io/docs/3.70.0/aec244b7f7b45159.html
  scene.cellEmitter = scene.add.particles(0, 0, "bullet", {
    speed: 0,
    scale: { start: 1, end: 0 },
    alpha: { start: 0.4, end: 0 },
    lifespan: 180,
    quantity: 1,
    frequency: -1, // 자동 방출 없음, 수동 emit만 사용
    tint: { start: 0x46d278, end: 0x46d278 },
  });
}

/** 킬 수에 따라 활성 탄환 수 갱신. getNextCellKillThreshold와 동일한 step(50)·threshold 공식 사용 */
export function updateCellCountByKills(scene) {
  let count = scene.cellBaseCount;
  const maxCount = scene.cellMaxCount;
  const kills = scene.killCount || 0;

  let step = 50;
  let threshold = 50;

  while (kills >= threshold && count < maxCount) {
    count += 1;
    step += 50;
    threshold += step;
  }

  scene.cellActiveCount = count;
}

/** 다음 셀 개방까지 필요한 킬 수. updateCellCountByKills와 동일 공식 */
export function getNextCellKillThreshold(scene) {
  let count = scene.cellBaseCount;
  const maxCount = scene.cellMaxCount;
  const kills = scene.killCount || 0;

  let step = 50;
  let threshold = 50;

  while (kills >= threshold && count < maxCount) {
    count += 1;
    step += 50;
    threshold += step;
  }

  if (count >= maxCount) {
    return null;
  }

  return threshold;
}

const LOCK_ON_RADIUS = 280;
const HOMING_SPEED = 320;
const RETURN_SPEED = 440;
const RETURN_SNAP_DIST = 24;
/** buildEnemyGrid와 동일한 셀 크기 (근처 셀만 검사할 때 사용) */
const GRID_CELL_SIZE = 64;

function iterateEnemiesInRange(x, y, radius, grid, cellSize, callback) {
  const r = radius;
  const cxMin = Math.floor((x - r) / cellSize);
  const cxMax = Math.floor((x + r) / cellSize);
  const cyMin = Math.floor((y - r) / cellSize);
  const cyMax = Math.floor((y + r) / cellSize);
  const radiusSq = radius * radius;
  for (let cx = cxMin; cx <= cxMax; cx += 1) {
    for (let cy = cyMin; cy <= cyMax; cy += 1) {
      const list = grid.get(`${cx},${cy}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i += 1) {
        const enemy = list[i];
        if (!enemy || !enemy.active) continue;
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        if (dx * dx + dy * dy <= radiusSq) callback(enemy);
      }
    }
  }
}

function getNearestEnemyInRange(scene, x, y, grid = null) {
  if (!scene.enemies) return null;

  const preferShooter = hasBadge(scene, "shooter_hunter");
  let nearest = null;
  let nearestDistSq = LOCK_ON_RADIUS * LOCK_ON_RADIUS;

  const checkEnemy = (enemy) => {
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = enemy;
    }
  };

  if (grid && typeof grid.get === "function") {
    // 그리드 기반: (x,y) 반경 LOCK_ON_RADIUS 내 셀만 검사
    if (preferShooter) {
      iterateEnemiesInRange(
        x,
        y,
        LOCK_ON_RADIUS,
        grid,
        GRID_CELL_SIZE,
        (enemy) => {
          if (enemy.getData("type") === "shooter") checkEnemy(enemy);
        }
      );
      if (nearest) return nearest;
      nearestDistSq = LOCK_ON_RADIUS * LOCK_ON_RADIUS;
    }
    iterateEnemiesInRange(x, y, LOCK_ON_RADIUS, grid, GRID_CELL_SIZE, checkEnemy);
    return nearest;
  }

  // 그리드 없음: 기존 전 적 순회
  if (preferShooter) {
    scene.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      if (enemy.getData("type") !== "shooter") return;
      checkEnemy(enemy);
    });
    if (nearest) return nearest;
    nearestDistSq = LOCK_ON_RADIUS * LOCK_ON_RADIUS;
  }
  scene.enemies.children.iterate((enemy) => {
    if (!enemy || !enemy.active) return;
    checkEnemy(enemy);
  });
  return nearest;
}

export function returnBulletToCell(scene, bullet) {
  if (!bullet || !bullet.body) return;
  bullet.setData("homing", false);
  bullet.setData("targetRef", null);
   // 체인 공격 상태 초기화
  bullet.setData("chainCount", 0);
  bullet.setData("returning", true);
  bullet.setActive(true);
  bullet.setVisible(true);
  // 위치는 그대로 두고, updateCellProjectiles에서 셀 방향으로 속도만 줄 것
}

export function updateCellProjectiles(scene, dt) {
  const player = scene.player;
  if (!player) return;

  scene.cellAngle += scene.cellRotationSpeed * dt;

  const activeCount =
    scene.cellActiveCount || scene.cellBaseCount || 4;

  const radius = scene.cellBaseRadius;

  const bullets = scene.bullets.getChildren();
  const max = bullets.length;

  for (let i = 0; i < max; i += 1) {
    const b = bullets[i];
    if (!b || !b.body) continue;

    if (i < activeCount) {
      // reset=true로 두면 매 프레임 body.reset(0,0) 호출되어 탄환이 (0,0)으로 날아가 사라짐 → false
      b.enableBody(false, 0, 0, true, true);
      b.setVisible(true);
      b.setActive(true);
      b.setData("cellIndex", i);

      // 현재 프레임 기준 궤도상 위치 계산
      const angle =
        scene.cellAngle + (i / activeCount) * Math.PI * 2;
      const cellX = player.x + Math.cos(angle) * radius;
      const cellY = player.y + Math.sin(angle) * radius;

      // 적 공격 후 궤도로 돌아오는 중: 플레이어 속도에 맞춰 복귀 속도 동기화
      if (b.getData("returning")) {
        const dx = cellX - b.x;
        const dy = cellY - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist <= RETURN_SNAP_DIST) {
          b.setData("returning", false);
          b.setVelocity(0, 0);
          b.x = cellX;
          b.y = cellY;
        } else {
          const playerSpeed = scene.playerSpeed ?? scene.basePlayerSpeed ?? 220;
          const returnSpeedCap = Math.max(RETURN_SPEED, playerSpeed * 1.6);
          const speed = Math.min(returnSpeedCap, dist * 8);
          b.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        }
        if (scene.cellEmitter) {
          scene.cellEmitter.emitParticleAt(b.x, b.y);
        }
        continue;
      }

      if (b.getData("homing")) {
        const target = b.getData("targetRef");
        if (!target || !target.active) {
          b.setData("homing", false);
          b.setData("targetRef", null);
        } else {
          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          b.setVelocity((dx / len) * HOMING_SPEED, (dy / len) * HOMING_SPEED);
          if (scene.cellEmitter) {
            scene.cellEmitter.emitParticleAt(b.x, b.y);
          }
          continue;
        }
      }

      // 플레이어 주변(셀 궤도 중심) 기준으로 적 탐색
      const nearest = getNearestEnemyInRange(
        scene,
        cellX,
        cellY,
        scene._enemyGrid || null
      );
      if (nearest) {
        b.setData("homing", true);
        b.setData("targetRef", nearest);
        // 발사 시점에는 셀 궤도 위치에서 출발하도록 좌표를 맞춰줌
        b.x = cellX;
        b.y = cellY;
        const dx = nearest.x - cellX;
        const dy = nearest.y - cellY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        b.setVelocity((dx / len) * HOMING_SPEED, (dy / len) * HOMING_SPEED);
        if (scene.cellEmitter) {
          scene.cellEmitter.emitParticleAt(b.x, b.y);
        }
        continue;
      }

      b.setVelocity(0, 0);
      b.x = cellX;
      b.y = cellY;

      if (scene.cellEmitter) {
        scene.cellEmitter.emitParticleAt(b.x, b.y);
      }
    } else {
      // 활성 궤도 수보다 인덱스가 큰 탄환은 기본적으로 비활성화하되,
      // 유도 중이거나 궤도로 복귀 중인 탄환은 유지
      if (b.getData("homing") || b.getData("returning")) {
        continue;
      }
      b.disableBody(true, true);
    }
  }
}
