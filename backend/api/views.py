# api/views.py — DRF CRUD/sync/aggregates ONLY. Zero inference: no model is
# ever loaded here; the server stores/receives structured JSON + provenance
# produced on-device by @qvac/sdk on the phone. (Grep gate: no AI imports.)

from datetime import datetime

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Inspection, Observation, PlannedVisit


def _dt(value):
    """Phone sends ISO strings; DateTimeFields want aware datetimes."""
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value)
    if isinstance(value, str):
        parsed = parse_datetime(value)
        if parsed is not None:
            return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)
    return None


@api_view(['GET'])
def health(request):
    # CRUD/sync server only — zero inference, never loads a model.
    return Response({'status': 'ok', 'synthetic': True})


def _save_inspection(data):
    """Upsert by client_uuid — the phone outbox pushes idempotently."""
    client_uuid = str(data.get('client_uuid') or '').strip()
    if not client_uuid:
        return Response({'ok': False, 'error': 'client_uuid is required'}, status=400)
    obj, created = Inspection.objects.update_or_create(
        client_uuid=client_uuid,
        defaults={
            'customer': str(data.get('customer') or ''),
            'city': str(data.get('city') or ''),
            'country': str(data.get('country') or ''),
            'author': str(data.get('author') or ''),
            'observed_at': _dt(data.get('observed_at')),
            'status': str(data.get('status') or 'BORRADOR'),
            'synthetic': bool(data.get('synthetic', True)),
        },
    )
    return Response({'ok': True, 'created': created, 'client_uuid': obj.client_uuid}, status=201 if created else 200)


def _save_planned_visit(data):
    planned_uuid = str(data.get('planned_uuid') or '').strip()
    if not planned_uuid:
        return Response({'ok': False, 'error': 'planned_uuid is required'}, status=400)
    obj, created = PlannedVisit.objects.update_or_create(
        planned_uuid=planned_uuid,
        defaults={
            'site_id': str(data.get('site_id') or ''),
            'date_label': str(data.get('date_label') or ''),
            'date': _dt(data.get('date')),
            'reason': str(data.get('reason') or ''),
            'status': str(data.get('status') or 'planned'),
            'synthetic': bool(data.get('synthetic', True)),
        },
    )
    return Response({'ok': True, 'created': created, 'planned_uuid': obj.planned_uuid}, status=201 if created else 200)


def _save_observation(data):
    """Accepts both shapes: observation (structured_json) and the phone's
    `report` outbox entity ({inspection_id, tier, json, provenance})."""
    ref = str(data.get('inspection_id') or data.get('client_uuid') or '').strip()
    if not ref:
        return Response({'ok': False, 'error': 'inspection_id/client_uuid is required'}, status=400)
    inspection = Inspection.objects.filter(client_uuid=ref).first()
    if inspection is None:
        # A report can be retried before its inspection row lands; keep push
        # green with a synthetic stub the next inspection upsert fills in.
        inspection = Inspection.objects.create(client_uuid=ref, synthetic=bool(data.get('synthetic', True)))
    structured = data.get('structured_json')
    if structured is None:
        structured = data.get('json')
    Observation.objects.create(
        inspection=inspection,
        structured_json=structured,
        confidence_map=data.get('confidence_map'),
        tier=str(data.get('tier') or ''),
        provenance=data.get('provenance'),
    )
    return Response({'ok': True, 'inspection': ref}, status=201)


def _aggregate(observation):
    """MR/CT/US counts + aging/incomplete from one observation's items."""
    counts = {'MR': 0, 'CT': 0, 'US': 0}
    aging = 0
    incomplete = 0
    if observation is None or not isinstance(observation.structured_json, dict):
        return counts, aging, incomplete
    for item in observation.structured_json.get('items') or []:
        if not isinstance(item, dict):
            continue
        modality = item.get('modality')
        if modality in counts:
            counts[modality] += item.get('qty') or 1
        age = item.get('age_years')
        if isinstance(age, (int, float)) and age > 7:
            aging += 1
        if not item.get('manufacturer') or item.get('age_years') is None:
            incomplete += 1
    return counts, aging, incomplete


@api_view(['POST'])
def inspections(request):
    return _save_inspection(request.data)


@api_view(['POST'])
def planned_visits(request):
    return _save_planned_visit(request.data)


@api_view(['POST'])
def observations(request):
    return _save_observation(request.data)


@api_view(['POST'])
def sync_push(request):
    """Generic outbox router: {entity, payload} → 200. The phone routes any
    entity it doesn't have a dedicated endpoint for (e.g. the task-06
    `inspection_delete` tombstone) here, so push never errors on new shapes."""
    entity = str(request.data.get('entity') or '').strip()
    payload = request.data.get('payload')
    if not entity or not isinstance(payload, dict):
        return Response({'ok': False, 'error': 'entity and payload object are required'}, status=400)
    if entity == 'inspection':
        return _save_inspection(payload)
    if entity == 'planned_visit':
        return _save_planned_visit(payload)
    if entity in ('report', 'observation'):
        return _save_observation(payload)
    if entity == 'inspection_delete':
        # Tombstone from the phone (task-06): honor the delete server-side so
        # a future pull can never resurrect a locally deleted inspection.
        client_uuid = str(payload.get('client_uuid') or '').strip()
        if not client_uuid:
            return Response({'ok': False, 'error': 'client_uuid is required'}, status=400)
        _, per_model = Inspection.objects.filter(client_uuid=client_uuid).delete()
        return Response({'ok': True, 'entity': 'inspection_delete', 'deleted': per_model.get('api.Inspection', 0)})
    # Unknown entities: accept with stored=False so an older phone never
    # wedges its outbox on a newer/older backend pairing.
    return Response({'ok': True, 'entity': entity, 'stored': False})


@api_view(['GET'])
def sites(request):
    """Aggregate per inspection (latest observation) — mirrors the phone's
    Network screen shape; empty-safe (returns [] on a fresh DB)."""
    queryset = Inspection.objects.all().order_by('customer', 'client_uuid')
    country = request.query_params.get('country')
    city = request.query_params.get('city')
    if country:
        queryset = queryset.filter(country__iexact=country)
    if city:
        queryset = queryset.filter(city__iexact=city)
    out = []
    for ins in queryset:
        counts, aging, incomplete = _aggregate(ins.observations.order_by('-id').first())
        out.append({
            'site_id': ins.client_uuid,
            'name': ins.customer or 'Sin sede',
            'city': ins.city,
            'country': ins.country,
            'counts': counts,
            'aging': aging,
            'incomplete': incomplete,
            'synthetic': ins.synthetic,
        })
    return Response(out)


@api_view(['GET'])
def dashboard_summary(request):
    """Server-side aggregates (phone Panel uses SQLite offline; this is the
    online mirror) — empty-safe zeros on a fresh DB."""
    inspections = list(Inspection.objects.all())
    counts = {'MR': 0, 'CT': 0, 'US': 0}
    aging = 0
    incomplete = 0
    for ins in inspections:
        c, a, i = _aggregate(ins.observations.order_by('-id').first())
        for key in counts:
            counts[key] += c[key]
        aging += a
        incomplete += i
    return Response({
        'sites': Inspection.objects.exclude(customer='').values('customer').distinct().count(),
        'inspections': len(inspections),
        'counts': counts,
        'aging_gt_7y': aging,
        'incomplete': incomplete,
        'planned_visits': PlannedVisit.objects.filter(status='planned').count(),
        'synthetic': True,
    })
