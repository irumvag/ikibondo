import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

/// One measurement as the chart needs it.
typedef GrowthEntry = ({String date, double? weightKg, double? heightCm});

/// WHO reference lines for this child's sex, plus date of birth (growth-data endpoint).
final whoBandsProvider = FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, childId) async {
  final resp = await ApiClient.dio.get(Endpoints.growthData(childId));
  final data = resp.data is Map ? resp.data['data'] : null;
  return data is Map ? Map<String, dynamic>.from(data) : const {};
});

// Zone colours, as on the WHO / road-to-health cards
const _severe = Color(0xFFF8B4B4); // below -3 SD
const _moderate = Color(0xFFFDE68A); // -3 to -2 SD
const _normal = Color(0xFFBBF7D0); // -2 to +2 SD
const _above = Color(0xFFE0F2FE); // above +2 SD

/// A WHO growth chart: the child's weight (or height) by age, drawn over the
/// standard zones for their sex. Works from the first measurement onwards.
class GrowthChart extends ConsumerStatefulWidget {
  final String childId;
  final List<GrowthEntry> entries;
  const GrowthChart({super.key, required this.childId, required this.entries});

  @override
  ConsumerState<GrowthChart> createState() => _GrowthChartState();
}

class _GrowthChartState extends ConsumerState<GrowthChart> {
  bool _weight = true;

