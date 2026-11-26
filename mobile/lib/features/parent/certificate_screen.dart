import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import 'child_detail_screen.dart';

/// A vaccination record the parent can show at the health centre. The official,
/// stamped certificate is printed by the nurse (see the help card below).
class VaccinationCertificateScreen extends ConsumerWidget {
  final String childId;
  const VaccinationCertificateScreen({super.key, required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(parentChildProvider(childId));
    final vaccines = ref.watch(childVaccinesProvider(childId));

    return Scaffold(
      appBar: AppBar(title: const Text('Vaccination certificate')),
      body: GlassBackground(
        child: switch ((child, vaccines)) {
          (AsyncData(value: final c), AsyncData(value: final items)) => ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: softShadow,
                    border: Border.all(color: colorInk.withValues(alpha: 0.15), width: 1.5),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const IkibondoLogo(size: 34),
                          const Spacer(),
                          const Icon(Icons.workspace_premium, color: colorGold, size: 30),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text('VACCINATION RECORD',
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.5, color: colorMuted)),
                      const SizedBox(height: 4),
                      Text(c.fullName,
                          style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: colorInk)),
                      const SizedBox(height: 8),
                      _kv('Registration', c.registrationNumber),
                      _kv('Date of birth', c.dateOfBirth),
                      _kv('Sex', c.sex == 'F' ? 'Female' : 'Male'),
                      if (c.campName != null) _kv('Camp', c.campName!),
                      const Divider(height: 28),
                      Text('Doses given',
                          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                      const SizedBox(height: 6),
                      ..._doses(items.where((v) => v['status'] == 'DONE').toList(), given: true),
                      if (items.any((v) => v['status'] != 'DONE')) ...[
                        const SizedBox(height: 14),
                        Text('Not yet given',
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                        const SizedBox(height: 6),
                        ..._doses(items.where((v) => v['status'] != 'DONE').toList(), given: false),
                      ],
                      const Divider(height: 28),
                      Text(
                        'Produced by the Ikibondo app on ${DateTime.now().toIso8601String().substring(0, 10)}. '
                        'This is not a stamped certificate; ask your health centre for the official copy.',
                        style: GoogleFonts.inter(fontSize: 11, color: colorMuted, height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const CertificateHelpCard(),
                const SizedBox(height: 24),
              ],
            ),
          (AsyncError(), _) || (_, AsyncError()) => Center(
              child: Text('Could not load the record. Check your connection.',
                  style: GoogleFonts.inter(color: colorMuted)),
            ),
          _ => const AppLoader(),
        },
      ),
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            SizedBox(width: 110, child: Text(k, style: GoogleFonts.inter(fontSize: 13, color: colorMuted))),
            Expanded(child: Text(v, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk))),
          ],
        ),
      );

  List<Widget> _doses(List<Map<String, dynamic>> rows, {required bool given}) {
    if (rows.isEmpty) {
      return [Text(given ? 'None recorded yet.' : 'None.', style: GoogleFonts.inter(fontSize: 13, color: colorMuted))];
    }
    return [
      for (final v in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            children: [
              Icon(given ? Icons.check_circle : Icons.radio_button_unchecked,
                  size: 18, color: given ? colorSuccess : colorMuted),
              const SizedBox(width: 8),
              Expanded(
                child: Text('${v['vaccine_name']} · dose ${v['dose_number'] ?? 1}',
                    style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
              ),
              Text('${(given ? v['administered_date'] : v['scheduled_date']) ?? ''}',
                  style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
            ],
          ),
        ),
    ];
  }
}
