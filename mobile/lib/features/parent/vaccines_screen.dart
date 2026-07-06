import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import 'dashboard_screen.dart';

class ParentVaccinesScreen extends ConsumerStatefulWidget {
  const ParentVaccinesScreen({super.key});

  @override
  ConsumerState<ParentVaccinesScreen> createState() => _ParentVaccinesScreenState();
}

class _ParentVaccinesScreenState extends ConsumerState<ParentVaccinesScreen> {
  String _filter = 'All';

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(parentChildrenProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Vaccinations')),
      body: Column(
        children: [
          // Filter chips
          SizedBox(
            height: 48,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              scrollDirection: Axis.horizontal,
              children: ['All', 'Upcoming', 'Done', 'Missed', 'Skipped'].map((f) {
                final active = _filter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f),
                    selected: active,
                    onSelected: (_) => setState(() => _filter = f),
                    selectedColor: colorInk,
                    labelStyle: GoogleFonts.inter(
                      fontSize: 13,
                      color: active ? colorCream : colorInk,
                      fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          Expanded(
            child: childrenAsync.when(
              loading: () => const Center(child: SkeletonCard()),
              error: (_, __) => const Center(child: Text('Failed to load')),
              data: (children) {
                if (children.isEmpty) return Center(child: Text('No children linked', style: GoogleFonts.inter(color: colorMuted)));
                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: children.map((child) => _ChildVaccSection(child: child, filter: _filter)).toList(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ChildVaccSection extends ConsumerWidget {
  final dynamic child;
  final String filter;
  const _ChildVaccSection({required this.child, required this.filter});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vaccAsync = FutureProvider.family.autoDispose<List, String>((ref, id) async {
      final resp = await ApiClient.dio.get(Endpoints.vaccinations, queryParameters: {'child': id});
      return (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
    });

    return ref.watch(vaccAsync(child.id)).when(
      loading: () => const Padding(padding: EdgeInsets.only(bottom: 10), child: SkeletonCard()),
      error: (_, __) => const SizedBox.shrink(),
      data: (records) {
        final filtered = filter == 'All'
            ? records
            : records.where((r) => (r['status'] as String?)?.toUpperCase() == filter.toUpperCase()).toList();
        if (filtered.isEmpty) return const SizedBox.shrink();

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: colorBgElev,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colorBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(14),
                child: Text(child.fullName, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
              ),
              const Divider(height: 1),
              ...filtered.map((v) {
                final status = v['status'] as String? ?? '';
                return ListTile(
                  dense: true,
                  leading: Container(
                    width: 10, height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: status == 'DONE' ? colorSuccess
                           : status == 'MISSED' ? colorDanger
                           : colorWarn,
                    ),
                  ),
                  title: Text(v['vaccine_name'] as String? ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
                  subtitle: Text('Due ${v['scheduled_date'] ?? ''}', style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
                  trailing: Text(status, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w700,
                      color: status == 'DONE' ? colorSuccess : status == 'MISSED' ? colorDanger : colorWarn)),
                );
              }),
            ],
          ),
        );
      },
    );
  }
}
