import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/db/app_database.dart';
import '../../core/models/vaccination_record.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../core/api/response.dart';

final _vaccineQueueProvider =
    FutureProvider.autoDispose<List<VaccinationRecord>>((ref) async {
  final db = ref.read(dbProvider);
  try {
    final resp = await ApiClient.dio.get(
      Endpoints.vaccinations,
      queryParameters: {'status': 'SCHEDULED', 'ordering': 'scheduled_date'},
    );
    final items = unwrapList(resp.data);
    final records = items.map((e) => VaccinationRecord.fromJson(e)).toList();
    // Refresh the offline cache so the queue survives losing connectivity.
    await db.cacheVaccinationRecords([
      for (final r in records)
        CachedVaccinationRecordsCompanion(
          id: Value(r.id),
          childId: Value(r.childId),
          childName: Value(r.childName),
          vaccineName: Value(r.vaccineName),
          vaccineCode: Value(r.vaccineCode),
          doseNumber: Value(r.doseNumber),
          scheduledDate: Value(r.scheduledDate),
          administeredDate: Value(r.administeredDate),
          status: Value(r.status),
          isOverdue: Value(r.isOverdue),
          batchNumber: Value(r.batchNumber),
        ),
    ]);
    return records;
  } catch (_) {
    // Offline (or server error): serve the cached queue instead of failing.
    final cached = await db.getCachedVaccineQueue();
    return [
      for (final c in cached)
        VaccinationRecord(
          id: c.id,
          childId: c.childId,
          childName: c.childName,
          vaccineName: c.vaccineName,
          vaccineCode: c.vaccineCode,
          doseNumber: c.doseNumber,
          scheduledDate: c.scheduledDate,
          administeredDate: c.administeredDate,
          status: c.status,
          isOverdue: c.isOverdue,
          batchNumber: c.batchNumber,
        ),
    ];
  }
});

class VaccineQueueScreen extends ConsumerWidget {
  const VaccineQueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(_vaccineQueueProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Vaccines due')),
      body: GlassBackground(
          child: queue.when(
        loading: () => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          itemBuilder: (_, __) => const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: SkeletonCard(),
          ),
        ),
        error: (e, _) => Center(
            child: Text('Could not load vaccines due',
                style: GoogleFonts.inter(color: colorMuted))),
        data: (records) {
          if (records.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, size: 56, color: colorSuccess),
                  const SizedBox(height: 12),
                  Text('All vaccines up to date!',
                      style: GoogleFonts.inter(
                          fontSize: 16,
                          color: colorInk,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }

          final overdue = records.where((r) => r.isOverdue).toList();
          final upcoming = records.where((r) => !r.isOverdue).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Rwanda EPI: doses are given and recorded by nurses, not CHWs
              GlassCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.local_hospital_outlined, color: colorInk),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Vaccines are given by the nurse at the health centre. Remind these families '
                        'of the next dose, and refer children with overdue doses.',
                        style: GoogleFonts.inter(
                            fontSize: 13, height: 1.4, color: colorInk),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (overdue.isNotEmpty) ...[
                _SectionHeader(
                    title: '${overdue.length} Overdue', color: colorDanger),
                const SizedBox(height: 8),
                ...overdue.map((r) => _VaccineTile(record: r, ref: ref)),
                const SizedBox(height: 16),
              ],
              if (upcoming.isNotEmpty) ...[
                _SectionHeader(
                    title: 'Upcoming (${upcoming.length})', color: colorInk),
                const SizedBox(height: 8),
                ...upcoming.map((r) => _VaccineTile(record: r, ref: ref)),
              ],
            ],
          );
        },
      )),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  final Color color;
  const _SectionHeader({required this.title, required this.color});

  @override
  Widget build(BuildContext context) => Text(
        title,
        style: GoogleFonts.inter(
            fontSize: 14, fontWeight: FontWeight.w700, color: color),
      );
}

class _VaccineTile extends StatelessWidget {
  final VaccinationRecord record;
  final WidgetRef ref;
  const _VaccineTile({required this.record, required this.ref});

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('d MMM');
    final color = record.isOverdue ? colorDanger : colorInk;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        radius: 16,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(Icons.vaccines_outlined, color: color, size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(record.vaccineName ?? 'Vaccine',
                      style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: colorInk)),
                  Text(record.childName ?? '',
                      style:
                          GoogleFonts.inter(fontSize: 12.5, color: colorMuted)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20)),
              child: Text(
                '${record.isOverdue ? 'Overdue' : 'Due'} ${fmt.format(DateTime.parse(record.scheduledDate))}',
                style: GoogleFonts.inter(
                    fontSize: 11, fontWeight: FontWeight.w700, color: color),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
