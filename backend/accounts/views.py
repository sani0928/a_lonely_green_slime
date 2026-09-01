import base64
import hashlib
import json
import secrets
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.http import HttpResponseBadRequest, HttpResponseRedirect, JsonResponse
from django.views.decorators.http import require_GET, require_POST
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .models import GoogleAccount


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _frontend_url(request):
    return request.GET.get("next") or "/"


@require_GET
def google_login(request):
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_REDIRECT_URI:
        return HttpResponseBadRequest("Google OAuth is not configured.")
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    request.session["google_oauth_state"] = state
    request.session["google_oauth_nonce"] = nonce
    request.session["google_oauth_verifier"] = verifier
    request.session["google_oauth_next"] = _frontend_url(request)
    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    return HttpResponseRedirect(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@require_GET
def google_callback(request):
    code = request.GET.get("code")
    state = request.GET.get("state")
    expected_state = request.session.pop("google_oauth_state", None)
    nonce = request.session.pop("google_oauth_nonce", None)
    verifier = request.session.pop("google_oauth_verifier", None)
    next_url = request.session.pop("google_oauth_next", "/")
    if not code or not state or not secrets.compare_digest(state, expected_state or "") or not nonce or not verifier:
        return HttpResponseBadRequest("Invalid OAuth response.")
    body = urlencode({
        "code": code,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    }).encode()
    try:
        token_response = urlopen(Request(GOOGLE_TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}), timeout=10)
        token_data = json.loads(token_response.read().decode())
        claims = id_token.verify_oauth2_token(token_data["id_token"], google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID)
    except Exception:
        return HttpResponseBadRequest("Google identity verification failed.")
    if claims.get("nonce") != nonce or not claims.get("email_verified") or not claims.get("sub") or not claims.get("email"):
        return HttpResponseBadRequest("Verified Google email is required.")
    account = GoogleAccount.objects.filter(google_sub=claims["sub"]).select_related("user").first()
    if account is None:
        request.session["google_pending_claims"] = {"sub": claims["sub"], "email": claims["email"]}
        return HttpResponseRedirect("/?event_signup=1")
    account.email = claims["email"]
    account.email_verified = True
    account.save(update_fields=["email", "email_verified", "updated_at"])
    login(request, account.user)
    return HttpResponseRedirect(next_url if next_url.startswith("/") else "/")


@require_POST
def complete_signup(request):
    pending = request.session.get("google_pending_claims")
    if not pending:
        return JsonResponse({"detail": "No pending Google signup."}, status=400)
    try:
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Invalid JSON."}, status=400)
    nickname = str(payload.get("nickname", "")).strip()
    if not 2 <= len(nickname) <= 32:
        return JsonResponse({"detail": "Nickname must be 2-32 characters."}, status=400)
    if GoogleAccount.objects.filter(event_nickname__iexact=nickname).exists():
        return JsonResponse({"detail": "Nickname is already in use."}, status=409)
    username = f"google_{hashlib.sha256(pending['sub'].encode()).hexdigest()[:40]}"
    user = User.objects.create_user(username=username)
    GoogleAccount.objects.create(user=user, google_sub=pending["sub"], event_nickname=nickname, email=pending["email"], email_verified=True)
    request.session.pop("google_pending_claims", None)
    login(request, user)
    return JsonResponse({"nickname": nickname}, status=201)


@require_GET
def me(request):
    pending = request.session.get("google_pending_claims")
    if pending:
        return JsonResponse({"authenticated": False, "signup_required": True})
    if not request.user.is_authenticated or not hasattr(request.user, "google_account"):
        return JsonResponse({"authenticated": False, "signup_required": False})
    return JsonResponse({"authenticated": True, "nickname": request.user.google_account.event_nickname})


@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})
