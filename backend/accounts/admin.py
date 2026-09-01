from django.contrib import admin

from .models import EventConsent, GoogleAccount


@admin.register(GoogleAccount)
class GoogleAccountAdmin(admin.ModelAdmin):
    list_display = ("event_nickname", "email", "email_verified", "updated_at")
    search_fields = ("event_nickname", "email", "google_sub")


@admin.register(EventConsent)
class EventConsentAdmin(admin.ModelAdmin):
    list_display = ("user", "version", "accepted_at")
    list_filter = ("version",)
