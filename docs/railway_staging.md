# Railway Staging Environment

`staging`은 운영과 분리된 통합 테스트 환경이다. 테스트 실행 기록, Redis 세션, Google OAuth 세션은 운영 환경과 절대로 공유하지 않는다.

## 한 번만 생성할 구성

1. Railway 프로젝트의 환경 선택 메뉴에서 `+ New Environment`를 눌러 `staging`을 만든다.
2. 운영 서비스 구성이 이미 있다면 `Duplicate Environment`를 선택한다. 아직 이벤트 서버가 없다면 `Empty Environment`를 선택해 아래 서비스를 만든다.
3. `staging`에 PostgreSQL 서비스(`Postgres`)와 Redis 서비스(`Redis`)를 추가한다.
4. Django 서비스의 Root Directory를 `backend`로, 이벤트 서버 서비스의 Root Directory를 `event-server`로 설정한다. 각 폴더의 `railway.toml`이 빌드, 마이그레이션, 시작, 헬스체크를 정의한다.
5. Django와 이벤트 서버의 Public Domain을 각각 생성한다. 테스트용 프런트가 별도 도메인이라면 그 도메인도 준비한다.
6. Django와 이벤트 서버의 배포 브랜치를 `staging`으로 설정한다. 운영 서비스는 `main`을 유지한다.

Railway에서 환경을 복제하면 DB와 네트워크도 새 환경으로 분리된다. sealed secret은 복제되지 않으므로 아래 비밀값은 staging에 새로 입력한다.

## Staging 변수

### Staging Django 서비스

| 변수 | 값 |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `EVENT_REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `DJANGO_SECRET_KEY` | staging 전용의 긴 임의 문자열 |
| `DJANGO_DEBUG` | `0` |
| `DJANGO_SECURE_SSL_REDIRECT` | `1` |
| `ALLOWED_HOSTS` | `<staging-django-domain>` |
| `CORS_ALLOWED_ORIGINS` | `https://<staging-frontend-domain>` |
| `CSRF_TRUSTED_ORIGINS` | `https://<staging-frontend-domain>,https://<staging-django-domain>` |
| `GOOGLE_OAUTH_CLIENT_ID` | staging용 Google OAuth Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | staging용 Google OAuth Client Secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<staging-django-domain>/auth/google/callback/` |
| `EVENT_INTERNAL_SECRET` | staging 전용의 긴 임의 문자열 |
| `EVENT_GAME_WS_URL` | `wss://<staging-event-server-domain>` |

### Staging 이벤트 서버 서비스

| 변수 | 값 |
| --- | --- |
| `EVENT_REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `EVENT_INTERNAL_SECRET` | Django staging의 값과 정확히 동일 |
| `EVENT_FINALIZE_URL` | `https://<staging-django-domain>/api/events/internal/finalize/` |
| `EVENT_ALLOWED_ORIGIN` | `https://<staging-frontend-domain>` |

### Staging 프런트 빌드

정적 프런트를 staging으로 별도 빌드할 때 다음 빌드 변수를 설정한다. 이 값이 없으면 기존 운영 API 주소를 사용하므로 반드시 추가한다.

| 변수 | 값 |
| --- | --- |
| `VITE_GAME_API_BASE_URL` | `https://<staging-django-domain>` |

## Google OAuth 설정

Google Cloud Console의 OAuth 클라이언트에 아래 Authorized redirect URI를 추가한다.

```text
https://<staging-django-domain>/auth/google/callback/
```

운영과 staging은 OAuth Client를 분리하는 편이 권장된다. 하나의 클라이언트를 공유한다면 staging redirect URI를 추가하고, 테스트 계정만 허용한다.

## 배포 전 확인

1. Django `https://<staging-django-domain>/health/`가 `ok`를 반환하는지 확인한다.
2. 이벤트 서버 `https://<staging-event-server-domain>/health`가 `ok: true`를 반환하는지 확인한다.
3. staging 프런트에서 Google 로그인, 동의, 이벤트 입장, WebSocket 연결, 30초 재접속, 점수 확정을 테스트한다.
4. Django Admin에서 테스트 기록과 경품 후보를 검토한 뒤 테스트 데이터를 정리한다. staging에서는 실제 경품 메일을 발송하지 않는다.
