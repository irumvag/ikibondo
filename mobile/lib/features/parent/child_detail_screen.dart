import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/content/app_content.dart';
import '../../core/models/child.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/growth_chart.dart';
import '../../shared/widgets/health_guides.dart';
import '../../shared/widgets/risk_badge.dart';

final parentChildProvider = FutureProvider.family.autoDispose<Child, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.child(id));
  return Child.fromJson((resp.data['data'] ?? resp.data) as Map<String, dynamic>);
});

/// Measurements, oldest first. Parents may read their own child's records.
final childRecordsProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, String>((ref, id) async {
  final resp = await ApiClient.dio.get(
    Endpoints.healthRecords,
    queryParameters: {'child': id, 'ordering': 'measurement_date'},
  );
  return unwrapList(resp.data);
});

/// Plain-language growth summary the server writes for parents.
final _growthSummaryProvider = FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.growthData(id));
  final data = resp.data is Map ? resp.data['data'] : null;
  final summary = data is Map ? data['parent_summary'] : null;
  return summary is Map ? Map<String, dynamic>.from(summary) : const {};
});

final childVaccinesProvider = FutureProvider.family.autoDispose<List<Map<String, dynamic>>, String>((ref, id) async {
  final resp = await ApiClient.dio.get(
    Endpoints.vaccinations,
    queryParameters: {'child': id, 'ordering': 'scheduled_date', 'page_size': 100},
  );
  return unwrapList(resp.data);
});

/// The code printed on the child's official QR card (same as the health centre's card).
final _cardCodeProvider = FutureProvider.family.autoDispose<String?, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.childQr(id));
  final data = resp.data is Map ? resp.data['data'] : null;
  return data is Map ? data['qr_code'] as String? : null;
});

double? _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}');

class ParentChildDetailScreen extends ConsumerStatefulWidget {
  final String childId;
  const ParentChildDetailScreen({super.key, required this.childId});

  @override
  ConsumerState<ParentChildDetailScreen> createState() => _ParentChildDetailScreenState();
}

class _ParentChildDetailScreenState extends ConsumerState<ParentChildDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final childAsync = ref.watch(parentChildProvider(widget.childId));

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: childAsync.maybeWhen(data: (c) => Text(c.fullName), orElse: () => const Text('Child')),
        bottom: TabBar(
          controller: _tabs,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Growth'),
            Tab(text: 'Vaccines'),
            Tab(text: 'QR Card'),
          ],
        ),
      ),
      body: childAsync.when(
        loading: () => const AppLoader(),
        error: (e, _) => _Problem(
          'Could not load this child. Check your connection.',
          onRetry: () => ref.invalidate(parentChildProvider(widget.childId)),
        ),
        data: (child) => TabBarView(
          controller: _tabs,
          children: [
            _OverviewTab(child: child),
            _GrowthTab(childId: child.id),
            _VaccinesTab(child: child),
            _QrTab(child: child),
          ],
        ),
      ),
    );
  }
}

// ── Shared bits ─────────────────────────────────────────────────────────────
class _Problem extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _Problem(this.message, {required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, color: colorMuted, size: 36),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center, style: GoogleFonts.inter(color: colorMuted)),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      );
}

class _Card extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const _Card({required this.child, this.padding = const EdgeInsets.all(16)});

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(18), boxShadow: softShadow),
        child: child,
      );
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
        child: Text(text, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
      );
}

