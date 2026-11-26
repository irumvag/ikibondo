import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/models/child.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import 'child_detail_screen.dart';

const _paper = Color(0xFFFFFDF8);
const _gold = Color(0xFFB8860B);

/// The child's vaccination certificate as a document: framed, with the doses
/// given, a seal and a space for the health centre's stamp. It becomes official
/// once the health centre stamps it (see the help card below it).
class VaccinationCertificateScreen extends ConsumerWidget {
  final String childId;
  const VaccinationCertificateScreen({super.key, required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(parentChildProvider(childId));
    final vaccines = ref.watch(childVaccinesProvider(childId));

    return Scaffold(
      backgroundColor: const Color(0xFFE9EEF5),
      appBar: AppBar(title: const Text('Vaccination certificate')),
      body: switch ((child, vaccines)) {
        (AsyncData(value: final c), AsyncData(value: final items)) => ListView(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 32),
            children: [
              _Certificate(child: c, doses: items),
              const SizedBox(height: 18),
              const CertificateHelpCard(),
            ],
          ),
        (AsyncError(), _) || (_, AsyncError()) => Center(
            child: Text('Could not load the certificate. Check your connection.',
                style: GoogleFonts.inter(color: colorMuted)),
          ),
        _ => const AppLoader(message: 'Preparing certificate'),
      },
    );
  }
}

class _Certificate extends StatelessWidget {
  final Child child;
  final List<Map<String, dynamic>> doses;
  const _Certificate({required this.child, required this.doses});

