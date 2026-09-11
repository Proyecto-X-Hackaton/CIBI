# api/admin.py — register sync tables so the jury can inspect "trusted data"
# (structured JSON + provenance, all synthetic:true) in the DRF admin.

from django.contrib import admin

from .models import Inspection, Observation, PlannedVisit


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = ('client_uuid', 'customer', 'city', 'country', 'status', 'synthetic', 'updated_at')
    search_fields = ('client_uuid', 'customer', 'city', 'country')
    list_filter = ('status', 'synthetic')


@admin.register(Observation)
class ObservationAdmin(admin.ModelAdmin):
    list_display = ('id', 'inspection', 'tier', 'created_at')
    search_fields = ('inspection__client_uuid', 'inspection__customer')
    raw_id_fields = ('inspection',)


@admin.register(PlannedVisit)
class PlannedVisitAdmin(admin.ModelAdmin):
    list_display = ('planned_uuid', 'site_id', 'date_label', 'status', 'synthetic', 'updated_at')
    search_fields = ('planned_uuid', 'site_id')
    list_filter = ('status',)