// ── Overview ────────────────────────────────────────────────────────────────
class _OverviewTab extends ConsumerWidget {
  final Child child;
  const _OverviewTab({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(childRecordsProvider(child.id)).value ?? const [];
    final latest = records.isNotEmpty ? records.last : null;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(childRecordsProvider(child.id));
        ref.invalidate(parentChildProvider(child.id));
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: const LinearGradient(colors: [colorInk, colorSky], begin: Alignment.topLeft, end: Alignment.bottomRight),
              boxShadow: softShadow,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.white,
                  child: Text(child.fullName.isNotEmpty ? child.fullName[0] : '?',
                      style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: colorInk)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(child.fullName,
                          style: GoogleFonts.inter(fontSize: 19, fontWeight: FontWeight.w700, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text('${child.ageDisplay ?? ''} · ${child.sex == 'F' ? 'Girl' : 'Boy'}',
                          style: GoogleFonts.inter(fontSize: 13, color: Colors.white.withValues(alpha: 0.85))),
                    ],
                  ),
                ),
                if (latest != null)
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9)),
                    child: RiskBadge(nutritionStatus: latest['nutrition_status'] as String?),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          if (latest != null) ...[
            const _SectionTitle('Last check-up'),
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${latest['measurement_date']} · by ${latest['recorded_by_name'] ?? 'health worker'}',
                      style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _Metric('Weight', latest['weight_kg'], 'kg'),
                      _Metric('Height', latest['height_cm'], 'cm'),
                      _Metric('Arm (MUAC)', latest['muac_cm'], 'cm'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (_num(latest['muac_cm']) != null) MuacExplainer(cm: _num(latest['muac_cm']), showIntro: false),
            const SizedBox(height: 14),
          ],

          const _SectionTitle('Details'),
          _Card(
            child: Column(
              children: [
                _InfoRow(Icons.badge_outlined, 'Registration', child.registrationNumber),
                if (child.campName != null) _InfoRow(Icons.location_on_outlined, 'Camp', child.campName!),
                if (child.zoneName != null) _InfoRow(Icons.map_outlined, 'Zone', child.zoneName!),
                _InfoRow(Icons.cake_outlined, 'Born', child.dateOfBirth),
              ],
            ),
          ),

          if (child.assignedChwName != null) ...[
            const SizedBox(height: 14),
            const _SectionTitle('Your care team'),
            _Card(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: colorBgSand,
                    child: Text(child.assignedChwName![0],
                        style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: colorInk)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(child.assignedChwName!,
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                        Text('Community health worker', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                      ],
                    ),
                  ),
                  if (child.assignedChwPhone != null)
                    IconButton.filledTonal(
                      tooltip: 'Call',
                      icon: const Icon(Icons.phone, color: colorSuccess),
                      onPressed: () => launchUrl(Uri.parse('tel:${child.assignedChwPhone}')),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final dynamic value;
  final String unit;
  const _Metric(this.label, this.value, this.unit);

  @override
  Widget build(BuildContext context) {
    final v = _num(value);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
          const SizedBox(height: 2),
          Text(v == null ? '—' : '${v % 1 == 0 ? v.toInt() : v} $unit',
              style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: colorInk)),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            Icon(icon, size: 18, color: colorMuted),
            const SizedBox(width: 10),
            SizedBox(width: 100, child: Text(label, style: GoogleFonts.inter(fontSize: 13, color: colorMuted))),
            Expanded(
              child: Text(value,
                  style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
            ),
          ],
        ),
      );
}

