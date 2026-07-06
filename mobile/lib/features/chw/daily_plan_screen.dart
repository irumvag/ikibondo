import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';

final _dailyPlanProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.chwDailyPlan);
  return (resp.data['data'] ?? resp.data) as List? ?? [];
});

class DailyPlanScreen extends ConsumerWidget {
  const DailyPlanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plan = ref.watch(_dailyPlanProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text("Today's Plan")),
      body: plan.when(
        loading: () => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          itemBuilder: (_, __) => const Padding(padding: EdgeInsets.only(bottom: 10), child: SkeletonCard()),
        ),
        error: (e, _) => Center(child: Text('Failed to load plan', style: GoogleFonts.inter(color: colorDanger))),
        data: (items) {
          if (items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.event_available, size: 56, color: colorSuccess),
                  const SizedBox(height: 12),
                  Text('No visits scheduled today', style: GoogleFonts.inter(fontSize: 16, color: colorInk, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            itemBuilder: (ctx, i) {
              final item = items[i] as Map<String, dynamic>;
              final priority = item['priority_score'] as num? ?? 0;
              final childId  = item['child_id'] as String?;
              final name     = item['child_name'] as String? ?? 'Unknown';
              final reason   = item['visit_reason'] as String? ?? '';

              return GestureDetector(
                onTap: childId != null ? () => context.go('/chw/children/$childId') : null,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colorBgElev,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: priority > 7 ? colorDanger.withOpacity(0.3)
                           : priority > 4 ? colorWarn.withOpacity(0.3)
                           : colorBorder,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: priority > 7 ? colorHighBg : priority > 4 ? colorMedBg : colorLowBg,
                          shape: BoxShape.circle,
                        ),
                        child: Center(child: Text('${i + 1}', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700,
                          color: priority > 7 ? colorDanger : priority > 4 ? colorWarn : colorSuccess))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                            if (reason.isNotEmpty)
                              Text(reason, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: colorMuted),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
