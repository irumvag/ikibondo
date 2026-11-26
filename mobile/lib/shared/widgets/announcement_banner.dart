import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/content/app_content.dart';
import '../../core/theme/app_theme.dart';

/// Announcements an admin publishes for dashboards (website → Admin → Announcements).
/// Shows nothing when there are none or the phone is offline.
class AnnouncementBanner extends ConsumerWidget {
  const AnnouncementBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(announcementsProvider).value ?? const <String>[];
    if (messages.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        for (final m in messages)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2F1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colorGold.withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.campaign_outlined, color: colorGold, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(m, style: GoogleFonts.inter(fontSize: 13.5, height: 1.4, color: colorInk)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
