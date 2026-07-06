import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/risk_badge.dart';

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
  final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
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
    _tabs = TabController(length: 3, vsync: this);
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
                      final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
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
          labelColor: colorCream,
          unselectedLabelColor: const Color(0xFF8BBFB0),
          indicatorColor: colorGold,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Records'),
            Tab(text: 'Notes'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.small(
        onPressed: () => _addNote(context),
        backgroundColor: colorGold,
        foregroundColor: colorInk,
        child: const Icon(Icons.note_add),
      ),
      body: childAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (child) => TabBarView(
          controller: _tabs,
          children: [
            // Overview
            ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(14), border: Border.all(color: colorBorder)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(child.fullName, style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk)),
                          const Spacer(),
                          RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text('${child.ageDisplay ?? ''}  ·  ${child.sex}  ·  ${child.registrationNumber}',
                          style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                      if (child.campName != null)
                        Text(child.campName!, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                      if (child.guardianName != null) ...[
                        const SizedBox(height: 10),
                        Text('Guardian: ${child.guardianName}', style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
                        if (child.guardianPhone != null)
                          Text(child.guardianPhone!, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                      ],
                    ],
                  ),
                ),
              ],
            ),

            // Health records
            const Center(child: Text('Records tab — see nurse children screen for full records list')),

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
