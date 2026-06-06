from django.db import models


class Score(models.Model):
    nickname = models.CharField(max_length=32)
    score = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    last_played_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ["-score", "-last_played_at"]


class ScoreAttempt(models.Model):
    nickname = models.CharField(max_length=32, db_index=True)
    score = models.IntegerField(db_index=True)
    play_seconds = models.FloatField(null=True, blank=True)
    played_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-score", "-played_at"]
        indexes = [
            models.Index(fields=["played_at", "-score"]),
            models.Index(fields=["nickname", "played_at"]),
        ]
