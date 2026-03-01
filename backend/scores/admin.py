from django.contrib import admin
from .models import Score


@admin.register(Score)
class ScoreAdmin(admin.ModelAdmin):
    list_display = ("nickname", "score", "created_at")
    list_filter = ("created_at",)
