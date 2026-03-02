from django.contrib import admin

from .models import PlayLog


@admin.register(PlayLog)
class PlayLogAdmin(admin.ModelAdmin):
    @staticmethod
    def snapshots_count(obj):
        return len(obj.snapshots or [])

    list_display = (
        "anonymous_id",
        "run_id",
        "play_seconds",
        "contact_hits",
        "projectile_hits",
        "snapshots_count",
        "kills_total",
        "final_score",
        "is_clear",
        "created_at",
    )
    list_filter = ("is_clear", "created_at")
    search_fields = ("anonymous_id", "run_id")
