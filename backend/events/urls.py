from django.urls import path

from . import views

urlpatterns = [
    path("current/", views.current),
    path("consent/", views.accept_consent),
    path("entry/", views.create_entry),
    path("leaderboard/", views.leaderboard),
    path("internal/finalize/", views.finalize_run),
]
