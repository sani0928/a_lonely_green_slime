from datetime import datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import PlayLog


def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
    else:
        return None

    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _to_int(value, default=0, min_value=0):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(min_value, parsed)


def _to_float(value, default=0.0, min_value=0.0):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return max(min_value, parsed)


def _sanitize_snapshots(value):
    if not isinstance(value, list):
        return []
    out = []
    for item in value:
        if not isinstance(item, dict):
            continue
        badges = item.get("badges")
        if not isinstance(badges, list):
            badges = []
        badges = [b for b in badges if isinstance(b, str)]
        out.append(
            {
                "t_sec": _to_int(item.get("t_sec"), default=0),
                "minute": _to_int(item.get("minute"), default=0),
                "hp": _to_int(item.get("hp"), default=0),
                "max_hp": _to_int(item.get("max_hp"), default=0),
                "cells": _to_int(item.get("cells"), default=0),
                "attack": _to_int(item.get("attack"), default=0),
                "badges": badges,
                "kills": _to_int(item.get("kills"), default=0),
            }
        )
    return out[:120]


@api_view(["POST"])
def playlog_create(request):
    anonymous_id = (request.data.get("anonymous_id") or "").strip()
    run_id = (request.data.get("run_id") or "").strip()

    if not anonymous_id:
        return Response(
            {"detail": "anonymous_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not run_id:
        return Response(
            {"detail": "run_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    data = {
        "started_at": _parse_dt(request.data.get("started_at")),
        "ended_at": _parse_dt(request.data.get("ended_at")) or timezone.now(),
        "play_seconds": _to_float(request.data.get("play_seconds"), default=0.0),
        "contact_hits": _to_int(request.data.get("contact_hits"), default=0),
        "projectile_hits": _to_int(request.data.get("projectile_hits"), default=0),
        "shooter_contact_hits": _to_int(
            request.data.get("shooter_contact_hits"), default=0
        ),
        "shooter_projectile_hits": _to_int(
            request.data.get("shooter_projectile_hits"), default=0
        ),
        "kills_total": _to_int(request.data.get("kills_total"), default=0),
        "final_score": _to_int(request.data.get("final_score"), default=0, min_value=-10**9),
        "is_clear": bool(request.data.get("is_clear")),
        "snapshots": _sanitize_snapshots(request.data.get("snapshots")),
    }

    obj, created = PlayLog.objects.update_or_create(
        anonymous_id=anonymous_id,
        run_id=run_id,
        defaults=data,
    )

    return Response(
        {
            "id": obj.id,
            "anonymous_id": obj.anonymous_id,
            "run_id": obj.run_id,
            "status": "created" if created else "updated",
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )
