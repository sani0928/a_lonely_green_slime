from django.db import migrations, models


def copy_created_at_to_last_played_at(apps, schema_editor):
    Score = apps.get_model("scores", "Score")
    for score in Score.objects.all().only("id", "created_at"):
        score.last_played_at = score.created_at
        score.save(update_fields=["last_played_at"])


class Migration(migrations.Migration):

    dependencies = [
        ("scores", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="score",
            name="last_played_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(copy_created_at_to_last_played_at, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="score",
            name="last_played_at",
            field=models.DateTimeField(auto_now=True, db_index=True),
        ),
        migrations.AlterModelOptions(
            name="score",
            options={"ordering": ["-score", "-last_played_at"]},
        ),
    ]
