from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include

def health(request):
    return HttpResponse("ok", content_type="text/plain")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/scores/", include("scores.urls")),
    path("api/feedback/", include("feedback.urls")),
    path("health/", health),
]