  @override
  Widget build(BuildContext context) {
    final who = ref.watch(whoBandsProvider(widget.childId)).value ?? const {};
    final dob = DateTime.tryParse('${who['date_of_birth'] ?? ''}');
    final bandsAll = who['who_sd_bands'] is Map ? who['who_sd_bands'] as Map : const {};
    final bands = ((bandsAll[_weight ? 'weight_for_age' : 'height_for_age'] as List?) ?? const [])
        .whereType<Map>()
        .toList();

    // Child's points: x = age in months at the measurement
    final points = <FlSpot>[];
    final labels = <String>[];
    for (final e in widget.entries) {
      final v = _weight ? e.weightKg : e.heightCm;
      final d = DateTime.tryParse(e.date);
      if (v == null || d == null || dob == null) continue;
      points.add(FlSpot(d.difference(dob).inDays / 30.4375, v));
      labels.add(e.date);
    }
    final unit = _weight ? 'kg' : 'cm';
    final trend = _weight ? _trendMessage(points) : null;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 14, 12),
      decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(18), boxShadow: softShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SizedBox(width: 4),
              Expanded(
                child: Text(_weight ? 'Weight for age' : 'Height for age',
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
              ),
              SegmentedButton<bool>(
                segments: const [
                  ButtonSegment(value: true, label: Text('Weight')),
                  ButtonSegment(value: false, label: Text('Height')),
                ],
                selected: {_weight},
                showSelectedIcon: false,
                style: SegmentedButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                  selectedBackgroundColor: colorInk,
                  selectedForegroundColor: Colors.white,
                  foregroundColor: colorInk,
                ),
                onSelectionChanged: (s) => setState(() => _weight = s.first),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(left: 4, top: 2),
            child: Text('WHO standard for ${who['sex'] == 'F' ? 'girls' : 'boys'} · age in months',
                style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted)),
          ),
          const SizedBox(height: 12),
          if (points.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 28),
              child: Center(child: Text('No measurements yet.', style: GoogleFonts.inter(color: colorMuted))),
            )
          else
            SizedBox(height: 240, child: LineChart(_data(points, labels, bands, unit))),
          const SizedBox(height: 10),
          const _Legend(),
          if (trend != null) ...[
            const SizedBox(height: 10),
            _TrendNote(trend),
          ],
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 4)),
              icon: const Icon(Icons.menu_book_outlined, size: 18),
              label: const Text('How to read this chart'),
              onPressed: () => showGrowthChartGuide(context),
            ),
          ),
        ],
      ),
    );
  }

  /// "The direction of the curve matters more than the weight": flag a flat or falling line.
  ({String text, bool warn})? _trendMessage(List<FlSpot> p) {
    if (p.length < 2) {
      return (text: 'One weight so far. The line shows the trend after the next check-up.', warn: false);
    }
    final a = p[p.length - 2], b = p.last;
    final months = (b.x - a.x).clamp(0.01, 100.0);
    final gainPerMonth = (b.y - a.y) / months;
    if (b.y < a.y) return (text: 'Weight went down since the last check-up. See a health worker soon.', warn: true);
    if (gainPerMonth < 0.1 && months >= 0.9) {
      return (text: 'Weight has not gone up since the last check-up (flat line). Ask your health worker.', warn: true);
    }
    return (text: 'Weight is going up, as it should.', warn: false);
  }

  LineChartData _data(List<FlSpot> points, List<String> labels, List<Map> bands, String unit) {
    final firstAge = points.first.x, lastAge = points.last.x;
    var minX = (firstAge - 2).clamp(0, 60).floorToDouble();
    var maxX = (lastAge + 3).clamp(0, 60).ceilToDouble();
    if (maxX - minX < 6) maxX = (minX + 6).clamp(0, 60).toDouble();
    if (maxX - minX < 6) minX = (maxX - 6).clamp(0, 60).toDouble();

    List<FlSpot> line(String key) => [
          for (final b in bands)
            if ((b['age_months'] as num) >= minX && (b['age_months'] as num) <= maxX && b[key] != null)
              FlSpot((b['age_months'] as num).toDouble(), (b[key] as num).toDouble()),
        ];
    final neg3 = line('sd_neg3'), neg2 = line('sd_neg2'), med = line('median'), pos2 = line('sd2'), pos3 = line('sd3');

    // Y range: the zones in view plus the child's points
    final ys = [...points.map((p) => p.y), ...neg3.map((p) => p.y), ...pos3.map((p) => p.y)];
    final minY = (ys.reduce((a, b) => a < b ? a : b) - (_weight ? 0.5 : 2)).floorToDouble();
    final maxY = (ys.reduce((a, b) => a > b ? a : b) + (_weight ? 0.5 : 2)).ceilToDouble();
    final yStep = _weight ? ((maxY - minY) / 5).ceilToDouble().clamp(1, 10).toDouble() : 5.0;

    LineChartBarData ref(List<FlSpot> s, {Color color = Colors.transparent, double width = 0, List<int>? dash}) =>
        LineChartBarData(
          spots: s,
          isCurved: true,
          color: color,
          barWidth: width,
          dashArray: dash,
          dotData: const FlDotData(show: false),
        );
    // A flat line at the chart floor/ceiling to fill the outer zones against
    final floor = [FlSpot(minX, minY), FlSpot(maxX, minY)];
    final ceil = [FlSpot(minX, maxY), FlSpot(maxX, maxY)];
    final hasBands = neg3.length > 1;

    final bars = <LineChartBarData>[
      if (hasBands) ...[
        ref(floor), // 0
        ref(neg3, color: const Color(0xFFDC2626), width: 1), // 1  -3 SD
        ref(neg2, color: const Color(0xFFD97706), width: 1), // 2  -2 SD
        ref(med, color: const Color(0xFF15803D), width: 1.5, dash: [5, 4]), // 3  median
        ref(pos2, color: const Color(0xFFD97706), width: 1), // 4  +2 SD
        ref(pos3), // 5  +3 SD (edge only)
        ref(ceil), // 6
      ],
      LineChartBarData(
        spots: points,
        isCurved: false,
        color: colorInk,
        barWidth: 3,
        dotData: FlDotData(
          getDotPainter: (_, __, ___, ____) =>
              FlDotCirclePainter(radius: 5, color: Colors.white, strokeWidth: 3, strokeColor: colorInk),
        ),
      ),
    ];
    final childIndex = bars.length - 1;

    return LineChartData(
      minX: minX,
      maxX: maxX,
      minY: minY,
      maxY: maxY,
      clipData: const FlClipData.all(),
      lineBarsData: bars,
      betweenBarsData: hasBands
          ? [
              BetweenBarsData(fromIndex: 0, toIndex: 1, color: _severe),
              BetweenBarsData(fromIndex: 1, toIndex: 2, color: _moderate),
              BetweenBarsData(fromIndex: 2, toIndex: 4, color: _normal),
              BetweenBarsData(fromIndex: 4, toIndex: 6, color: _above),
            ]
          : const [],
      gridData: FlGridData(
        horizontalInterval: yStep,
        verticalInterval: 1,
        getDrawingHorizontalLine: (_) => FlLine(color: Colors.white.withValues(alpha: 0.7), strokeWidth: 0.8),
        getDrawingVerticalLine: (_) => FlLine(color: Colors.white.withValues(alpha: 0.5), strokeWidth: 0.6),
      ),
      borderData: FlBorderData(show: true, border: Border.all(color: colorBorder)),
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (_) => colorInk,
          getTooltipItems: (spots) => [
            for (final s in spots)
              s.barIndex == childIndex
                  ? LineTooltipItem('${s.y} $unit\n${labels[points.indexOf(FlSpot(s.x, s.y)).clamp(0, labels.length - 1)]}',
                      GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white))
                  : null,
          ],
        ),
      ),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 38,
            interval: yStep,
            getTitlesWidget: (v, _) => Text('${v.toStringAsFixed(0)} $unit',
                style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
          ),
        ),
        bottomTitles: AxisTitles(
          axisNameSize: 16,
          axisNameWidget: Text('Age (months)', style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 20,
            interval: (maxX - minX) > 12 ? 3 : 1,
            getTitlesWidget: (v, _) => Text(v.toStringAsFixed(0),
                style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
          ),
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend();

  @override
  Widget build(BuildContext context) {
    Widget item(Color c, String t) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 5),
            Text(t, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
          ],
        );
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        item(_normal, 'Normal'),
        item(_moderate, 'Moderate (below −2)'),
        item(_severe, 'Severe (below −3)'),
        Row(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 14, height: 3, color: colorInk),
          const SizedBox(width: 5),
          Text('Your child', style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
        ]),
      ],
    );
  }
}

