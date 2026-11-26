import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/content/app_content.dart';
import '../../core/theme/app_theme.dart';
import 'brand.dart';
import 'growth_chart.dart' show showGrowthChartGuide;
import 'ui.dart';

// ── Vaccines ────────────────────────────────────────────────────────────────

/// The Rwanda EPI schedule with an explanation of each vaccine (server: vaccine_info.py).
final vaccineGuideProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.vaccineGuide);
  return unwrapList(resp.data);
});

/// Full name for a dose, falling back to the short code.
String vaccineTitle(Map<String, dynamic> v) {
  final info = v['vaccine_info'];
  final full = info is Map ? info['full_name'] as String? : null;
  return full ?? '${v['vaccine_name'] ?? ''}';
}

String? vaccineProtects(Map<String, dynamic> v) {
  final info = v['vaccine_info'];
  return info is Map ? info['protects_against'] as String? : null;
}

/// Explains one dose. When [familyName]/[familyPhone] are given (CHW), adds a call button.
void showVaccineInfoSheet(BuildContext context, Map<String, dynamic> v,
    {String? familyName, String? familyPhone, VoidCallback? onOpenChild}) {
  final info = (v['vaccine_info'] is Map ? v['vaccine_info'] as Map : const {});
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: colorBgElev,
    builder: (ctx) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${info['full_name'] ?? v['vaccine_name']}',
                style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: colorInk)),
            const SizedBox(height: 4),
            Text('${v['vaccine_name']} · dose ${v['dose_number'] ?? 1}'
                '${v['scheduled_date'] != null ? ' · due ${v['scheduled_date']}' : ''}',
                style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            const SizedBox(height: 18),
            if (info['protects_against'] != null)
              _InfoLine(Icons.shield_outlined, 'Protects against', '${info['protects_against']}'),
            if (info['how_given'] != null) _InfoLine(Icons.medical_services_outlined, 'How it is given', '${info['how_given']}'),
            if (info['after'] != null) _InfoLine(Icons.favorite_border, 'After the vaccine', '${info['after']}'),
            if (familyName != null) ...[
              const Divider(height: 24),
              Row(
                children: [
                  InitialAvatar(familyName),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${v['child_name'] ?? ''}',
                            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                        Text('Guardian: $familyName${familyPhone != null ? ' · $familyPhone' : ''}',
                            style: GoogleFonts.inter(fontSize: 12.5, color: colorMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  if (familyPhone != null) ...[
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.phone),
                        label: const Text('Call family'),
                        onPressed: () => launchUrl(Uri.parse('tel:$familyPhone')),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.sms_outlined),
                        label: const Text('SMS'),
                        onPressed: () => launchUrl(Uri.parse(
                            'sms:$familyPhone?body=${Uri.encodeComponent('Muraho. ${v['child_name']} agomba guhabwa urukingo ${v['vaccine_name']} (${v['scheduled_date']}). Muze ku kigo nderabuzima. / ${v['child_name']} is due for ${v['vaccine_name']} (${v['scheduled_date']}). Please come to the health centre.')}')),
                      ),
                    ),
                  ],
                ],
              ),
              if (onOpenChild != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: TextButton.icon(
                    icon: const Icon(Icons.folder_open_outlined),
                    label: const Text('Open the child\'s record'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      onOpenChild();
                    },
                  ),
                ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _InfoLine extends StatelessWidget {
  final IconData icon;
  final String title;
  final String text;
  const _InfoLine(this.icon, this.title, this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: colorInk),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: colorInk)),
                  const SizedBox(height: 2),
                  Text(text, style: GoogleFonts.inter(fontSize: 13.5, height: 1.45, color: colorInk)),
                ],
              ),
            ),
          ],
        ),
      );
}

// ── MUAC ────────────────────────────────────────────────────────────────────

// WHO cut-offs for children 6–59 months (same as the website's MUAC explainer)
const double muacSevereBelow = 11.5;
const double muacModerateBelow = 12.5;
const _red = Color(0xFFDC2626), _yellow = Color(0xFFEAB308), _green = Color(0xFF16A34A);

({String band, String title, String meaning, Color color}) muacBand(double cm) {
  if (cm < muacSevereBelow) {
    return (
      band: 'Red',
      title: 'Severe acute malnutrition',
      meaning: 'Danger. The child needs treatment today: the health worker refers the child to the health centre.',
      color: _red,
    );
  }
  if (cm < muacModerateBelow) {
    return (
      band: 'Yellow',
      title: 'Moderate acute malnutrition',
      meaning: 'The child is too thin. Extra feeding is given and the arm is measured again at the next visit.',
      color: _yellow,
    );
  }
  return (
    band: 'Green',
    title: 'Good',
    meaning: 'No acute malnutrition. Keep feeding well and come for the monthly check-up.',
    color: _green,
  );
}

