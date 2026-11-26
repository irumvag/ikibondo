import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';

/// One measurement as the chart needs it.
typedef GrowthEntry = ({String date, double? weightKg, double? heightCm});

/// Weight or height over time, oldest to newest. Works from the first
/// measurement (a single point) onwards. Used on every child page.
class GrowthChart extends StatefulWidget {
  final List<GrowthEntry> entries;
  const GrowthChart({super.key, required this.entries});

  @override
  State<GrowthChart> createState() => _GrowthChartState();
}

class _GrowthChartState extends State<GrowthChart> {
  bool _weight = true;

  @override
  Widget build(BuildContext context) {
    final points = <FlSpot>[];
    final dates = <String>[];
    for (final e in widget.entries) {
      final v = _weight ? e.weightKg : e.heightCm;
      if (v == null) continue;
      points.add(FlSpot(points.length.toDouble(), v));
      dates.add(e.date);
    }
    final unit = _weight ? 'kg' : 'cm';

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 16, 10),
      decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(18), boxShadow: softShadow),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SizedBox(width: 4),
              Expanded(
                child: Text(_weight ? 'Weight over time' : 'Height over time',
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
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
          const SizedBox(height: 14),
          if (points.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 28),
              child: Center(
                child: Text('No measurements yet.', style: GoogleFonts.inter(color: colorMuted)),
              ),
            )
          else
            SizedBox(
              height: 200,
              child: LineChart(_data(points, dates, unit)),
            ),
          if (points.length == 1)
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Text('One check-up so far: the line appears after the next one.',
                  style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
            ),
        ],
      ),
    );
  }

  LineChartData _data(List<FlSpot> points, List<String> dates, String unit) {
    final ys = points.map((p) => p.y);
    final lo = ys.reduce((a, b) => a < b ? a : b);
    final hi = ys.reduce((a, b) => a > b ? a : b);
    // Pad the range so a single point or a flat line sits mid-chart
    final pad = _weight ? 0.5 : 2.0;
    final minY = (lo - pad).floorToDouble();
    final maxY = (hi + pad).ceilToDouble();
    final step = ((maxY - minY) / 4).clamp(_weight ? 0.5 : 1.0, 100.0).toDouble();

    return LineChartData(
      minX: points.length == 1 ? -0.5 : 0,
      maxX: points.length == 1 ? 0.5 : points.length - 1.0,
      minY: minY,
      maxY: maxY,
      gridData: FlGridData(
        drawVerticalLine: false,
        horizontalInterval: step,
        getDrawingHorizontalLine: (_) => const FlLine(color: colorBorder, strokeWidth: 1),
      ),
      borderData: FlBorderData(show: false),
      lineTouchData: LineTouchData(
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (_) => colorInk,
          getTooltipItems: (spots) => [
            for (final s in spots)
              LineTooltipItem('${s.y} $unit\n${dates[s.x.toInt()]}',
                  GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
          ],
        ),
      ),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        leftTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 44,
            interval: step,
            getTitlesWidget: (v, _) => Text('${_weight ? v.toStringAsFixed(1) : v.toStringAsFixed(0)} $unit',
                style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
          ),
        ),
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            interval: 1,
            reservedSize: 24,
            getTitlesWidget: (v, _) {
              final i = v.toInt();
              if (v != i || i < 0 || i >= dates.length) return const SizedBox.shrink();
              final d = dates[i];
              return Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(d.length >= 10 ? '${d.substring(8, 10)}/${d.substring(5, 7)}' : d,
                    style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
              );
            },
          ),
        ),
      ),
      lineBarsData: [
        LineChartBarData(
          spots: points,
          isCurved: points.length > 2,
          color: colorInk,
          barWidth: 3,
          belowBarData: BarAreaData(show: points.length > 1, color: colorSky.withValues(alpha: 0.12)),
          dotData: FlDotData(
            getDotPainter: (_, __, ___, ____) =>
                FlDotCirclePainter(radius: 4.5, color: Colors.white, strokeWidth: 2.5, strokeColor: colorInk),
          ),
        ),
      ],
    );
  }
}
