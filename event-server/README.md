# Event Server

Required environment variables:

- `EVENT_REDIS_URL`: Railway Redis connection URL
- `EVENT_FINALIZE_URL`: Django internal endpoint, for example `https://api.example.com/api/events/internal/finalize/`
- `EVENT_INTERNAL_SECRET`: shared high-entropy secret used for HMAC result authentication
- `EVENT_ALLOWED_ORIGIN`: production game origin, for example `https://www.a-lonely-green-slime.com`
- `PORT`: assigned by Railway

The public WebSocket client sends only an opaque ticket and input state. Score, elapsed time, player state, and final results are calculated by this server.

Deploy this folder as a separate Railway service with one Redis service shared with Django. Configure `EVENT_GAME_WS_URL` on Django with this service's `wss://` URL, and configure `EVENT_FINALIZE_URL` on this service with Django's internal finalize endpoint.
