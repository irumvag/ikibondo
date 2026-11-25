import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:drift/drift.dart' show Value;
import 'package:flutter_test/flutter_test.dart';
import 'package:ikibondo/core/api/api_errors.dart';
import 'package:ikibondo/core/api/response.dart';
import 'package:ikibondo/core/db/app_database.dart';
import 'package:ikibondo/core/theme/app_theme.dart';
import 'package:ikibondo/features/auth/version_gate.dart';
import 'package:ikibondo/iot/ble_scale.dart';
import 'package:ikibondo/iot/muac.dart';

void main() {
  group('MUAC triage (WHO cut-offs)', () {
    test('below 11.5 cm is red', () {
      expect(MuacBand.classify(muacCm: 11.4)!.color, colorDanger);
    });
    test('11.5 to under 12.5 cm is yellow', () {
      expect(MuacBand.classify(muacCm: 11.5)!.color, colorWarn);
      expect(MuacBand.classify(muacCm: 12.4)!.color, colorWarn);
    });
    test('12.5 cm and above is green', () {
      expect(MuacBand.classify(muacCm: 12.5)!.color, colorSuccess);
    });
    test('oedema is severe whatever the MUAC', () {
      expect(MuacBand.classify(muacCm: 14, oedema: true)!.color, colorDanger);
    });
    test('nothing to show without a measurement', () {
      expect(MuacBand.classify(muacCm: null), isNull);
    });
  });

  group('Bluetooth Weight Measurement (0x2A9D)', () {
    test('SI units at 0.005 kg resolution', () {
      // 1700 * 0.005 = 8.5 kg
      expect(BleScale.parseWeightMeasurement([0x00, 0xA4, 0x06]), 8.5);
    });
    test('imperial units are converted to kg', () {
      // 2000 * 0.01 lb = 20 lb = 9.07 kg
      expect(BleScale.parseWeightMeasurement([0x01, 0xD0, 0x07]), 9.07);
    });
    test('"measurement unsuccessful" and short packets are ignored', () {
      expect(BleScale.parseWeightMeasurement([0x00, 0xFF, 0xFF]), isNull);
      expect(BleScale.parseWeightMeasurement([0x00]), isNull);
    });
  });

  group('minimum version check', () {
    test('older builds are blocked', () {
      expect(isOlderVersion('1.0.0', '1.0.1'), isTrue);
      expect(isOlderVersion('1.2.0+7', '1.10.0'), isTrue);
    });
    test('same or newer builds pass', () {
      expect(isOlderVersion('1.0.0', '1.0.0'), isFalse);
      expect(isOlderVersion('2.0.0', '1.9.9'), isFalse);
      expect(isOlderVersion('1.0.0', '0.0.0'), isFalse);
    });
  });

  group('API response helpers', () {
    test('unwrapList handles every list envelope the backend uses', () {
      final row = {'id': 'a'};
      expect(unwrapList({'data': [row]}), [row]);
      expect(unwrapList({'data': {'results': [row]}}), [row]);
      expect(unwrapList({'results': [row]}), [row]);
      expect(unwrapList([row]), [row]);
      expect(unwrapList(null), isEmpty);
    });

    final req = RequestOptions(path: '/x');
    test('only connection failures count as offline', () {
      expect(isNetworkError(DioException(requestOptions: req, type: DioExceptionType.connectionError)), isTrue);
      expect(isNetworkError(DioException(requestOptions: req, type: DioExceptionType.receiveTimeout)), isTrue);
      final refused = DioException(
        requestOptions: req,
        type: DioExceptionType.badResponse,
        response: Response(requestOptions: req, statusCode: 400, data: {'error': 'MUAC out of range.'}),
      );
      expect(isNetworkError(refused), isFalse);
      expect(serverMessage(refused, 'fallback'), 'MUAC out of range.');
    });
  });

  group('sign-out wipe', () {
    test('wipeAll leaves nothing about the previous user on the phone', () async {
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      addTearDown(db.close);
      await db.enqueuePendingOp(PendingOperationsCompanion(
        id: const Value('op-1'),
        opType: const Value('create_visit'),
        payload: const Value('{}'),
      ));
      await db.cacheChild(CachedChildrenCompanion(
        id: const Value('c-1'),
        registrationNumber: const Value('R-1'),
        fullName: const Value('Child One'),
        dateOfBirth: const Value('2024-01-01'),
        sex: const Value('F'),
      ));
      await db.wipeAll();
      expect(await db.countPending(), 0);
      expect(await db.getCachedChild('c-1'), isNull);
    });
  });
}
