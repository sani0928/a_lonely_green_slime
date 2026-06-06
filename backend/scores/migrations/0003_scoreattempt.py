from django.db import migrations, models


def seed_score_attempts(apps, schema_editor):
    Score = apps.get_model("scores", "Score")
    ScoreAttempt = apps.get_model("scores", "ScoreAttempt")
    attempts = [
        ScoreAttempt(
            nickname=score.nickname,
            score=score.score,
            played_at=getattr(score, "last_played_at", None) or score.created_at,
        )
        for score in Score.objects.all().only("nickname", "score", "created_at", "last_played_at")
    ]
    ScoreAttempt.objects.bulk_create(attempts, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ("scores", "0002_score_last_played_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="ScoreAttempt",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nickname", models.CharField(db_index=True, max_length=32)),
                ("score", models.IntegerField(db_index=True)),
                ("played_at", models.DateTimeField(auto_now_add=True, db_index=True)),
            ],
            options={
                "ordering": ["-score", "-played_at"],
                "indexes": [
                    models.Index(fields=["played_at", "-score"], name="scores_scor_played__bea7b6_idx"),
                    models.Index(fields=["nickname", "played_at"], name="scores_scor_nicknam_ef7450_idx"),
                ],
            },
        ),
        migrations.RunPython(seed_score_attempts, migrations.RunPython.noop),
    ]
