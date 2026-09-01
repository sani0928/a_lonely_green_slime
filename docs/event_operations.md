# Weekly Event Operations

## Event Rules

- The event opens every Sunday at 06:00 KST and closes Saturday at 23:59:59 KST.
- Sunday 00:00-05:59:59 KST is maintenance time.
- New runs close Saturday at 22:59:59 KST so every run can finish within the event window.
- Each run is capped at 60 minutes. The existing 15-minute clear bonus remains active.
- Each account may have one active event run. A disconnected run pauses once for up to 30 seconds; a second disconnect finalizes the run.
- Highest single score selects its winner first. Total-score ranking then selects the best remaining account.

## Railway Configuration

Create a Redis service and a separate Node.js service using `event-server/` as its root directory. Set the following variables on Django:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `EVENT_REDIS_URL`
- `EVENT_INTERNAL_SECRET`
- `EVENT_GAME_WS_URL`

Set the following variables on the event server:

- `EVENT_REDIS_URL`
- `EVENT_INTERNAL_SECRET`
- `EVENT_FINALIZE_URL`
- `EVENT_ALLOWED_ORIGIN`

The internal secret must be a different high-entropy value from Django's secret key and must never be exposed to browsers.

## Prize Administration

Use Django Admin to review `Event runs`. Hold or invalidate suspicious records before sending prizes; the two prize candidates are recalculated from valid server-confirmed records.

Use `Event prizes` to copy the winner email and mark the prize as sent after manual delivery. The winner email snapshot is retained for 90 days after delivery and must then be deleted or anonymized by an operational cleanup job.

Run `python manage.py purge_prize_emails` daily through a Railway cron job.
