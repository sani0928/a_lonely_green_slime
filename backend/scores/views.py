from datetime import timedelta
import re

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Score


PERIOD_DAYS = {"7d": 7, "30d": 30, "1y": 365}


def _generate_auto_player_nickname():
    """PlayerN 자동 생성 (소규모 서비스라 동시성은 크게 고려하지 않는다)."""
    # Player 숫자만 추려서 최대값 찾기
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


def _validate_nickname(nickname: str):
    """
    닉네임 검증.
    - 닉네임 없음 (\"\" 또는 \"Player\") 은 검사 대상 아님 → 호출 측에서 처리.
    - 한글 포함: 2~20자
    - 그 외: 2~32자
    """
    if not nickname or nickname == "Player":
        return None  # 호출 측에서 \"없음\" 으로 처리

    has_hangul = bool(re.search(r"[ㄱ-ㅎ가-힣]", nickname))
    length = len(nickname)

    if length < 2:
        return "Nickname must be at least 2 characters."
    if has_hangul and length > 20:
        return "Korean nicknames must be 2–20 characters (including spaces)."
    if not has_hangul and length > 32:
        return "Nicknames must be 2–32 characters (including spaces)."
    return None


@api_view(["GET", "POST"])
def score_list(request):
    if request.method == "POST":
        raw_nickname = (request.data.get("nickname") or "").strip()
        try:
            score_val = int(request.data.get("score", 0))
        except (TypeError, ValueError):
            score_val = 0

        # 닉네임 없음 → PlayerN 자동 부여
        if raw_nickname == "" or raw_nickname == "Player":
            nickname = _generate_auto_player_nickname()
        else:
            error = _validate_nickname(raw_nickname)
            if error:
                return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
            nickname = raw_nickname

        # 닉네임별 최고 점수 1개 유지 (upsert)
        existing = Score.objects.filter(nickname=nickname).first()
        if existing is None:
            obj = Score.objects.create(nickname=nickname, score=score_val)
            return Response(
                {"nickname": obj.nickname, "score": obj.score, "status": "created"},
                status=status.HTTP_201_CREATED,
            )

        if score_val > existing.score:
            existing.score = score_val
            existing.save(update_fields=["score"])
            return Response(
                {"nickname": existing.nickname, "score": existing.score, "status": "updated"},
                status=status.HTTP_200_OK,
            )

        # 새 점수가 더 낮거나 같을 때는 그대로 유지
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
    qs = Score.objects.filter(created_at__gte=since).order_by("-score", "-created_at")[:limit]
    data = [{"nickname": o.nickname, "score": o.score} for o in qs]
    return Response(data)
