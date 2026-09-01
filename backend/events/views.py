import hashlib
import hmac
import json
import secrets

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from accounts.models import EventConsent
from .models import EventRun
from .services import CONSENT_VERSION, MAX_RUN_SECONDS, event_status, make_ticket, ranking_rows, refresh_prizes, state_hash


def _json(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None


def _event_account(request):
    if not request.user.is_authenticated or not hasattr(request.user, "google_account"):
        return None
    return request.user.google_account


def _serialize_status(request):
    info = event_status()
    account = _event_account(request)
    return {
        "status": info["status"],
        "consent_version": CONSENT_VERSION,
        "starts_at": info["event"].starts_at.isoformat() if info["event"] else None,
        "ends_at": info["event"].ends_at.isoformat() if info["event"] else None,
        "entry_closes_at": info["entry_closes_at"].isoformat() if info["entry_closes_at"] else None,
        "max_play_seconds": MAX_RUN_SECONDS,
        "authenticated": bool(account),
        "nickname": account.event_nickname if account else None,
        "consented": bool(account and EventConsent.objects.filter(user=request.user, version=CONSENT_VERSION).exists()),
        "game_ws_url": settings.EVENT_GAME_WS_URL,
    }


@ensure_csrf_cookie
@require_GET
def current(request):
    data = _serialize_status(request)
    data["signup_required"] = bool(request.session.get("google_pending_claims"))
    return JsonResponse(data)


@require_POST
def accept_consent(request):
    account = _event_account(request)
    if not account:
        return JsonResponse({"detail": "Google login is required."}, status=401)
    EventConsent.objects.get_or_create(user=request.user, version=CONSENT_VERSION)
    return JsonResponse({"ok": True, "version": CONSENT_VERSION})


@require_POST
def create_entry(request):
    account = _event_account(request)
    if not account:
        return JsonResponse({"detail": "Google login is required."}, status=401)
    info = event_status()
    if info["status"] != "open":
        return JsonResponse({"detail": "The event is currently unavailable.", "status": info["status"]}, status=409)
    if timezone.now() > info["entry_closes_at"]:
        return JsonResponse({"detail": "New event entry has closed."}, status=409)
    if not EventConsent.objects.filter(user=request.user, version=CONSENT_VERSION).exists():
        return JsonResponse({"detail": "Event consent is required."}, status=403)
    run = EventRun.objects.filter(event=info["event"], user=request.user, status=EventRun.Status.ACTIVE).first()
    if run is None:
        run = EventRun.objects.create(
            event=info["event"], user=request.user, started_at=timezone.now(),
            seed=secrets.token_hex(32),
        )
    try:
        ticket = make_ticket(run)
    except RuntimeError as exc:
        return JsonResponse({"detail": str(exc)}, status=503)
    return JsonResponse({"run_id": str(run.id), "ticket": ticket, "ws_url": settings.EVENT_GAME_WS_URL, "max_play_seconds": MAX_RUN_SECONDS})


@require_GET
def leaderboard(request):
    info = event_status()
    event = info["event"]
    if event is None:
        return JsonResponse({"high_score": [], "aggregate": []})
    data = {}
    for kind in ("high_score", "aggregate"):
        data[kind] = [
            {"rank": index + 1, "nickname": row["user"].google_account.event_nickname, "score": row["score"], "achieved_at": row["achieved_at"].isoformat()}
            for index, row in enumerate(ranking_rows(event, kind, limit=20))
        ]
    return JsonResponse(data)


def _internal_valid(request):
    if not settings.EVENT_INTERNAL_SECRET:
        return False
    signature = request.headers.get("X-Event-Signature", "")
    expected = hmac.new(settings.EVENT_INTERNAL_SECRET.encode(), request.body, hashlib.sha256).hexdigest()
    return secrets.compare_digest(signature, expected)


@csrf_exempt
@require_POST
def finalize_run(request):
    if not _internal_valid(request):
        return JsonResponse({"detail": "Unauthorized event server."}, status=401)
    payload = _json(request)
    if not payload:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)
    try:
        run = EventRun.objects.select_related("event").get(id=payload["run_id"])
    except (EventRun.DoesNotExist, KeyError, ValueError):
        return JsonResponse({"detail": "Unknown run."}, status=404)
    if run.status != EventRun.Status.ACTIVE:
        return JsonResponse({"ok": True, "status": run.status, "idempotent": True})
    score = max(0, int(payload.get("score", 0)))
    play_seconds = min(MAX_RUN_SECONDS, max(0.0, float(payload.get("play_seconds", 0))))
    run.score = score
    run.play_seconds = play_seconds
    run.is_clear = bool(payload.get("is_clear", False))
    run.pause_used = bool(payload.get("pause_used", False))
    run.final_state_hash = state_hash(payload.get("state", {}))
    run.finished_at = timezone.now()
    run.status = EventRun.Status.FINISHED
    run.save(update_fields=["score", "play_seconds", "is_clear", "pause_used", "final_state_hash", "finished_at", "status"])
    refresh_prizes(run.event)
    return JsonResponse({"ok": True, "score": run.score})
