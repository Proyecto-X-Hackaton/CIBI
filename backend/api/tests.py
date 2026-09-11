# api/tests.py — endpoint contract tests for the phone→PC sync flow (task-07).
# These encode the exact payloads the Expo client sends, including the
# task-06 `inspection_delete` tombstone. Zero inference anywhere.

import json

from django.test import Client, TestCase


def post(client, path, payload):
    return client.post(path, data=json.dumps(payload), content_type='application/json')


class HealthTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_health_ok(self):
        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], 'ok')


class InspectionSyncTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_upsert_creates_then_updates_same_row(self):
        payload = {
            'client_uuid': 'abc-1', 'customer': 'Hospital Alpha', 'city': 'São Paulo',
            'country': 'Brasil', 'author': 'A. Ruiz', 'observed_at': '2026-09-11T10:00:00Z',
            'status': 'BORRADOR', 'synthetic': True,
        }
        r1 = post(self.client, '/api/inspections/', payload)
        self.assertEqual(r1.status_code, 201)
        self.assertTrue(r1.json()['created'])
        payload['status'] = 'SYNCED'
        r2 = post(self.client, '/api/inspections/', payload)
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(r2.json()['created'])
        # Idempotent: still exactly one row, now updated.
        from api.models import Inspection
        self.assertEqual(Inspection.objects.count(), 1)
        self.assertEqual(Inspection.objects.get(client_uuid='abc-1').status, 'SYNCED')

    def test_missing_client_uuid_is_400(self):
        r = post(self.client, '/api/inspections/', {'customer': 'x'})
        self.assertEqual(r.status_code, 400)


class PlannedVisitSyncTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_upsert_by_planned_uuid(self):
        payload = {
            'planned_uuid': 'pv-1', 'site_id': 'Hospital Alpha', 'date_label': 'manana',
            'date': '2026-09-12T08:00:00Z', 'reason': 'renovación', 'status': 'planned',
            'synthetic': True,
        }
        self.assertEqual(post(self.client, '/api/planned-visits/', payload).status_code, 201)
        payload['status'] = 'done'
        self.assertEqual(post(self.client, '/api/planned-visits/', payload).status_code, 200)
        from api.models import PlannedVisit
        self.assertEqual(PlannedVisit.objects.count(), 1)
        self.assertEqual(PlannedVisit.objects.get(planned_uuid='pv-1').status, 'done')


class ObservationSyncTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_report_payload_shape_creates_observation(self):
        # The phone pushes its `report` outbox entity to /api/observations/.
        post(self.client, '/api/inspections/', {'client_uuid': 'abc-1', 'customer': 'Hospital Alpha'})
        payload = {
            'inspection_id': 'abc-1', 'version': 1, 'tier': 'CIBI',
            'json': {'items': [{'modality': 'MR', 'qty': 3, 'age_years': 9, 'manufacturer': None}]},
            'provenance': {'tier': 'CIBI', 'mode': 'offline'}, 'synthetic': True,
        }
        r = post(self.client, '/api/observations/', payload)
        self.assertEqual(r.status_code, 201)
        from api.models import Observation
        self.assertEqual(Observation.objects.count(), 1)
        obs = Observation.objects.get()
        self.assertEqual(obs.structured_json['items'][0]['modality'], 'MR')

    def test_observation_for_unknown_inspection_creates_stub(self):
        # Outbox retry order must never 404 the push.
        r = post(self.client, '/api/observations/', {'inspection_id': 'late-1', 'json': {'items': []}})
        self.assertEqual(r.status_code, 201)
        from api.models import Inspection
        self.assertTrue(Inspection.objects.filter(client_uuid='late-1').exists())


class SyncPushTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_routes_known_entities(self):
        r = post(self.client, '/api/sync/push/', {
            'entity': 'inspection',
            'payload': {'client_uuid': 'x-1', 'customer': 'Hospital Beta', 'synthetic': True},
        })
        self.assertEqual(r.status_code, 201)
        r = post(self.client, '/api/sync/push/', {
            'entity': 'planned_visit',
            'payload': {'planned_uuid': 'pv-9', 'site_id': 'Hospital Beta', 'synthetic': True},
        })
        self.assertEqual(r.status_code, 201)
        r = post(self.client, '/api/sync/push/', {
            'entity': 'report',
            'payload': {'inspection_id': 'x-1', 'tier': 'CIBI', 'json': {'items': []}},
        })
        self.assertEqual(r.status_code, 201)

    def test_inspection_delete_tombstone_deletes_server_rows(self):
        # task-06: deleting on the phone must delete here too (never resurrect).
        post(self.client, '/api/inspections/', {'client_uuid': 'del-1', 'customer': 'Hospital Alpha'})
        post(self.client, '/api/observations/', {'inspection_id': 'del-1', 'json': {'items': []}})
        r = post(self.client, '/api/sync/push/', {
            'entity': 'inspection_delete',
            'payload': {'client_uuid': 'del-1', 'deleted_at': '2026-09-11T12:00:00Z', 'synthetic': True},
        })
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['deleted'], 1)
        from api.models import Inspection, Observation
        self.assertFalse(Inspection.objects.filter(client_uuid='del-1').exists())
        self.assertEqual(Observation.objects.count(), 0)  # cascaded

    def test_unknown_entity_accepted_not_stored(self):
        r = post(self.client, '/api/sync/push/', {'entity': 'future_thing', 'payload': {'x': 1}})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()['stored'])

    def test_missing_entity_is_400(self):
        r = post(self.client, '/api/sync/push/', {'payload': {'x': 1}})
        self.assertEqual(r.status_code, 400)


class AggregateTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_empty_safe(self):
        self.assertEqual(self.client.get('/api/sites/').status_code, 200)
        self.assertEqual(self.client.get('/api/sites/').json(), [])
        summary = self.client.get('/api/dashboard/summary/').json()
        self.assertEqual(summary['inspections'], 0)
        self.assertEqual(summary['counts'], {'MR': 0, 'CT': 0, 'US': 0})

    def test_sites_and_dashboard_aggregate_from_db(self):
        post(self.client, '/api/inspections/', {
            'client_uuid': 's-1', 'customer': 'Hospital Alpha', 'city': 'São Paulo',
            'country': 'Brasil', 'synthetic': True,
        })
        post(self.client, '/api/observations/', {
            'inspection_id': 's-1', 'structured_json': {'items': [
                {'modality': 'MR', 'qty': 3, 'age_years': 9, 'manufacturer': None},
                {'modality': 'CT', 'qty': 2, 'age_years': None, 'manufacturer': None},
                {'modality': 'US', 'qty': 4, 'age_years': 2, 'manufacturer': 'Acme'},
            ]},
        })
        sites = self.client.get('/api/sites/').json()
        self.assertEqual(len(sites), 1)
        self.assertEqual(sites[0]['counts'], {'MR': 3, 'CT': 2, 'US': 4})
        self.assertEqual(sites[0]['aging'], 1)
        self.assertEqual(sites[0]['incomplete'], 2)

        summary = self.client.get('/api/dashboard/summary/').json()
        self.assertEqual(summary['inspections'], 1)
        self.assertEqual(summary['counts'], {'MR': 3, 'CT': 2, 'US': 4})
        self.assertEqual(summary['aging_gt_7y'], 1)
        self.assertEqual(summary['incomplete'], 2)

    def test_sites_country_filter(self):
        post(self.client, '/api/inspections/', {'client_uuid': 's-1', 'customer': 'A', 'country': 'Brasil'})
        post(self.client, '/api/inspections/', {'client_uuid': 's-2', 'customer': 'B', 'country': 'Panamá'})
        r = self.client.get('/api/sites/?country=brasil')
        self.assertEqual(len(r.json()), 1)
        self.assertEqual(r.json()[0]['country'], 'Brasil')
