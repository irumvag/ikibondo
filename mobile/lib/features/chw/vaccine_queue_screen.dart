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
import '../../shared/widgets/loading_skeleton.dart';

final _vaccineQueueProvider = FutureProvider.autoDispose<List<VaccinationRecord>>((ref) async {
  final db = ref.read(dbProvider);
  try {
    final resp = await ApiClient.dio.get(
      Endpoints.vaccinations,
      queryParameters: {'status': 'SCHEDULED', 'ordering': 'scheduled_date'},
    );
    final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? resp.data['data'] ?? []) as List;
    final records = items.map((e) => VaccinationRecord.fromJson(e as Map<String, dynamic>)).toList();
    // Refresh the offline cache so the queue survives losing connectivity.
    await db.cacheVaccinationRecords([
      for (final r in records)
        CachedVaccinationRecordsCompanion(
          id:               Value(r.id),
          childId:          Value(r.childId),
          childName:        Value(r.childName),
          vaccineName:      Value(r.vaccineName),
          vaccineCode:      Value(r.vaccineCode),
          doseNumber:       Value(r.doseNumber),
          scheduledDate:    Value(r.scheduledDate),
          administeredDate: Value(r.administeredDate),
          status:           Value(r.status),
          isOverdue:        Value(r.isOverdue),
          batchNumber:      Value(r.batchNumber),
        ),
    ]);
    return records;
  } catch (_) {
    // Offline (or server error): serve the cached queue instead of failing.
    final cached = await db.getCachedVaccineQueue();
    return [
      for (final c in cached)
        VaccinationRecord(
          id:               c.id,
          childId:          c.childId,
          childName:        c.childName,
          vaccineName:      c.vaccineName,
          vaccineCode:      c.vaccineCode,
          doseNumber:       c.doseNumber,
          scheduledDate:    c.scheduledDate,
          administeredDate: c.administeredDate,
          status:           c.status,
          isOverdue:        c.isOverdue,
          batchNumber:      c.batchNumber,
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
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Vaccine Queue')),
      body: queue.when(
        loading: () => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          itemBuilder: (_, __) => const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: SkeletonCard(),
          ),
        ),
        error: (e, _) => Center(child: Text('Error loading vaccines', style: TextStyle(color: colorDanger))),
        data: (records) {
          if (records.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.check_circle, size: 56, color: colorSuccess),
                  const SizedBox(height: 12),
                  Text('All vaccines up to date!', style: GoogleFonts.inter(fontSize: 16, color: colorInk, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }

          final overdue  = records.where((r) => r.isOverdue).toList();
          final upcoming = records.where((r) => !r.isOverdue).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (overdue.isNotEmpty) ...[
                _SectionHeader(title: '${overdue.length} Overdue', color: colorDanger),
                const SizedBox(height: 8),
                ...overdue.map((r) => _VaccineTile(record: r, ref: ref)),
                const SizedBox(height: 16),
              ],
              if (upcoming.isNotEmpty) ...[
                _SectionHeader(title: 'Upcoming (${upcoming.length})', color: colorInk),
                const SizedBox(height: 8),
                ...upcoming.map((r) => _VaccineTile(record: r, ref: ref)),
              ],
            ],
          );
        },
      ),
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
    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: color),
  );
}

class _VaccineTile extends StatelessWidget {
  final VaccinationRecord record;
  final WidgetRef ref;
  const _VaccineTile({required this.record, required this.ref});

  void _administer(BuildContext context) {
    final batchCtrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom, left: 20, right: 20, top: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Administer ${record.vaccineName ?? 'vaccine'}',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
            const SizedBox(height: 6),
            Text(record.childName ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            const SizedBox(height: 16),
            TextField(
              controller: batchCtrl,
              decoration: const InputDecoration(labelText: 'Batch number (optional)'),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _submitAdminister(context, batchCtrl.text);
                },
                child: const Text('Confirm administered'),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Future<void> _submitAdminister(BuildContext context, String batch) async {
    final isOnline = ref.read(isOnlineProvider);
    final payload = {
      'record_id':         record.id,
      'administered_date': DateFormat('yyyy-MM-dd').format(DateTime.now()),
      if (batch.isNotEmpty) 'batch_number': batch,
    };

    if (isOnline) {
      try {
        await ApiClient.dio.post(Endpoints.administerVaccine(record.id), data: {
          'administered_date': payload['administered_date'],
          if (batch.isNotEmpty) 'batch_number': batch,
        });
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Vaccine recorded'), backgroundColor: colorSuccess),
          );
        }
      } catch (_) {
        await ref.read(syncProvider.notifier).enqueue(
          opType: 'administer_vaccine',
          payload: payload,
          childName: record.childName,
        );
      }
    } else {
      await ref.read(syncProvider.notifier).enqueue(
        opType: 'administer_vaccine',
        payload: payload,
        childName: record.childName,
      );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Saved offline'), backgroundColor: colorWarn),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('MMM d, yyyy');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorBgElev,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: record.isOverdue ? colorDanger.withOpacity(0.3) : colorBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: record.isOverdue ? colorHighBg : colorLowBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.vaccines, color: record.isOverdue ? colorDanger : colorSuccess, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.vaccineName ?? 'Vaccine', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                Text(record.childName ?? '', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                Text(
                  '${record.isOverdue ? 'OVERDUE · ' : ''}Due ${fmt.format(DateTime.parse(record.scheduledDate))}',
                  style: GoogleFonts.inter(fontSize: 11, color: record.isOverdue ? colorDanger : colorMuted),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: () => _administer(context),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              side: const BorderSide(color: colorSuccess),
              foregroundColor: colorSuccess,
            ),
            child: Text('Done', style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
