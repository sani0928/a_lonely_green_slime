from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("scores", "0003_scoreattempt"),
    ]

    operations = [
        migrations.AddField(
            model_name="scoreattempt",
            name="play_seconds",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
