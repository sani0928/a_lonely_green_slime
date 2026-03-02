from django.db import models


class PlayLog(models.Model):
    anonymous_id = models.CharField(max_length=64, db_index=True)
    run_id = models.CharField(max_length=64, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    play_seconds = models.FloatField(default=0)
    contact_hits = models.PositiveIntegerField(default=0)
    projectile_hits = models.PositiveIntegerField(default=0)
    shooter_contact_hits = models.PositiveIntegerField(default=0)
    shooter_projectile_hits = models.PositiveIntegerField(default=0)
    kills_total = models.PositiveIntegerField(default=0)
    final_score = models.IntegerField(default=0)
    is_clear = models.BooleanField(default=False)
    snapshots = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["anonymous_id", "run_id"],
                name="unique_playlog_anonymous_run",
            )
        ]
