from django.contrib import admin
from django.utils import timezone

from .models import Event, EventPrize, EventRun
from .services import refresh_prizes


@admin.action(description="Hold selected records")
def hold_runs(modeladmin, request, queryset):
    queryset.update(status=EventRun.Status.HELD)
    for event in Event.objects.filter(runs__in=queryset).distinct():
        refresh_prizes(event)


@admin.action(description="Invalidate selected records")
def invalidate_runs(modeladmin, request, queryset):
    queryset.update(status=EventRun.Status.INVALID)
    for event in Event.objects.filter(runs__in=queryset).distinct():
        refresh_prizes(event)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("starts_at", "ends_at", "created_at")
    actions = ["refresh_selected_prizes"]

    @admin.action(description="Refresh prize candidates")
    def refresh_selected_prizes(self, request, queryset):
        for event in queryset:
            refresh_prizes(event)


@admin.register(EventRun)
class EventRunAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "user", "status", "score", "play_seconds", "is_clear", "finished_at")
    list_filter = ("status", "is_clear", "event")
    search_fields = ("user__google_account__event_nickname", "user__google_account__email")
    actions = [hold_runs, invalidate_runs]


@admin.register(EventPrize)
class EventPrizeAdmin(admin.ModelAdmin):
    list_display = ("event", "category", "user", "score", "email_snapshot", "delivery_status", "sent_at")
    list_filter = ("category", "delivery_status")
    search_fields = ("user__google_account__event_nickname", "email_snapshot")
    actions = ["mark_sent"]

    @admin.action(description="Mark selected prizes as sent")
    def mark_sent(self, request, queryset):
        queryset.update(delivery_status=EventPrize.DeliveryStatus.SENT, sent_at=timezone.now())
