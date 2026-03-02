/** 충돌 오버랩 등록 (bullet-enemy, player-enemy, player-projectile, enemyProjectile-enemy, player-item, player-coin) */
import * as UpgradeSystem from "./upgradeSystem.js";
import * as PlayerSystem from "./playerSystem.js";
import * as EnemySystem from "./enemySystem.js";

export function registerCollisions(scene) {
  scene.physics.add.overlap(
    scene.bullets,
    scene.enemies,
    (bullet, enemy) => UpgradeSystem.onBulletHitEnemy(scene, bullet, enemy)
  );
  scene.physics.add.overlap(
    scene.player,
    scene.enemies,
    (player, enemy) => PlayerSystem.onPlayerHitByEnemy(scene, player, enemy)
  );
  scene.physics.add.overlap(
    scene.player,
    scene.enemyProjectiles,
    (player, proj) => PlayerSystem.onPlayerHitByEnemy(scene, player, proj)
  );
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
