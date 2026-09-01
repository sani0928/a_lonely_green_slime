from django.conf import settings
from django.contrib.auth.models import User
from django.db import models


class GoogleAccount(models.Model):
    """Stable Google identity and the one-time event nickname."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="google_account")
    google_sub = models.CharField(max_length=255, unique=True)
    event_nickname = models.CharField(max_length=32, unique=True)
    email = models.EmailField()
    email_verified = models.BooleanField(default=False)
    nickname_locked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.event_nickname


class EventConsent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    version = models.CharField(max_length=32)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "version"], name="unique_event_consent_version"),
        ]
