import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';

class ChwScanScreen extends ConsumerStatefulWidget {
  const ChwScanScreen({super.key});

  @override
  ConsumerState<ChwScanScreen> createState() => _ChwScanScreenState();
}

class _ChwScanScreenState extends ConsumerState<ChwScanScreen> {
  final MobileScannerController _cameraCtrl = MobileScannerController();
  final _searchCtrl = TextEditingController();
  bool _scanned  = false;
  bool _loading  = false;
  String? _error;

  @override
  void dispose() {
    _cameraCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _lookupQr(String code) async {
    if (_scanned || _loading) return;
    setState(() { _scanned = true; _loading = true; _error = null; });

    try {
      final resp = await ApiClient.dio.post(Endpoints.scanQr(code));
      final data = resp.data['data'] ?? resp.data;
      final childId = data['id'] as String;
      if (mounted) context.go('/chw/children/$childId');
    } catch (_) {
      // Offline fallback: search cached children
      final db  = ref.read(dbProvider);
      final hit = await db.getCachedChildByReg(code);
      if (hit != null && mounted) {
        context.go('/chw/children/${hit.id}');
        return;
      }
      setState(() {
        _error = 'Child not found. Check the QR code or registration number.';
        _scanned = false;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan child QR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: _cameraCtrl.toggleTorch,
          ),
          IconButton(
            icon: const Icon(Icons.flip_camera_ios),
            onPressed: _cameraCtrl.switchCamera,
          ),
        ],
      ),
      body: Stack(
        children: [
          // Camera feed
          MobileScanner(
            controller: _cameraCtrl,
            onDetect: (capture) {
              final code = capture.barcodes.firstOrNull?.rawValue;
              if (code != null) _lookupQr(code);
            },
          ),

          // Scan frame overlay
          Center(
            child: Container(
              width: 260, height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: colorGold, width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),

          // Bottom sheet
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colorHighBg,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(_error!, style: GoogleFonts.inter(fontSize: 13, color: colorDanger)),
                    ),

                  if (_loading)
                    const Center(child: CircularProgressIndicator(color: colorGold)),

                  Text(
                    'Point camera at QR card or enter manually',
                    style: GoogleFonts.inter(fontSize: 13, color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _searchCtrl,
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Registration number or ID',
                            hintStyle: const TextStyle(color: Colors.white54),
                            filled: true,
                            fillColor: Colors.white12,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide.none,
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          onFieldSubmitted: _lookupQr,
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        onPressed: () => _lookupQr(_searchCtrl.text.trim()),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: colorGold,
                          foregroundColor: colorInk,
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                        ),
                        child: const Icon(Icons.search),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
