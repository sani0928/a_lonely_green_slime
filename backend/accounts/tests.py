from django.test import RequestFactory, SimpleTestCase, override_settings

from .views import _frontend_url


@override_settings(GAME_FRONTEND_URL="http://localhost:5173")
class FrontendRedirectTests(SimpleTestCase):
    def test_uses_configured_frontend_for_missing_next_url(self):
        request = RequestFactory().get("/auth/google/login/")
        self.assertEqual(_frontend_url(request), "http://localhost:5173/?event_signup=1")

    def test_rejects_untrusted_next_url(self):
        request = RequestFactory().get("/auth/google/login/?next=https://example.invalid")
        self.assertEqual(_frontend_url(request), "http://localhost:5173/?event_signup=1")

    def test_allows_configured_frontend_next_url(self):
        request = RequestFactory().get("/auth/google/login/?next=http://localhost:5173/?event_signup=1")
        self.assertEqual(_frontend_url(request), "http://localhost:5173/?event_signup=1")