/// The MUAC tape (mid-upper-arm circumference) with the three colour bands and,
/// when [cm] is given, the child's measurement marked on it.
class MuacExplainer extends StatelessWidget {
  final double? cm;
  final bool showIntro;
  const MuacExplainer({super.key, this.cm, this.showIntro = true});

  @override
  Widget build(BuildContext context) {
    const minCm = 9.0, maxCm = 16.0;
    double pos(double v) => ((v - minCm) / (maxCm - minCm)).clamp(0.0, 1.0);
    final b = cm == null ? null : muacBand(cm!);

    return SoftCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.straighten, color: colorInk),
              const SizedBox(width: 8),
              Expanded(
                child: Text(cm == null ? 'The MUAC arm tape' : 'Arm measurement (MUAC): ${cm!.toStringAsFixed(1)} cm',
                    style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
              ),
            ],
          ),
          if (showIntro) ...[
            const SizedBox(height: 6),
            Text('The health worker wraps a coloured tape around the middle of the left upper arm. '
                'The colour where the tape meets shows if the child is too thin (for ages 6 months to 5 years).',
                style: GoogleFonts.inter(fontSize: 12.5, height: 1.45, color: colorMuted)),
          ],
          const SizedBox(height: 14),
          LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth;
            return SizedBox(
              height: cm == null ? 34 : 58,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 30,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Row(
                        children: [
                          Expanded(flex: ((muacSevereBelow - minCm) * 10).round(), child: Container(color: _red)),
                          Expanded(flex: ((muacModerateBelow - muacSevereBelow) * 10).round(), child: Container(color: _yellow)),
                          Expanded(flex: ((maxCm - muacModerateBelow) * 10).round(), child: Container(color: _green)),
                        ],
                      ),
                    ),
                  ),
                  // Tick labels
                  for (final t in const [muacSevereBelow, muacModerateBelow])
                    Positioned(
                      left: w * pos(t) - 16,
                      bottom: 7,
                      child: SizedBox(
                        width: 32,
                        child: Text(t.toString(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white)),
                      ),
                    ),
                  if (cm != null)
                    Positioned(
                      left: (w * pos(cm!) - 30).clamp(0.0, w - 60),
                      top: 0,
                      child: Column(
                        children: [
                          Container(
                            width: 60,
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            decoration: BoxDecoration(color: colorInk, borderRadius: BorderRadius.circular(6)),
                            child: Text('${cm!.toStringAsFixed(1)} cm',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w800, color: Colors.white)),
                          ),
                          Container(width: 3, height: 36, color: colorInk),
                        ],
                      ),
                    ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          if (b != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: b.color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(12)),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '${b.band}: ${b.title}. ', style: TextStyle(fontWeight: FontWeight.w800, color: b.color)),
                  TextSpan(text: b.meaning),
                ]),
                style: GoogleFonts.inter(fontSize: 13, height: 1.45, color: colorInk),
              ),
            )
          else
            for (final v in const [10.5, 12.0, 13.5]) ...[
              Builder(builder: (_) {
                final x = muacBand(v);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                          margin: const EdgeInsets.only(top: 3),
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(color: x.color, borderRadius: BorderRadius.circular(4))),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text.rich(
                          TextSpan(children: [
                            TextSpan(
                                text: '${x.band} '
                                    '(${v < muacSevereBelow ? 'below 11.5 cm' : v < muacModerateBelow ? '11.5 to 12.4 cm' : '12.5 cm or more'}): ',
                                style: const TextStyle(fontWeight: FontWeight.w700)),
                            TextSpan(text: x.meaning),
                          ]),
                          style: GoogleFonts.inter(fontSize: 12.5, height: 1.4, color: colorInk),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          if (b != null || !showIntro) const SizedBox.shrink(),
          Text('Swelling of both feet (oedema) is always a danger sign, whatever the colour.',
              style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted, fontStyle: FontStyle.italic)),
        ],
      ),
    );
  }
}

// ── Guides screen ───────────────────────────────────────────────────────────

