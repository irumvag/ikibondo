import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';

/// Shown on opening while the app checks for a saved sign-in. Matches the
/// native launch screen (blue, logo in the centre) so the hand-over is seamless.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colorInk,
        body: Column(
          children: [
            const Spacer(flex: 3),
            Center(
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.85, end: 1),
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOutBack,
                builder: (_, scale, child) => Transform.scale(scale: scale, child: child),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(30)),
                  child: const IkibondoLogo(size: 96, showName: false),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Text('Ikibondo',
                style: GoogleFonts.inter(
                    fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.5, color: Colors.white)),
            const SizedBox(height: 6),
            Text('Healthy children, thriving communities',
                style: GoogleFonts.inter(fontSize: 14, color: Colors.white.withValues(alpha: 0.8))),
            const Spacer(flex: 2),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }
}
