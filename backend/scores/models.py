from django.db import models


class Score(models.Model):
    nickname = models.CharField(max_length=32)
    score = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "-created_at"]
