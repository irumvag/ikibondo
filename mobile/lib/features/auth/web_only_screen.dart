import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/sign_out_button.dart';

/// Government and partner accounts see aggregated statistics on the Ikibondo website;
/// the field app has nothing for them.
class WebOnlyScreen extends StatelessWidget {
  const WebOnlyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Ikibondo'), actions: const [SignOutButton()]),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.insights_outlined, size: 48, color: colorInk),
              const SizedBox(height: 16),
              Text('Statistics are on the website',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w700, color: colorInk)),
              const SizedBox(height: 8),
              Text(
                'Your account shows camp-level statistics and reports. Sign in to the Ikibondo '
                'website on a computer or phone browser to see them.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 14, color: colorMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
