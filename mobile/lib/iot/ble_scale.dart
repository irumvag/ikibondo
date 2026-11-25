import 'dart:async';

import 'package:flutter_blue_plus/flutter_blue_plus.dart';

/// Reads a weight from a Bluetooth scale that implements the standard
/// Bluetooth SIG Weight Scale Service (0x181D, measurement characteristic 0x2A9D).
/// Scales with proprietary protocols are not supported; the CHW types the value instead.
class BleScale {
  static final _service = Guid('0000181d-0000-1000-8000-00805f9b34fb');
  static final _measurement = Guid('00002a9d-0000-1000-8000-00805f9b34fb');

  /// Scan for a nearby scale, take one stable reading, disconnect. Returns kilograms.
  static Future<double> readOnce({Duration timeout = const Duration(seconds: 20)}) async {
    if (await FlutterBluePlus.isSupported == false) {
      throw StateError('This phone does not support Bluetooth.');
    }
    if (FlutterBluePlus.adapterStateNow != BluetoothAdapterState.on) {
      throw StateError('Turn on Bluetooth and try again.');
    }

    BluetoothDevice? device;
    final found = Completer<BluetoothDevice>();
    final scanSub = FlutterBluePlus.onScanResults.listen((results) {
      if (results.isNotEmpty && !found.isCompleted) found.complete(results.first.device);
    });
    try {
      await FlutterBluePlus.startScan(withServices: [_service], timeout: timeout);
      device = await found.future.timeout(timeout, onTimeout: () {
        throw TimeoutException('No scale found. Switch the scale on and keep it close to the phone.');
      });
      await FlutterBluePlus.stopScan();

      await device.connect(timeout: const Duration(seconds: 10));
      final services = await device.discoverServices();
      final characteristic = services
          .firstWhere((s) => s.uuid == _service)
          .characteristics
          .firstWhere((c) => c.uuid == _measurement);

      final reading = Completer<double>();
      final valueSub = characteristic.onValueReceived.listen((bytes) {
        final kg = parseWeightMeasurement(bytes);
        if (kg != null && !reading.isCompleted) reading.complete(kg);
      });
      await characteristic.setNotifyValue(true);
      try {
        return await reading.future.timeout(timeout, onTimeout: () {
          throw TimeoutException('Place the child on the scale and wait for the reading.');
        });
      } finally {
        await valueSub.cancel();
      }
    } finally {
      await scanSub.cancel();
      await FlutterBluePlus.stopScan();
      await device?.disconnect();
    }
  }

  /// Weight Measurement (0x2A9D): flags byte, then uint16 weight.
  /// Bit 0 of flags: 0 = SI (resolution 0.005 kg), 1 = imperial (0.01 lb).
  static double? parseWeightMeasurement(List<int> bytes) {
    if (bytes.length < 3) return null;
    final imperial = (bytes[0] & 0x01) == 1;
    final raw = bytes[1] | (bytes[2] << 8);
    if (raw == 0xFFFF) return null; // "measurement unsuccessful"
    final kg = imperial ? raw * 0.01 * 0.45359237 : raw * 0.005;
    return double.parse(kg.toStringAsFixed(2));
  }
}
