import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/models/health_record.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/growth_chart.dart';
import '../../shared/widgets/risk_badge.dart';
import 'package:url_launcher/url_launcher.dart';
import '../parent/child_detail_screen.dart' show childVaccinesProvider, VaccineGlassRow;
import '../../core/api/api_errors.dart';
import '../../shared/widgets/ui.dart';
import '../../core/api/response.dart';
import '../../shared/widgets/brand.dart';

final _nurseChildProvider = FutureProvider.family.autoDispose<Child, String>((ref, id) async {
  final resp = await ApiClient.dio.get(Endpoints.child(id));
  return Child.fromJson((resp.data['data'] ?? resp.data) as Map<String, dynamic>);
});

final _childNotesProvider = FutureProvider.family.autoDispose<List, String>((ref, childId) async {
  // Notes are on health records — get most recent record's notes
  final resp = await ApiClient.dio.get(
    Endpoints.healthRecords,
    queryParameters: {'child': childId, 'ordering': '-measurement_date', 'page_size': 1},
  );
  final items = unwrapList(resp.data);
  if (items.isEmpty) return [];
  final recordId = items.first['id'] as String;
  final notesResp = await ApiClient.dio.get(Endpoints.healthRecordNotes(recordId));
  return (notesResp.data['data'] ?? notesResp.data) as List? ?? [];
});

class NurseChildDetailScreen extends ConsumerStatefulWidget {
  final String childId;
  const NurseChildDetailScreen({super.key, required this.childId});

  @override
  ConsumerState<NurseChildDetailScreen> createState() => _NurseChildDetailScreenState();
}

