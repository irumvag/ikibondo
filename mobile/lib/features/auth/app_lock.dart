import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import '../../core/theme/app_theme.dart';

/// Lock after this long in the background.
const kLockAfter = Duration(minutes: 5);

/// Covers the app after [kLockAfter] in the background, so a phone left on a
/// table in the camp does not show children's records. Unlocks with Face ID,
/// fingerprint or the phone passcode. Phones with no screen lock configured
/// are never locked (there is nothing to unlock with).
class AppLock extends StatefulWidget {
  const AppLock({super.key, required this.child});

  final Widget child;

  @override
  State<AppLock> createState() => _AppLockState();
}

class _AppLockState extends State<AppLock> {
  final _auth = LocalAuthentication();
  late final AppLifecycleListener _listener;
  DateTime? _backgroundedAt;
  bool _locked = false;

  @override
  void initState() {
    super.initState();
    _listener = AppLifecycleListener(
      onHide: () => _backgroundedAt = DateTime.now(),
      onShow: () {
        final since = _backgroundedAt;
        _backgroundedAt = null;
        if (since != null && DateTime.now().difference(since) >= kLockAfter) _lock();
      },
    );
  }

  @override
  void dispose() {
    _listener.dispose();
    super.dispose();
  }

  Future<void> _lock() async {
    if (!await _auth.isDeviceSupported()) return;
    setState(() => _locked = true);
    _unlock();
  }

  Future<void> _unlock() async {
    try {
      final ok = await _auth.authenticate(localizedReason: 'Unlock Ikibondo to see children’s records');
      if (ok && mounted) setState(() => _locked = false);
    } catch (_) {
      // Leave locked; the button retries
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (_locked)
          Positioned.fill(
            child: Scaffold(
              backgroundColor: colorCream,
              body: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.lock_outline, size: 48, color: colorInk),
                      const SizedBox(height: 16),
                      Text('Ikibondo is locked',
                          style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: colorInk)),
                      const SizedBox(height: 24),
                      ElevatedButton(onPressed: _unlock, child: const Text('Unlock')),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
