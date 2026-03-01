from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Feedback


@api_view(["POST"])
def feedback_create(request):
    content = (request.data.get("content") or "").strip()
    if not content:
        return Response(
            {"detail": "Content is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    Feedback.objects.create(content=content)
    return Response({"detail": "OK"}, status=status.HTTP_201_CREATED)