class _NurseChildDetailScreenState extends ConsumerState<NurseChildDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _tabs.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  void _addNote(BuildContext context) {
    final ctrl = TextEditingController();
    String noteType = 'GENERAL';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 20, right: 20, top: 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Add clinical note', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: noteType,
                decoration: const InputDecoration(labelText: 'Note type'),
                items: ['GENERAL', 'FOLLOW_UP', 'REFERRAL', 'OBSERVATION'].map((t) =>
                  DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))
                ).toList(),
                onChanged: (v) => setState(() => noteType = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: ctrl,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Note content'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    // Get the latest record id to post note on
                    try {
                      final resp = await ApiClient.dio.get(
                        Endpoints.healthRecords,
                        queryParameters: {'child': widget.childId, 'ordering': '-measurement_date', 'page_size': 1},
                      );
                      final items = unwrapList(resp.data);
                      if (items.isNotEmpty) {
                        final recordId = items.first['id'] as String;
                        await ApiClient.dio.post(Endpoints.healthRecordNotes(recordId), data: {
                          'content':   ctrl.text.trim(),
                          'note_type': noteType,
                        });
                        ref.invalidate(_childNotesProvider(widget.childId));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Note added'), backgroundColor: colorSuccess),
                          );
                        }
                      }
                    } catch (_) {}
                  },
                  child: const Text('Save note'),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final childAsync = ref.watch(_nurseChildProvider(widget.childId));
    final notesAsync = ref.watch(_childNotesProvider(widget.childId));

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
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Records'),
            Tab(text: 'Vaccines'),
            Tab(text: 'Notes'),
          ],
        ),
      ),
      floatingActionButton: _tabs.index != 3 ? null : FloatingActionButton.small(
        onPressed: () => _addNote(context),
        backgroundColor: colorGold,
        foregroundColor: colorInk,
        child: const Icon(Icons.note_add),
      ),
      body: childAsync.when(
        loading: () => const AppLoader(),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (child) => TabBarView(
          controller: _tabs,
          children: [
            _NurseOverview(child: child),

            // Health records
            _RecordsTab(childId: widget.childId),

            _NurseVaccinesTab(childId: widget.childId),

            // Notes
            notesAsync.when(
              loading: () => const Center(child: SkeletonCard()),
              error: (_, __) => const Center(child: Text('Failed to load notes')),
              data: (notes) {
                if (notes.isEmpty) {
                  return Center(child: Text('No notes yet — tap + to add', style: GoogleFonts.inter(color: colorMuted)));
                }
                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: notes.length,
                  itemBuilder: (_, i) {
                    final note = notes[i] as Map<String, dynamic>;
                    final isPinned = note['is_pinned'] as bool? ?? false;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isPinned ? colorMedBg : colorBgElev,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: isPinned ? colorGold.withOpacity(0.5) : colorBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(6)),
                                child: Text(
                                  (note['note_type'] as String? ?? 'GENERAL').replaceAll('_', ' '),
                                  style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: colorInk),
                                ),
                              ),
                              if (isPinned) const Padding(
                                padding: EdgeInsets.only(left: 6),
                                child: Icon(Icons.push_pin, size: 14, color: colorGold),
                              ),
                              const Spacer(),
                              Text(
                                (note['created_at'] as String? ?? '').substring(0, 10),
                                style: GoogleFonts.inter(fontSize: 11, color: colorMuted),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(note['content'] as String? ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

final _recordsProvider = FutureProvider.family.autoDispose<List<HealthRecord>, String>((ref, childId) async {
  final resp = await ApiClient.dio.get(
    Endpoints.healthRecords,
    queryParameters: {'child': childId, 'ordering': '-measurement_date'},
  );
  return unwrapList(resp.data).map(HealthRecord.fromJson).toList();
});

/// Every measurement for the child, newest first, with WHO z-scores.
class _RecordsTab extends ConsumerWidget {
  final String childId;
  const _RecordsTab({required this.childId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(_recordsProvider(childId)).when(
      loading: () => const AppLoader(),
      error: (_, __) => Center(
        child: TextButton(
          onPressed: () => ref.invalidate(_recordsProvider(childId)),
          child: const Text('Could not load records. Tap to retry.'),
        ),
      ),
      data: (records) {
        if (records.isEmpty) {
          return Center(child: Text('No measurements yet', style: GoogleFonts.inter(color: colorMuted)));
        }
        String z(double? v) => v == null ? '—' : v.toStringAsFixed(1);
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(_recordsProvider(childId)),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: records.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              if (i == 0) {
                return GrowthChart(childId: childId, entries: [
                  for (final r in records.reversed)
                    (date: r.measurementDate, weightKg: r.weightKg, heightCm: r.heightCm),
                ]);
              }
              final r = records[i - 1];
              return Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(16), boxShadow: softShadow),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(r.measurementDate,
                              style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                        ),
                        RiskBadge(nutritionStatus: r.nutritionStatus, compact: true),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        if (r.weightKg != null) '${r.weightKg} kg',
                        if (r.heightCm != null) '${r.heightCm} cm',
                        if (r.muacCm != null) 'MUAC ${r.muacCm} cm',
                        if (r.oedema == true) 'oedema',
                      ].join(' · '),
                      style: GoogleFonts.inter(fontSize: 13, color: colorInk),
                    ),
                    const SizedBox(height: 4),
                    Text('WAZ ${z(r.weightForAgeZ)} · HAZ ${z(r.heightForAgeZ)} · WHZ ${z(r.weightForHeightZ)}'
                        '${r.recordedByName != null ? ' · ${r.recordedByName}' : ''}',
                        style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

/// Child summary: header, guardian contact, last check-up, details.
class _NurseOverview extends ConsumerWidget {
  final Child child;
  const _NurseOverview({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(_recordsProvider(child.id)).value ?? const <HealthRecord>[];
    final latest = records.isNotEmpty ? records.first : null; // newest first
    String fmt(double? v, String unit) => v == null ? '—' : '${v % 1 == 0 ? v.toInt() : v} $unit';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
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
                    Text('${child.ageDisplay ?? ''} · ${child.sex == 'F' ? 'Girl' : 'Boy'} · ${child.registrationNumber}',
                        style: GoogleFonts.inter(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.88))),
                  ],
                ),
              ),
              if (latest?.nutritionStatus != null)
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(9)),
                  child: RiskBadge(nutritionStatus: latest!.nutritionStatus, riskLevel: latest.riskLevel),
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (child.guardianName != null)
          SoftCard(
            child: Row(
              children: [
                InitialAvatar(child.guardianName!),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(child.guardianName!,
                          style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w700, color: colorInk)),
                      Text(child.guardianPhone ?? 'Guardian',
                          style: GoogleFonts.inter(fontSize: 12.5, color: colorMuted)),
                    ],
                  ),
                ),
                if (child.guardianPhone != null)
                  IconButton.filledTonal(
                    tooltip: 'Call guardian',
                    icon: const Icon(Icons.phone, color: colorSuccess),
                    onPressed: () => launchUrl(Uri.parse('tel:${child.guardianPhone}')),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 14),
        SectionTitle(latest == null ? 'No check-up yet' : 'Last check-up · ${latest.measurementDate}'),
        if (latest != null)
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    for (final m in [
                      ('Weight', fmt(latest.weightKg, 'kg')),
                      ('Height', fmt(latest.heightCm, 'cm')),
                      ('MUAC', fmt(latest.muacCm, 'cm')),
                    ])
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m.$1, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                            Text(m.$2,
                                style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: colorInk)),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                Text('WAZ ${latest.weightForAgeZ?.toStringAsFixed(1) ?? '—'} · '
                    'HAZ ${latest.heightForAgeZ?.toStringAsFixed(1) ?? '—'} · '
                    'WHZ ${latest.weightForHeightZ?.toStringAsFixed(1) ?? '—'}'
                    '${latest.recordedByName != null ? ' · by ${latest.recordedByName}' : ''}',
                    style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
              ],
            ),
          ),
        const SizedBox(height: 14),
        const SectionTitle('Details'),
        SoftCard(
          child: Column(
            children: [
              for (final d in [
                (Icons.cake_outlined, 'Born', child.dateOfBirth),
                if (child.campName != null) (Icons.location_on_outlined, 'Camp', child.campName!),
                if (child.zoneName != null) (Icons.map_outlined, 'Zone', child.zoneName!),
                if (child.assignedChwName != null) (Icons.person_pin_outlined, 'CHW', child.assignedChwName!),
              ])
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Icon(d.$1, size: 18, color: colorMuted),
                      const SizedBox(width: 10),
                      SizedBox(width: 70, child: Text(d.$2, style: GoogleFonts.inter(fontSize: 13, color: colorMuted))),
                      Expanded(
                        child: Text(d.$3,
                            style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 70), // room for the note button
      ],
    );
  }
}

/// The child's doses; the nurse records a dose given here (nurses only, Rwanda EPI).
class _NurseVaccinesTab extends ConsumerWidget {
  final String childId;
  const _NurseVaccinesTab({required this.childId});

  Future<void> _give(BuildContext context, WidgetRef ref, Map<String, dynamic> v) async {
    final batch = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Record ${v['vaccine_name']} dose ${v['dose_number'] ?? 1}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Given today, ${DateTime.now().toIso8601String().substring(0, 10)}.',
                style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            const SizedBox(height: 10),
            TextField(controller: batch, decoration: const InputDecoration(labelText: 'Batch number (optional)')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Dose given')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ApiClient.dio.post(Endpoints.administerVaccine(v['id'] as String), data: {
        'administered_date': DateTime.now().toIso8601String().substring(0, 10),
        if (batch.text.trim().isNotEmpty) 'batch_number': batch.text.trim(),
      });
      ref.invalidate(childVaccinesProvider(childId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${v['vaccine_name']} recorded'), backgroundColor: colorSuccess));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(serverMessage(e, 'Could not record the dose.')), backgroundColor: colorDanger));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(childVaccinesProvider(childId));
    return GlassBackground(
      child: async.when(
        loading: () => const AppLoader(),
        error: (_, __) => const EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load vaccinations'),
        data: (items) {
          final given = items.where((v) => v['status'] == 'DONE').length;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(childVaccinesProvider(childId)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
              children: [
                GlassCard(
                  child: Row(
                    children: [
                      const Icon(Icons.vaccines_outlined, color: colorInk),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text('$given of ${items.length} doses given',
                            style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                for (final v in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: v['status'] == 'DONE'
                        ? VaccineGlassRow(v)
                        : Stack(
                            children: [
                              VaccineGlassRow(v),
                              Positioned(
                                right: 10,
                                top: 0,
                                bottom: 0,
                                child: Center(
                                  child: FilledButton.tonal(
                                    style: FilledButton.styleFrom(
                                        visualDensity: VisualDensity.compact,
                                        padding: const EdgeInsets.symmetric(horizontal: 12)),
                                    onPressed: () => _give(context, ref, v),
                                    child: const Text('Give'),
                                  ),
                                ),
                              ),
                            ],
                          ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
