# api/models.py — CRUD/sync mirror of the phone's expo-sqlite payload.
# Zero inference: these tables store structured JSON + provenance produced
# on-device by @qvac/sdk; no model is ever loaded server-side.

from django.db import models


class Inspection(models.Model):
    """Upserted by client_uuid so the phone outbox can push idempotently."""

    client_uuid = models.CharField(max_length=128, primary_key=True)
    customer = models.CharField(max_length=255, blank=True, default='')
    city = models.CharField(max_length=255, blank=True, default='')
    country = models.CharField(max_length=255, blank=True, default='')
    author = models.CharField(max_length=255, blank=True, default='')
    observed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=32, blank=True, default='BORRADOR')
    synthetic = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.customer or "Sin sede"} · {self.city or "?"}'


class Observation(models.Model):
    """Structured equipment entities from MedPsy (on-device) — stored verbatim."""

    inspection = models.ForeignKey(
        Inspection, related_name='observations', on_delete=models.CASCADE, null=True, blank=True
    )
    structured_json = models.JSONField(null=True, blank=True)
    confidence_map = models.JSONField(null=True, blank=True)
    tier = models.CharField(max_length=32, blank=True, default='')
    provenance = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Observation · {self.inspection_id} · {self.tier}'


class PlannedVisit(models.Model):
    """Functional offline visit plan pushed from the phone (F05/F08)."""

    planned_uuid = models.CharField(max_length=128, primary_key=True)
    site_id = models.CharField(max_length=255, blank=True, default='')
    date_label = models.CharField(max_length=32, blank=True, default='')
    date = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(max_length=512, blank=True, default='')
    status = models.CharField(max_length=32, blank=True, default='planned')
    synthetic = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.site_id} · {self.date_label}'