/// Feeding by age, baby care, vaccines explained and the MUAC tape, for parents
/// and for CHWs to teach from. Feeding and care text is edited in Admin → Site content.
class GuidesScreen extends ConsumerWidget {
  final int initialTab;
  const GuidesScreen({super.key, this.initialTab = 0});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 4,
      initialIndex: initialTab,
      child: Scaffold(
        backgroundColor: colorCream,
        appBar: AppBar(
          title: const Text('Health guides'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white70,
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            labelStyle: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
            tabs: const [
              Tab(text: 'Feeding'),
              Tab(text: 'Baby care'),
              Tab(text: 'Vaccines'),
              Tab(text: 'Growth & MUAC'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _ContentGuide(contentKey: 'app.feeding', icon: Icons.restaurant_outlined),
            _ContentGuide(contentKey: 'app.baby_care', icon: Icons.child_friendly_outlined, firstIsWarning: true),
            const _VaccineGuide(),
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const MuacExplainer(),
                const SizedBox(height: 14),
                SoftCard(
                  onTap: () => showGrowthChartGuide(context),
                  child: Row(
                    children: [
                      const Icon(Icons.show_chart, color: colorInk),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('How to read the growth chart',
                                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                            Text('Zones, and why the direction of the line matters',
                                style: GoogleFonts.inter(fontSize: 12.5, color: colorMuted)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: colorMuted),
                    ],
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

class _ContentGuide extends ConsumerWidget {
  final String contentKey;
  final IconData icon;
  final bool firstIsWarning;
  const _ContentGuide({required this.contentKey, required this.icon, this.firstIsWarning = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(appContentProvider(contentKey));
    final steps = ((c['steps'] as List?) ?? const []).whereType<Map>().toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        HeroHeader(icon: icon, title: '${c['title']}', subtitle: '${c['body']}'),
        const SizedBox(height: 14),
        for (var i = 0; i < steps.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              accent: firstIsWarning && i == 0 ? colorDanger : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (firstIsWarning && i == 0)
                        const Padding(
                          padding: EdgeInsets.only(right: 8),
                          child: Icon(Icons.emergency_outlined, color: colorDanger, size: 20),
                        ),
                      Expanded(
                        child: Text('${steps[i]['title']}',
                            style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: firstIsWarning && i == 0 ? colorDanger : colorInk)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  // A line starting "Example day:" is the menu: shown as its own box
                  for (final para in '${steps[i]['description']}'.split('\n'))
                    para.startsWith('Example day:')
                        ? Container(
                            margin: const EdgeInsets.only(top: 8),
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Example day', style: GoogleFonts.inter(
                                    fontSize: 12, fontWeight: FontWeight.w800, color: colorInk)),
                                const SizedBox(height: 4),
                                for (final meal in para.substring('Example day:'.length).split('·'))
                                  if (meal.trim().isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 3),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Padding(
                                            padding: EdgeInsets.only(top: 2),
                                            child: Icon(Icons.restaurant, size: 13, color: colorGold),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(meal.trim(),
                                                style: GoogleFonts.inter(fontSize: 13, height: 1.35, color: colorInk)),
                                          ),
                                        ],
                                      ),
                                    ),
                              ],
                            ),
                          )
                        : Text(para.replaceAll(' · ', '\n• ').replaceFirst(RegExp(r'^'), para.contains(' · ') ? '• ' : ''),
                            style: GoogleFonts.inter(fontSize: 13.5, height: 1.5, color: colorInk)),
                ],
              ),
            ),
          ),
        Text('Based on WHO and UNICEF guidance on feeding and caring for young children. '
            'Your health worker can advise for your own child.',
            style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted)),
      ],
    );
  }
}

class _VaccineGuide extends ConsumerWidget {
  const _VaccineGuide();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(vaccineGuideProvider).when(
          loading: () => const AppLoader(),
          error: (_, __) => const EmptyState(
              icon: Icons.cloud_off_outlined, title: 'Could not load the vaccine guide', text: 'Check your connection.'),
          data: (rows) {
            final byAge = <String, List<Map<String, dynamic>>>{};
            for (final r in rows) {
              byAge.putIfAbsent('${r['age_label']}', () => []).add(r);
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const HeroHeader(
                  icon: Icons.vaccines_outlined,
                  title: 'Vaccines in Rwanda',
                  subtitle: 'Every vaccine is free at the health centre. Tap one to learn more.',
                ),
                const SizedBox(height: 14),
                for (final age in byAge.entries) ...[
                  SectionTitle(age.key),
                  for (final r in age.value)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SoftCard(
                        onTap: () => showVaccineInfoSheet(context, {
                          'vaccine_name': '${r['code']}'.replaceAll('_', '-'),
                          'dose_number': r['dose_number'],
                          'vaccine_info': r,
                        }),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
                              child: const Icon(Icons.vaccines_outlined, size: 20, color: colorInk),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('${r['full_name'] ?? r['code']}',
                                      style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                                  Text('${r['protects_against'] ?? ''}',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(fontSize: 12.5, height: 1.35, color: colorMuted)),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: colorMuted),
                          ],
                        ),
                      ),
                    ),
                ],
              ],
            );
          },
        );
  }
}
