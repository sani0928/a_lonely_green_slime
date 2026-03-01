from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Score


PERIOD_DAYS = {"7d": 7, "30d": 30, "1y": 365}


@api_view(["GET", "POST"])
def score_list(request):
    if request.method == "POST":
        nickname = (request.data.get("nickname") or "").strip()
        try:
            score_val = int(request.data.get("score", 0))
        except (TypeError, ValueError):
            score_val = 0
        if len(nickname) < 3 or len(nickname) > 32:
            return Response(
                {"detail": "Nickname must be 3–32 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        obj = Score.objects.create(nickname=nickname, score=score_val)
        return Response({"id": obj.id, "nickname": obj.nickname, "score": obj.score}, status=status.HTTP_201_CREATED)

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
