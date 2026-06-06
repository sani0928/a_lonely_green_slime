from datetime import timedelta
import re

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Score, ScoreAttempt


PERIOD_DAYS = {"7d": 7, "30d": 30, "1y": 365}


def _generate_auto_player_nickname():
    """Generate the next PlayerN nickname for anonymous submissions."""
    qs = Score.objects.filter(nickname__startswith="Player").only("nickname")
    max_n = 0
    pattern = re.compile(r"^Player(\d+)$")
    for obj in qs:
        m = pattern.match(obj.nickname or "")
        if not m:
            continue
        try:
            n = int(m.group(1))
        except (TypeError, ValueError):
            continue
        if n > max_n:
            max_n = n
    return f"Player{max_n + 1}" if max_n > 0 else "Player1"


def _has_hangul(value: str):
    return any(
        "\u3131" <= ch <= "\u318e" or "\uac00" <= ch <= "\ud7a3"
        for ch in value
    )


def _validate_nickname(nickname: str):
    """
    Validate nickname length.

    Empty nickname and "Player" are handled by the caller as auto names.
    Korean nicknames are limited to 2-20 chars; others are 2-32 chars.
    """
    if not nickname or nickname == "Player":
        return None

    length = len(nickname)
    if length < 2:
        return "Nickname must be at least 2 characters."
    if _has_hangul(nickname) and length > 20:
        return "Korean nicknames must be 2-20 characters (including spaces)."
    if not _has_hangul(nickname) and length > 32:
        return "Nicknames must be 2-32 characters (including spaces)."
    return None


def _get_period_leaderboard(since, limit):
    attempts = (
        ScoreAttempt.objects.filter(played_at__gte=since)
        .only("nickname", "score", "play_seconds")
        .order_by("-score", "-played_at")
    )
    seen = set()
    data = []
    for attempt in attempts.iterator():
        if attempt.nickname in seen:
            continue
        seen.add(attempt.nickname)
        data.append(
            {
                "nickname": attempt.nickname,
                "score": attempt.score,
                "play_seconds": attempt.play_seconds,
            }
        )
        if len(data) >= limit:
            break
    return data


@api_view(["GET", "POST"])
def score_list(request):
    if request.method == "POST":
        raw_nickname = (request.data.get("nickname") or "").strip()
        try:
            score_val = max(0, int(request.data.get("score", 0)))
        except (TypeError, ValueError):
            score_val = 0
        try:
            raw_play_seconds = request.data.get("play_seconds", None)
            play_seconds = None if raw_play_seconds is None else max(0.0, float(raw_play_seconds))
        except (TypeError, ValueError):
            play_seconds = None

        if raw_nickname == "" or raw_nickname == "Player":
            nickname = _generate_auto_player_nickname()
        else:
            error = _validate_nickname(raw_nickname)
            if error:
                return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
            nickname = raw_nickname

        ScoreAttempt.objects.create(
            nickname=nickname,
            score=score_val,
            play_seconds=play_seconds,
        )

        # Keep one all-time best score per nickname, but refresh activity on every run.
        existing = Score.objects.filter(nickname=nickname).first()
        if existing is None:
            obj = Score.objects.create(nickname=nickname, score=score_val)
            return Response(
                {"nickname": obj.nickname, "score": obj.score, "status": "created"},
                status=status.HTTP_201_CREATED,
            )

        if score_val > existing.score:
            existing.score = score_val
            existing.save(update_fields=["score", "last_played_at"])
            return Response(
                {"nickname": existing.nickname, "score": existing.score, "status": "updated"},
                status=status.HTTP_200_OK,
            )

        existing.save(update_fields=["last_played_at"])
        return Response(
            {"nickname": existing.nickname, "score": existing.score, "status": "kept"},
            status=status.HTTP_200_OK,
        )

    period = (request.GET.get("period") or "30d").lower()
    days = PERIOD_DAYS.get(period, 30)
    try:
        limit = min(int(request.GET.get("limit", 10)), 100)
    except (TypeError, ValueError):
        limit = 10

    since = timezone.now() - timedelta(days=days)
    return Response(_get_period_leaderboard(since, limit))
