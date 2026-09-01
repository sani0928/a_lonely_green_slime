import hashlib
import json
import secrets
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from redis import Redis

from accounts.models import GoogleAccount
from .models import Event, EventPrize, EventRun


KST = ZoneInfo("Asia/Seoul")
CONSENT_VERSION = "event-v1"
MAX_RUN_SECONDS = 60 * 60
ENTRY_CLOSE_OFFSET = timedelta(hours=1)
TICKET_TTL_SECONDS = 60


def current_window(now=None):
    now = now or timezone.now()
    local = now.astimezone(KST)
    # Sunday before 06:00 is the weekly maintenance window.
    if local.weekday() == 6 and local.time() < time(6, 0):
        return None, "maintenance"
    days_since_sunday = (local.weekday() + 1) % 7
    start_date = local.date() - timedelta(days=days_since_sunday)
    starts_at = datetime.combine(start_date, time(6, 0), tzinfo=KST)
    ends_at = datetime.combine(start_date + timedelta(days=6), time(23, 59, 59), tzinfo=KST)
    if not starts_at <= local <= ends_at:
        return None, "closed"
    event, _ = Event.objects.get_or_create(starts_at=starts_at, defaults={"ends_at": ends_at})
    return event, "open"


def event_status(now=None):
    event, status = current_window(now)
    if event is None:
        return {"status": status, "event": None, "entry_closes_at": None}
    return {
        "status": "open",
        "event": event,
        "entry_closes_at": event.ends_at - ENTRY_CLOSE_OFFSET,
    }


def redis_client():
    if not settings.EVENT_REDIS_URL:
        raise RuntimeError("EVENT_REDIS_URL is required for event play.")
    return Redis.from_url(settings.EVENT_REDIS_URL, decode_responses=True)


def make_ticket(run):
    token = secrets.token_urlsafe(48)
    payload = json.dumps({"run_id": str(run.id), "user_id": run.user_id, "event_id": run.event_id, "seed": run.seed})
    redis_client().set(f"event:ticket:{token}", payload, ex=TICKET_TTL_SECONDS, nx=True)
    return token


def valid_runs(event):
    return EventRun.objects.filter(event=event, status=EventRun.Status.FINISHED)


def ranking_rows(event, kind, limit=100, excluded_user_ids=None):
    excluded_user_ids = set(excluded_user_ids or [])
    rows = {}
    for run in valid_runs(event).select_related("user__google_account"):
        if run.user_id in excluded_user_ids:
            continue
        current = rows.get(run.user_id)
        if kind == "high_score":
            if current is None or (-run.score, run.finished_at) < (-current["score"], current["achieved_at"]):
                rows[run.user_id] = {"user": run.user, "score": run.score, "achieved_at": run.finished_at}
        else:
            if current is None:
                rows[run.user_id] = {"user": run.user, "score": 0, "achieved_at": run.finished_at}
            rows[run.user_id]["score"] += run.score
            rows[run.user_id]["achieved_at"] = max(rows[run.user_id]["achieved_at"], run.finished_at)
    return sorted(rows.values(), key=lambda row: (-row["score"], row["achieved_at"]))[:limit]


@transaction.atomic
def refresh_prizes(event):
    high = ranking_rows(event, "high_score", limit=1)
    high_user_id = high[0]["user"].id if high else None
    aggregate = ranking_rows(event, "aggregate", limit=1, excluded_user_ids=[high_user_id] if high_user_id else [])
    selections = {
        EventPrize.Category.HIGH_SCORE: high[0] if high else None,
        EventPrize.Category.AGGREGATE: aggregate[0] if aggregate else None,
    }
    for category, row in selections.items():
        prize, _ = EventPrize.objects.select_for_update().get_or_create(event=event, category=category)
        if row is None:
            prize.user = None
            prize.score = 0
            prize.email_snapshot = ""
        else:
            account = row["user"].google_account
            prize.user = row["user"]
            prize.score = row["score"]
            prize.email_snapshot = account.email
            prize.selected_at = timezone.now()
            prize.email_delete_after = timezone.now() + timedelta(days=90)
        prize.save()
    return selections


def state_hash(payload):
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