class _TrendNote extends StatelessWidget {
  final ({String text, bool warn}) trend;
  const _TrendNote(this.trend);

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: trend.warn ? colorHighBg : colorLowBg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(trend.warn ? Icons.trending_down : Icons.trending_up,
                size: 18, color: trend.warn ? colorDanger : colorSuccess),
            const SizedBox(width: 8),
            Expanded(
              child: Text(trend.text,
                  style: GoogleFonts.inter(
                      fontSize: 12.5, fontWeight: FontWeight.w600, color: trend.warn ? colorDanger : colorSuccess)),
            ),
          ],
        ),
      );
}

/// Plain-language guide to the growth chart, for parents and community health workers.
/// Based on the WHO child growth standards (2006).
void showGrowthChartGuide(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: colorBgElev,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.8,
      maxChildSize: 0.95,
      builder: (_, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
        children: [
          Text('How to read the growth chart',
              style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: colorInk)),
          const SizedBox(height: 6),
          Text('The chart compares your child with healthy children of the same age and sex '
              '(WHO child growth standards).',
              style: GoogleFonts.inter(fontSize: 13.5, height: 1.45, color: colorMuted)),
          const SizedBox(height: 18),
          const _GuideStep(Icons.swap_horiz, 'Bottom line: age',
              'Months since birth. Each dot is one check-up, placed at the child\'s age that day.'),
          const _GuideStep(Icons.swap_vert, 'Side line: weight or height',
              'Switch between weight and height at the top of the chart.'),
          const _GuideStep(Icons.circle, 'Green zone: normal',
              'Most healthy children are here. The dashed green line is the middle (median).',
              color: Color(0xFF15803D)),
          const _GuideStep(Icons.circle, 'Yellow zone: moderate (below −2)',
              'The child is underweight. Talk to the community health worker or nurse.',
              color: Color(0xFFD97706)),
          const _GuideStep(Icons.circle, 'Red zone: severe (below −3)',
              'Danger. Take the child to the health centre now.', color: colorDanger),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(14)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('The direction of the line matters most',
                    style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w800, color: colorInk)),
                const SizedBox(height: 10),
                const _Direction(Icons.trending_up, colorSuccess, 'Going up, alongside the zones',
                    'Good. The child is growing well.'),
                const _Direction(Icons.trending_flat, colorWarn, 'Flat',
                    'The child is not gaining weight. This is often the first sign of a problem.'),
                const _Direction(Icons.trending_down, colorDanger, 'Going down',
                    'Dangerous. See a health worker as soon as possible.'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('Good to know', style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w800, color: colorInk)),
          const SizedBox(height: 6),
          for (final t in const [
            'One check-up alone says little. The line over several months tells the story, so weigh the child every month.',
            'A wrong weight or a wrong date of birth moves the dot. If a dot looks odd, ask for the child to be weighed again.',
            'A child who has just been sick may lose a little weight. Watch the next check-ups.',
            'The chart shows growth, not the reason for a problem. The health worker looks for the cause.',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(padding: EdgeInsets.only(top: 6), child: Icon(Icons.circle, size: 6, color: colorMuted)),
                  const SizedBox(width: 10),
                  Expanded(child: Text(t, style: GoogleFonts.inter(fontSize: 13, height: 1.45, color: colorInk))),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text('For health workers: −2 and −3 are z-scores (standard deviations) from the WHO median. '
              'Weight-for-age reacts fastest, so it shows a problem earliest.',
              style: GoogleFonts.inter(fontSize: 12, height: 1.45, color: colorMuted)),
        ],
      ),
    ),
  );
}

class _GuideStep extends StatelessWidget {
  final IconData icon;
  final String title;
  final String text;
  final Color color;
  const _GuideStep(this.icon, this.title, this.text, {this.color = colorInk});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                  const SizedBox(height: 2),
                  Text(text, style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: colorMuted)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _Direction extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String text;
  const _Direction(this.icon, this.color, this.title, this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '$title. ', style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                  TextSpan(text: text),
                ]),
                style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: colorInk),
              ),
            ),
          ],
        ),
      );
}