// ── Growth ──────────────────────────────────────────────────────────────────
class _GrowthTab extends ConsumerWidget {
  final String childId;
  const _GrowthTab({required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordsAsync = ref.watch(childRecordsProvider(childId));
    final summary = ref.watch(_growthSummaryProvider(childId)).value ?? const {};

    return recordsAsync.when(
      loading: () => const AppLoader(),
      error: (_, __) => _Problem('Could not load growth. Check your connection.',
          onRetry: () => ref.invalidate(childRecordsProvider(childId))),
      data: (records) {
        final onTrack = summary['status'] == 'on_track';

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(childRecordsProvider(childId)),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (summary.isNotEmpty)
                _Card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(onTrack ? Icons.check_circle : Icons.info,
                          color: onTrack ? colorSuccess : colorWarn, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(onTrack ? 'Growing well' : 'Needs attention',
                                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                            if ((summary['message'] as String?)?.isNotEmpty ?? false) ...[
                              const SizedBox(height: 4),
                              Text(summary['message'] as String,
                                  style: GoogleFonts.inter(fontSize: 13, color: colorMuted, height: 1.4)),
                            ],
                            if (summary['latest_milestone'] != null) ...[
                              const SizedBox(height: 10),
                              Text('Now: ${summary['latest_milestone']}',
                                  style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
                            ],
                            if (summary['next_milestone'] != null)
                              Text('Next: ${summary['next_milestone']}',
                                  style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 14),
              GrowthChart(
                childId: childId,
                entries: [
                  for (final r in records)
                    (
                      date: '${r['measurement_date'] ?? ''}',
                      weightKg: _num(r['weight_kg']),
                      heightCm: _num(r['height_cm']),
                    ),
                ],
              ),
              if (records.isNotEmpty) ...[
                const SizedBox(height: 14),
                const _SectionTitle('Check-ups'),
                for (final r in records.reversed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _Card(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${r['measurement_date']}',
                                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    if (_num(r['weight_kg']) != null) '${_num(r['weight_kg'])} kg',
                                    if (_num(r['height_cm']) != null) '${_num(r['height_cm'])} cm',
                                    if (_num(r['muac_cm']) != null) 'arm ${_num(r['muac_cm'])} cm',
                                  ].join(' · '),
                                  style: GoogleFonts.inter(fontSize: 12, color: colorMuted),
                                ),
                              ],
                            ),
                          ),
                          RiskBadge(nutritionStatus: r['nutrition_status'] as String?, compact: true),
                        ],
                      ),
                    ),
                  ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }
}

// ── Vaccines (frosted glass) ────────────────────────────────────────────────
Color vaccineStatusColor(String status, bool overdue) {
  if (status == 'DONE') return colorSuccess;
  if (status == 'MISSED' || overdue) return colorDanger;
  if (status == 'SKIPPED') return colorMuted;
  return colorInk;
}

String vaccineStatusLabel(String status, bool overdue) {
  if (status == 'DONE') return 'Given';
  if (status == 'MISSED') return 'Missed';
  if (status == 'SKIPPED') return 'Skipped';
  return overdue ? 'Overdue' : 'Upcoming';
}

class _VaccinesTab extends ConsumerWidget {
  final Child child;
  const _VaccinesTab({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vaccAsync = ref.watch(childVaccinesProvider(child.id));

    return GlassBackground(
      child: vaccAsync.when(
        loading: () => const AppLoader(),
        error: (_, __) => _Problem('Could not load vaccinations. Check your connection.',
            onRetry: () => ref.invalidate(childVaccinesProvider(child.id))),
        data: (items) {
          final given = items.where((v) => v['status'] == 'DONE').length;
          final next = items.where((v) => v['status'] == 'SCHEDULED').firstOrNull;
          final progress = items.isEmpty ? 0.0 : given / items.length;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(childVaccinesProvider(child.id)),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          SizedBox(
                            width: 64,
                            height: 64,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                CircularProgressIndicator(
                                  value: progress,
                                  strokeWidth: 7,
                                  backgroundColor: Colors.white,
                                  color: colorSuccess,
                                ),
                                Center(
                                  child: Text('${(progress * 100).round()}%',
                                      style: GoogleFonts.inter(fontWeight: FontWeight.w800, color: colorInk)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('$given of ${items.length} doses given',
                                    style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                                const SizedBox(height: 4),
                                Text(
                                  next == null
                                      ? 'No dose is waiting.'
                                      : 'Next: ${next['vaccine_name']} on ${next['scheduled_date']}',
                                  style: GoogleFonts.inter(fontSize: 13, color: colorMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.workspace_premium_outlined),
                          label: const Text('Vaccination certificate'),
                          onPressed: () => context.push('/parent/children/${child.id}/certificate'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (items.isEmpty)
                  GlassCard(
                    child: Text('No vaccinations scheduled yet.',
                        textAlign: TextAlign.center, style: GoogleFonts.inter(color: colorMuted)),
                  ),
                for (final v in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: VaccineGlassRow(v),
                  ),
                const SizedBox(height: 8),
                const CertificateHelpCard(),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }
}

class VaccineGlassRow extends StatelessWidget {
  final Map<String, dynamic> v;
  const VaccineGlassRow(this.v, {super.key});

  @override
  Widget build(BuildContext context) {
    final status = v['status'] as String? ?? '';
    final overdue = v['is_overdue'] == true;
    final color = vaccineStatusColor(status, overdue);
    final date = status == 'DONE' ? (v['administered_date'] ?? v['scheduled_date']) : v['scheduled_date'];

    final protects = vaccineProtects(v);
    return GestureDetector(
      onTap: () => showVaccineInfoSheet(context, v),
      child: GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      radius: 16,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
            child: Icon(status == 'DONE' ? Icons.verified : Icons.vaccines_outlined, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(vaccineTitle(v),
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                if (protects != null)
                  Text(protects,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.inter(fontSize: 12, height: 1.3, color: colorInk.withValues(alpha: 0.75))),
                Text('${v['vaccine_name'] ?? ''} · dose ${v['dose_number'] ?? 1} · ${date ?? ''}',
                    style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
            child: Text(vaccineStatusLabel(status, overdue),
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
          ),
        ],
      ),
    ),
    );
  }
}

/// "How to get a certificate" — wording set by the admin (Site content).
class CertificateHelpCard extends ConsumerWidget {
  const CertificateHelpCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(appContentProvider('app.certificate'));
    final steps = (c['steps'] as List?) ?? const [];
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.help_outline, color: colorInk, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text('${c['title']}',
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text('${c['body']}', style: GoogleFonts.inter(fontSize: 13, color: colorMuted, height: 1.4)),
          const SizedBox(height: 8),
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 11,
                    backgroundColor: colorInk,
                    child: Text('${i + 1}',
                        style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                              text: '${(steps[i] as Map)['title'] ?? ''}\n',
                              style: const TextStyle(fontWeight: FontWeight.w700, color: colorInk)),
                          TextSpan(text: '${(steps[i] as Map)['description'] ?? ''}'),
                        ],
                      ),
                      style: GoogleFonts.inter(fontSize: 13, color: colorMuted, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── QR card ─────────────────────────────────────────────────────────────────
class _QrTab extends ConsumerWidget {
  final Child child;
  const _QrTab({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Offline: the registration number, which the scanner also accepts
    final code = ref.watch(_cardCodeProvider(child.id)).value ?? child.registrationNumber;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Container(
          decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(24), boxShadow: softShadow),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              // Card header, like a clinic ID card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: [colorInk, colorSky], begin: Alignment.topLeft, end: Alignment.bottomRight),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
                      child: const IkibondoLogo(size: 32, showName: false),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Ikibondo health card',
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
                          Text(child.campName ?? '',
                              style: GoogleFonts.inter(fontSize: 12, color: Colors.white.withValues(alpha: 0.85))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Column(
                  children: [
                    Text(child.fullName,
                        style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: colorInk)),
                    const SizedBox(height: 2),
                    Text('${child.ageDisplay ?? ''} · born ${child.dateOfBirth}',
                        style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: colorBorder, width: 1.5),
                      ),
                      child: QrImageView(
                        data: code,
                        version: QrVersions.auto,
                        size: 220,
                        gapless: true,
                        eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.circle, color: colorInk),
                        dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.circle, color: Color(0xFF0B2545)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
                      child: Text(child.registrationNumber,
                          style: GoogleFonts.robotoMono(fontSize: 15, fontWeight: FontWeight.w600, color: colorInk,
                              letterSpacing: 1)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, size: 18, color: colorMuted),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Show this card at the health centre or to your community health worker. '
                'They scan it to open your child\'s record. If scanning fails, they can type the number.',
                style: GoogleFonts.inter(fontSize: 12, color: colorMuted, height: 1.45),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
