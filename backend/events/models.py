import uuid

from django.conf import settings
from django.db import models


class Event(models.Model):
    starts_at = models.DateTimeField(unique=True)
    ends_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-starts_at"]

    def __str__(self):
        return f"Weekly event {self.starts_at:%Y-%m-%d}"


class EventRun(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        FINISHED = "finished", "Finished"
        HELD = "held", "Held"
        INVALID = "invalid", "Invalid"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="runs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="event_runs")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE, db_index=True)
    started_at = models.DateTimeField()
    finished_at = models.DateTimeField(null=True, blank=True, db_index=True)
    score = models.IntegerField(default=0, db_index=True)
    play_seconds = models.FloatField(default=0)
    is_clear = models.BooleanField(default=False)
    pause_used = models.BooleanField(default=False)
    seed = models.CharField(max_length=64)
    final_state_hash = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-score", "finished_at"]
        indexes = [
            models.Index(fields=["event", "user", "status"]),
            models.Index(fields=["event", "status", "-score", "finished_at"]),
        ]

    def __str__(self):
        return f"{self.event_id}:{self.user_id}:{self.score}"


class EventPrize(models.Model):
    class Category(models.TextChoices):
        HIGH_SCORE = "high_score", "Highest single score"
        AGGREGATE = "aggregate", "Highest total score"

    class DeliveryStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        CANCELLED = "cancelled", "Cancelled"

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="prizes")
    category = models.CharField(max_length=16, choices=Category.choices)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    score = models.IntegerField(default=0)
    email_snapshot = models.EmailField(blank=True)
    delivery_status = models.CharField(max_length=12, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING)
    selected_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    email_delete_after = models.DateTimeField(null=True, blank=True)
    admin_note = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["event", "category"], name="unique_event_prize_category"),
        ]

    def __str__(self):
        return f"{self.event_id}:{self.category}"
