from django.contrib import admin
from .models import Score, ScoreAttempt


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ("nickname", "score", "created_at", "last_played_at")
    list_filter = ("created_at", "last_played_at")


@admin.register(ScoreAttempt)
class ScoreAttemptAdmin(admin.ModelAdmin):
    list_display = ("nickname", "score", "play_seconds", "played_at")
    list_filter = ("played_at",)
    search_fields = ("nickname",)
