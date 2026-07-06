import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/models/health_record.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/risk_badge.dart';

final _childDetailProvider = FutureProvider.family.autoDispose<Child, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.child(id));
  return Child.fromJson((resp.data['data'] ?? resp.data) as Map<String, dynamic>);
});

final _latestRecordProvider = FutureProvider.family.autoDispose<HealthRecord?, String>((ref, childId) async {
  final resp = await ApiClient.dio.get(
    Endpoints.healthRecords,
    queryParameters: {'child': childId, 'ordering': '-measurement_date', 'page_size': 1},
  );
  final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
  if (items.isEmpty) return null;
  return HealthRecord.fromJson(items.first as Map<String, dynamic>);
});

class ChwChildDetailScreen extends ConsumerWidget {
  final String childId;
  const ChwChildDetailScreen({super.key, required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childAsync  = ref.watch(_childDetailProvider(childId));
    final recordAsync = ref.watch(_latestRecordProvider(childId));

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: childAsync.maybeWhen(data: (c) => Text(c.fullName), orElse: () => const Text('Child')),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_chart),
            tooltip: 'Log visit',
            onPressed: () => context.go('/chw/visit?child=$childId'),
          ),
        ],
      ),
      body: childAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: colorDanger))),
        data: (child) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Header card ───────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: colorBgElev,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: colorBorder),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(
                      color: colorBgSand,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(child: Text(child.fullName[0],
                        style: GoogleFonts.inter(fontSize: 26, fontWeight: FontWeight.w700, color: colorInk))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(child.fullName, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk)),
                        const SizedBox(height: 4),
                        Text('${child.ageDisplay ?? ''} · ${child.sex}',
                            style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                        const SizedBox(height: 4),
                        Text(child.registrationNumber, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                        const SizedBox(height: 8),
                        RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // ── Guardian contact ──────────────────────────────────────────
            if (child.guardianName != null)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colorBgElev,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colorBorder),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person_outline, color: colorMuted, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(child.guardianName!, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                          Text('Guardian / Parent', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                        ],
                      ),
                    ),
                    if (child.guardianPhone != null)
                      IconButton(
                        icon: const Icon(Icons.phone, color: colorSuccess),
                        onPressed: () => launchUrl(Uri.parse('tel:${child.guardianPhone}')),
                      ),
                  ],
                ),
              ),

            const SizedBox(height: 12),

            // ── Latest measurement ────────────────────────────────────────
            Text('Latest measurement', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
            const SizedBox(height: 8),
            recordAsync.when(
              loading: () => const SkeletonCard(),
              error: (_, __) => const SizedBox.shrink(),
              data: (record) {
                if (record == null) {
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(12)),
                    child: Text('No records yet', style: GoogleFonts.inter(color: colorMuted)),
                  );
                }
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colorBgElev,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: colorBorder),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _MeasTile(label: 'Weight', value: '${record.weightKg?.toStringAsFixed(1) ?? '—'} kg'),
                          _MeasTile(label: 'Height', value: '${record.heightCm?.toStringAsFixed(1) ?? '—'} cm'),
                          _MeasTile(label: 'MUAC',   value: '${record.muacCm?.toStringAsFixed(1) ?? '—'} cm'),
                        ],
                      ),
                      if (record.symptomFlags?.isNotEmpty == true) ...[
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6, runSpacing: 6,
                          children: record.symptomFlags!.map((s) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: colorHighBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(s.replaceAll('_', ' '), style: GoogleFonts.inter(fontSize: 11, color: colorDanger)),
                          )).toList(),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),

            const SizedBox(height: 16),

            // ── Quick actions ─────────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => context.go('/chw/visit?child=$childId'),
                    icon: const Icon(Icons.add_chart),
                    label: const Text('Log visit'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/chw/vaccines'),
                    icon: const Icon(Icons.vaccines),
                    label: const Text('Vaccines'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MeasTile extends StatelessWidget {
  final String label;
  final String value;
  const _MeasTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(value, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk)),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
      ],
    ),
  );
}
