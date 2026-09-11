"""URL configuration for config project.

CRUD/sync API only — zero inference anywhere on this server.
The phone (Expo + @qvac/sdk) is the only place models run.
"""

from django.contrib import admin
from django.urls import path

from api import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', views.health),
    path('api/inspections/', views.inspections),
    path('api/planned-visits/', views.planned_visits),
    path('api/observations/', views.observations),
    path('api/sync/push/', views.sync_push),
    path('api/sites/', views.sites),
    path('api/dashboard/summary/', views.dashboard_summary),
]
