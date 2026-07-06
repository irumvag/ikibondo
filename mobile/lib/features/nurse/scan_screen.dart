import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

class NurseScanScreen extends StatefulWidget {
  const NurseScanScreen({super.key});

  @override
  State<NurseScanScreen> createState() => _NurseScanScreenState();
}

class _NurseScanScreenState extends State<NurseScanScreen> {
  final MobileScannerController _ctrl = MobileScannerController();
  final _searchCtrl = TextEditingController();
  bool _scanned = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() { _ctrl.dispose(); _searchCtrl.dispose(); super.dispose(); }

  Future<void> _lookup(String code) async {
    if (_scanned || _loading) return;
    setState(() { _scanned = true; _loading = true; _error = null; });
    try {
      final resp = await ApiClient.dio.post(Endpoints.scanQr(code));
      final data = resp.data['data'] ?? resp.data;
      final childId = data['id'] as String;
      if (mounted) context.go('/nurse/children/$childId');
    } catch (_) {
      setState(() { _error = 'Child not found for this QR / ID.'; _scanned = false; _loading = false; });
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
          IconButton(icon: const Icon(Icons.flash_on), onPressed: _ctrl.toggleTorch),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _ctrl,
            onDetect: (capture) {
              final code = capture.barcodes.firstOrNull?.rawValue;
              if (code != null) _lookup(code);
            },
          ),
          Center(
            child: Container(
              width: 260, height: 260,
              decoration: BoxDecoration(border: Border.all(color: colorGold, width: 2), borderRadius: BorderRadius.circular(16)),
            ),
          ),
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(color: Colors.black87, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: colorHighBg, borderRadius: BorderRadius.circular(10)),
                      child: Text(_error!, style: GoogleFonts.inter(fontSize: 13, color: colorDanger)),
                    ),
                  if (_loading) const Center(child: CircularProgressIndicator(color: colorGold)),
                  Text('Point camera at QR or enter ID below', style: GoogleFonts.inter(fontSize: 13, color: Colors.white70), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextFormField(
                        controller: _searchCtrl,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          hintText: 'Registration number or UUID',
                          hintStyle: const TextStyle(color: Colors.white54),
                          filled: true,
                          fillColor: Colors.white12,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        onFieldSubmitted: _lookup,
                      ),
                    ),
                    const SizedBox(width: 10),
                    ElevatedButton(
                      onPressed: () => _lookup(_searchCtrl.text.trim()),
                      style: ElevatedButton.styleFrom(backgroundColor: colorGold, foregroundColor: colorInk, padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14)),
                      child: const Icon(Icons.search),
                    ),
                  ]),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
