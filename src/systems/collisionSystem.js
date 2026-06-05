/** 충돌 오버랩 등록 (bullet-enemy, player-enemy, player-projectile, enemyProjectile-enemy, player-item, player-coin) */
import * as UpgradeSystem from "./upgradeSystem.js";
import * as PlayerSystem from "./playerSystem.js";
import * as EnemySystem from "./enemySystem.js";
import * as BossSystem from "./bossSystem.js";

export function registerCollisions(scene) {
  scene.physics.add.overlap(
    scene.bullets,
    scene.enemies,
    (bullet, enemy) => UpgradeSystem.onBulletHitEnemy(scene, bullet, enemy)
  );
  if (scene.bosses) {
    scene.physics.add.overlap(
      scene.bullets,
      scene.bosses,
      (bullet, boss) => BossSystem.onBulletHitBoss(scene, bullet, boss)
    );
  }
  scene.physics.add.overlap(
    scene.player,
    scene.enemies,
    (player, enemy) =>
      PlayerSystem.onPlayerHitByEnemy(scene, player, enemy, {
        source: "contact",
        isShooter: enemy?.getData?.("type") === "shooter",
      })
  );
  if (scene.bosses) {
    scene.physics.add.overlap(
      scene.player,
      scene.bosses,
      (player, boss) => BossSystem.onPlayerHitByBoss(scene, player, boss)
    );
  }
  scene.physics.add.overlap(
    scene.player,
    scene.enemyProjectiles,
    (player, proj) => {
      const sourceEnemy = proj?.getData?.("sourceEnemy");
      PlayerSystem.onPlayerHitByEnemy(scene, player, proj, {
        source: "projectile",
        isShooter:
          sourceEnemy?.getData?.("type") === "shooter",
      });
    }
  );
  if (scene.bossProjectiles) {
    scene.physics.add.overlap(
      scene.player,
      scene.bossProjectiles,
      (player, proj) => BossSystem.onPlayerHitByBossProjectile(scene, player, proj)
    );
  }
  scene.physics.add.overlap(
    scene.enemyProjectiles,
    scene.enemies,
    (proj, enemy) =>
      EnemySystem.onEnemyHitByEnemyProjectile(scene, enemy, proj)
  );
  scene.physics.add.overlap(
    scene.player,
    scene.items,
    (player, item) => UpgradeSystem.onPlayerPickupItem(scene, player, item)
  );
  scene.physics.add.overlap(
    scene.player,
    scene.coins,
    (player, coin) => UpgradeSystem.onPlayerPickupCoin(scene, player, coin)
  );
}