  @override
  Widget build(BuildContext context) {
    final given = doses.where((v) => v['status'] == 'DONE').toList()
      ..sort((a, b) => '${a['administered_date']}'.compareTo('${b['administered_date']}'));
    final due = doses.where((v) => v['status'] != 'DONE').toList();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final serif = GoogleFonts.merriweather;

    return Container(
      decoration: BoxDecoration(
        color: _paper,
        borderRadius: BorderRadius.circular(6),
        boxShadow: const [BoxShadow(color: Color(0x330E4C92), blurRadius: 24, offset: Offset(0, 10))],
      ),
      padding: const EdgeInsets.all(8),
      child: Container(
        // Double frame: blue outer rule, gold inner rule
        decoration: BoxDecoration(border: Border.all(color: colorInk, width: 3)),
        padding: const EdgeInsets.all(4),
        child: Container(
          decoration: BoxDecoration(border: Border.all(color: _gold, width: 1)),
          child: Stack(
            children: [
              // Faint logo watermark
              Positioned.fill(
                child: Center(
                  child: Opacity(opacity: 0.05, child: IkibondoLogo(size: 220, showName: false)),
                ),
              ),
              const _Corner(Alignment.topLeft),
              const _Corner(Alignment.topRight),
              const _Corner(Alignment.bottomLeft),
              const _Corner(Alignment.bottomRight),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
                child: Column(
                  children: [
                    const IkibondoLogo(size: 30),
                    const SizedBox(height: 14),
                    Text('CERTIFICATE',
                        style: serif(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 4, color: colorInk)),
                    Text('OF VACCINATION',
                        style: serif(fontSize: 13, fontWeight: FontWeight.w700, letterSpacing: 3, color: _gold)),
                    const SizedBox(height: 6),
                    SizedBox(width: 120, child: Divider(color: _gold.withValues(alpha: 0.6), thickness: 1)),
                    const SizedBox(height: 10),
                    Text('This is to certify that',
                        style: serif(fontSize: 13, fontStyle: FontStyle.italic, color: colorMuted)),
                    const SizedBox(height: 6),
                    Text(child.fullName,
                        textAlign: TextAlign.center,
                        style: serif(fontSize: 24, fontWeight: FontWeight.w700, color: colorInk)),
                    const SizedBox(height: 6),
                    Text(
                      '${child.sex == 'F' ? 'daughter' : 'son'} registered as ${child.registrationNumber}, '
                      'born on ${child.dateOfBirth}${child.campName != null ? ', ${child.campName}' : ''}, '
                      'has received the vaccinations listed below.',
                      textAlign: TextAlign.center,
                      style: serif(fontSize: 12.5, height: 1.6, color: const Color(0xFF334155)),
                    ),
                    const SizedBox(height: 18),
                    _DoseTable(given: given),
                    if (due.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Still to be given: ${due.map((v) => v['vaccine_name']).join(', ')}.',
                          style: GoogleFonts.inter(fontSize: 11.5, height: 1.45, color: colorMuted),
                        ),
                      ),
                    ],
                    const SizedBox(height: 22),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const _Seal(),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                height: 54,
                                decoration: BoxDecoration(
                                  border: Border.all(color: colorMuted.withValues(alpha: 0.5), style: BorderStyle.solid),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                alignment: Alignment.center,
                                child: Text('Health centre stamp',
                                    style: GoogleFonts.inter(fontSize: 10.5, color: colorMuted.withValues(alpha: 0.7))),
                              ),
                              const SizedBox(height: 10),
                              const Divider(color: Color(0xFF94A3B8), height: 1),
                              const SizedBox(height: 3),
                              Text('Nurse signature',
                                  style: GoogleFonts.inter(fontSize: 10.5, color: colorMuted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Issued from Ikibondo on $today · ${given.length} dose${given.length == 1 ? '' : 's'} recorded',
                      style: GoogleFonts.inter(fontSize: 10.5, color: colorMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DoseTable extends StatelessWidget {
  final List<Map<String, dynamic>> given;
  const _DoseTable({required this.given});

  @override
  Widget build(BuildContext context) {
    final head = GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: 0.5);
    final cell = GoogleFonts.inter(fontSize: 12, color: colorInk);
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: colorInk.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(6),
      ),
      clipBehavior: Clip.antiAlias,
      child: Table(
        columnWidths: const {0: FlexColumnWidth(2.2), 1: FlexColumnWidth(0.9), 2: FlexColumnWidth(1.6)},
        children: [
          TableRow(
            decoration: const BoxDecoration(color: colorInk),
            children: [
              for (final h in ['VACCINE', 'DOSE', 'DATE GIVEN'])
                Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), child: Text(h, style: head)),
            ],
          ),
          if (given.isEmpty)
            TableRow(children: [
              Padding(
                padding: const EdgeInsets.all(10),
                child: Text('No doses recorded yet', style: cell.copyWith(color: colorMuted)),
              ),
              const SizedBox.shrink(),
              const SizedBox.shrink(),
            ])
          else
            for (var i = 0; i < given.length; i++)
              TableRow(
                decoration: BoxDecoration(color: i.isOdd ? const Color(0xFFF1F5FB) : Colors.transparent),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Text('${given[i]['vaccine_name']}', style: cell.copyWith(fontWeight: FontWeight.w600)),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Text('${given[i]['dose_number'] ?? 1}', style: cell),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Text('${given[i]['administered_date'] ?? ''}', style: cell),
                  ),
                ],
              ),
        ],
      ),
    );
  }
}

/// Round seal: gold ring with the mark in the middle.
class _Seal extends StatelessWidget {
  const _Seal();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 86,
      height: 86,
      child: CustomPaint(
        painter: _SealPainter(),
        child: const Center(child: IkibondoLogo(size: 30, showName: false)),
      ),
    );
  }
}

class _SealPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2;
    // Scalloped outer edge
    final edge = Path();
    const teeth = 24;
    for (var i = 0; i <= teeth * 2; i++) {
      final a = i * math.pi / teeth;
      final rr = i.isEven ? r : r * 0.92;
      final p = c + Offset(math.cos(a) * rr, math.sin(a) * rr);
      i == 0 ? edge.moveTo(p.dx, p.dy) : edge.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(edge, Paint()..color = _gold.withValues(alpha: 0.18));
    canvas.drawCircle(c, r * 0.8, Paint()
      ..color = _gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2);
    canvas.drawCircle(c, r * 0.68, Paint()
      ..color = _gold.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Small decorative corner mark inside the frame.
class _Corner extends StatelessWidget {
  final Alignment at;
  const _Corner(this.at);

  @override
  Widget build(BuildContext context) => Align(
        alignment: at,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Transform.rotate(
            angle: at == Alignment.topLeft
                ? 0
                : at == Alignment.topRight
                    ? math.pi / 2
                    : at == Alignment.bottomRight
                        ? math.pi
                        : -math.pi / 2,
            child: CustomPaint(size: const Size(18, 18), painter: _CornerPainter()),
          ),
        ),
      );
}

class _CornerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = _gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
    canvas.drawPath(
      Path()
        ..moveTo(0, size.height)
        ..lineTo(0, 0)
        ..lineTo(size.width, 0),
      p,
    );
    canvas.drawCircle(const Offset(4, 4), 1.8, Paint()..color = _gold);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
