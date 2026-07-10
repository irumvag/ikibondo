import 'package:flutter_test/flutter_test.dart';
import 'package:ikibondo/core/models/notification.dart';
import 'package:ikibondo/core/models/user.dart';
import 'package:ikibondo/core/models/vaccination_record.dart';

void main() {
  group('AppUser', () {
    final json = {
      'id': 'u-1',
      'email': 'chw@example.com',
      'full_name': 'Alice Uwase',
      'role': 'CHW',
      'phone_number': '+250780000001',
      'camp': 'camp-1',
      'camp_name': 'Mahama',
      'is_approved': true,
      'must_change_password': false,
      'preferred_language': 'rw',
      'guardian_id': null,
    };

    test('fromJson parses role and fields', () {
      final u = AppUser.fromJson(json);
      expect(u.role, UserRole.chw);
      expect(u.fullName, 'Alice Uwase');
      expect(u.isApproved, isTrue);
    });

    test('toJson round-trips through fromJson', () {
      final u = AppUser.fromJson(json);
      final again = AppUser.fromJson(u.toJson());
      expect(again.id, u.id);
      expect(again.role, u.role);
      expect(again.campName, u.campName);
      expect(again.mustChangePassword, u.mustChangePassword);
    });

    test('toJsonString/fromJsonString survive a session restore', () {
      final u = AppUser.fromJson(json);
      final restored = AppUser.fromJsonString(u.toJsonString());
      expect(restored.email, u.email);
      expect(restored.role, u.role);
    });

    test('unknown role defaults to parent', () {
      final u = AppUser.fromJson({...json, 'role': 'SOMETHING_NEW'});
      expect(u.role, UserRole.parent);
    });

    test('initials come from first two name parts', () {
      final u = AppUser.fromJson(json);
      expect(u.initials, 'AU');
    });
  });

  group('VaccinationRecord', () {
    final json = {
      'id': 'v-1',
      'child': 'c-1',
      'child_name': 'Keza N.',
      'vaccine_name': 'BCG',
      'vaccine_code': 'BCG',
      'dose_number': 1,
      'scheduled_date': '2026-07-01',
      'administered_date': null,
      'status': 'SCHEDULED',
      'is_overdue': true,
      'batch_number': null,
      'notes': null,
      'dropout_probability': 0.42,
      'dropout_risk_tier': 'HIGH',
    };

    test('fromJson parses required and optional fields', () {
      final r = VaccinationRecord.fromJson(json);
      expect(r.childId, 'c-1');
      expect(r.isOverdue, isTrue);
      expect(r.dropoutProbability, closeTo(0.42, 1e-9));
    });

    test('toJson round-trips through fromJson', () {
      final r = VaccinationRecord.fromJson(json);
      final again = VaccinationRecord.fromJson(r.toJson());
      expect(again.id, r.id);
      expect(again.scheduledDate, r.scheduledDate);
      expect(again.status, r.status);
      expect(again.isOverdue, r.isOverdue);
      expect(again.dropoutRiskTier, r.dropoutRiskTier);
    });

    test('missing status defaults to SCHEDULED', () {
      final r = VaccinationRecord.fromJson({...json}..remove('status'));
      expect(r.status, 'SCHEDULED');
    });
  });

  group('AppNotification', () {
    final json = {
      'id': 'n-1',
      'notification_type': 'HIGH_RISK_ALERT',
      'message': 'Child flagged high risk',
      'is_read': false,
      'child': 'c-1',
      'child_name': 'Keza N.',
      'created_at': '2026-07-09T10:00:00Z',
    };

    test('toJson round-trips through fromJson', () {
      final n = AppNotification.fromJson(json);
      final again = AppNotification.fromJson(n.toJson());
      expect(again.id, n.id);
      expect(again.message, n.message);
      expect(again.isRead, n.isRead);
      expect(again.createdAt, n.createdAt);
    });

    test('type helpers classify correctly', () {
      final n = AppNotification.fromJson(json);
      expect(n.isHighRisk, isTrue);
      expect(n.isVaccination, isFalse);
    });
  });
}
