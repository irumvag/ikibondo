import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/models/health_record.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/risk_badge.dart';

final _parentChildProvider = FutureProvider.family.autoDispose<Child, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.child(id));
  return Child.fromJson((resp.data['data'] ?? resp.data) as Map<String, dynamic>);
});

final _growthProvider = FutureProvider.family.autoDispose<List<GrowthPoint>, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.growthData(id));
  final items = (resp.data['data'] ?? resp.data) as List? ?? [];
  return items.map((e) => GrowthPoint.fromJson(e as Map<String, dynamic>)).toList();
});

class ParentChildDetailScreen extends ConsumerStatefulWidget {
  final String childId;
  const ParentChildDetailScreen({super.key, required this.childId});

  @override
  ConsumerState<ParentChildDetailScreen> createState() => _ParentChildDetailScreenState();
}

class _ParentChildDetailScreenState extends ConsumerState<ParentChildDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final childAsync = ref.watch(_parentChildProvider(widget.childId));

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: childAsync.maybeWhen(data: (c) => Text(c.fullName), orElse: () => const Text('Child')),
        bottom: TabBar(
          controller: _tabs,
          labelColor: colorCream,
          unselectedLabelColor: const Color(0xFF8BBFB0),
          indicatorColor: colorGold,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Growth'),
            Tab(text: 'Vaccines'),
            Tab(text: 'QR Card'),
          ],
        ),
      ),
      body: childAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: colorDanger))),
        data: (child) => TabBarView(
          controller: _tabs,
          children: [
            _OverviewTab(child: child),
            _GrowthTab(childId: widget.childId),
            _VaccinesTab(childId: widget.childId),
            _QrTab(child: child),
          ],
        ),
      ),
    );
  }
}

// ── Overview tab ──────────────────────────────────────────────────────────
class _OverviewTab extends StatelessWidget {
  final Child child;
  const _OverviewTab({required this.child});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Info card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorBgElev,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colorBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InfoRow('Age', child.ageDisplay ?? '—'),
              _InfoRow('Sex', child.sex),
              _InfoRow('Registration', child.registrationNumber),
              if (child.campName != null) _InfoRow('Camp', child.campName!),
              const SizedBox(height: 10),
              RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // CHW contact
        if (child.assignedChwName != null)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colorBgElev,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colorBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Your care team', style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: colorMuted, letterSpacing: 0.5)),
                const SizedBox(height: 10),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: colorBgSand,
                      child: Text(child.assignedChwName![0], style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: colorInk)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(child.assignedChwName!, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                          Text('Community Health Worker', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                        ],
                      ),
                    ),
                    if (child.assignedChwPhone != null)
                      IconButton(
                        icon: const Icon(Icons.phone, color: colorSuccess),
                        onPressed: () => launchUrl(Uri.parse('tel:${child.assignedChwPhone}')),
                      ),
                  ],
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        SizedBox(width: 110, child: Text(label, style: GoogleFonts.inter(fontSize: 13, color: colorMuted))),
        Expanded(child: Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk))),
      ],
    ),
  );
}

// ── Growth chart tab ──────────────────────────────────────────────────────
class _GrowthTab extends ConsumerWidget {
  final String childId;
  const _GrowthTab({required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final growthAsync = ref.watch(_growthProvider(childId));

    return growthAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const Center(child: Text('Failed to load growth data')),
      data: (points) {
        if (points.isEmpty) {
          return Center(child: Text('No growth data yet', style: GoogleFonts.inter(color: colorMuted)));
        }

        final wazSpots = <FlSpot>[];
        final hazSpots = <FlSpot>[];

        for (int i = 0; i < points.length; i++) {
          if (points[i].waz != null) wazSpots.add(FlSpot(i.toDouble(), points[i].waz!));
          if (points[i].haz != null) hazSpots.add(FlSpot(i.toDouble(), points[i].haz!));
        }

        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Growth Z-scores', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colorInk)),
              const SizedBox(height: 4),
              Text('WAZ = Weight-for-Age  ·  HAZ = Height-for-Age',
                  style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
              const SizedBox(height: 16),
              SizedBox(
                height: 220,
                child: LineChart(
                  LineChartData(
                    minY: -4, maxY: 4,
                    gridData: const FlGridData(show: true),
                    borderData: FlBorderData(show: false),
                    lineBarsData: [
                      if (wazSpots.isNotEmpty) _line(wazSpots, colorInk),
                      if (hazSpots.isNotEmpty) _line(hazSpots, colorGold),
                    ],
                    // WHO -2 SD reference line
                    extraLinesData: ExtraLinesData(horizontalLines: [
                      HorizontalLine(y: -2, color: colorDanger.withOpacity(0.4), strokeWidth: 1,
                          dashArray: [4, 4], label: HorizontalLineLabel(show: true, labelResolver: (_) => '-2 SD')),
                      HorizontalLine(y: 0, color: colorSuccess.withOpacity(0.3), strokeWidth: 1),
                    ]),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _Legend(color: colorInk, label: 'WAZ (weight-for-age)'),
                  const SizedBox(width: 16),
                  _Legend(color: colorGold, label: 'HAZ (height-for-age)'),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  LineChartBarData _line(List<FlSpot> spots, Color color) => LineChartBarData(
    spots: spots,
    isCurved: true,
    color: color,
    barWidth: 2.5,
    dotData: const FlDotData(show: false),
  );
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(width: 16, height: 3, color: color),
      const SizedBox(width: 6),
      Text(label, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
    ],
  );
}

// ── Vaccines tab ──────────────────────────────────────────────────────────
class _VaccinesTab extends ConsumerWidget {
  final String childId;
  const _VaccinesTab({required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vaccAsync = FutureProvider.autoDispose((ref) async {
      final resp = await ApiClient.dio.get(Endpoints.vaccinations, queryParameters: {'child': childId});
      final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
      return items;
    });

    return ref.watch(vaccAsync).when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => const Center(child: Text('Failed to load vaccines')),
      data: (items) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final v = items[i] as Map<String, dynamic>;
          final status = v['status'] as String? ?? '';
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colorBgElev,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colorBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: status == 'DONE' ? colorSuccess
                         : status == 'MISSED' ? colorDanger
                         : status == 'SKIPPED' ? colorMuted
                         : colorWarn,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(v['vaccine_name'] as String? ?? '', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
                      Text('Dose ${v['dose_number'] ?? 1}  ·  ${v['scheduled_date'] ?? ''}',
                          style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: status == 'DONE' ? colorLowBg
                         : status == 'MISSED' ? colorHighBg
                         : colorMedBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(status, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700,
                      color: status == 'DONE' ? colorSuccess : status == 'MISSED' ? colorDanger : colorWarn)),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── QR Card tab ───────────────────────────────────────────────────────────
class _QrTab extends StatelessWidget {
  final Child child;
  const _QrTab({required this.child});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colorBgElev,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: colorBorder),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 4))],
              ),
              child: Column(
                children: [
                  Text(child.fullName, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk)),
                  Text(child.registrationNumber, style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                  const SizedBox(height: 16),
                  QrImageView(
                    data: child.id,
                    version: QrVersions.auto,
                    size: 200,
                    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF085041)),
                    dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Color(0xFF085041)),
                  ),
                  const SizedBox(height: 12),
                  Text('Scan to view health record', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
