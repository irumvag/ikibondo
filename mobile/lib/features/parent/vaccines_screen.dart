import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/models/child.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import 'child_detail_screen.dart';
import 'dashboard_screen.dart';

const _filters = {
  'All': null,
  'Upcoming': 'SCHEDULED',
  'Given': 'DONE',
  'Missed': 'MISSED',
};

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
      appBar: AppBar(title: const Text('Vaccinations')),
      body: GlassBackground(
        child: Column(
          children: [
            SizedBox(
              height: 56,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                scrollDirection: Axis.horizontal,
                children: [
                  for (final f in _filters.keys)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(f),
                        selected: _filter == f,
                        showCheckmark: false,
                        onSelected: (_) => setState(() => _filter = f),
                        selectedColor: colorInk,
                        backgroundColor: Colors.white.withValues(alpha: 0.7),
                        side: BorderSide(color: _filter == f ? colorInk : Colors.white),
                        shape: const StadiumBorder(),
                        labelStyle: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _filter == f ? Colors.white : colorInk,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: childrenAsync.when(
                loading: () => const AppLoader(),
                error: (_, __) => Center(
                  child: Text('Could not load. Pull down to try again.', style: GoogleFonts.inter(color: colorMuted)),
                ),
                data: (children) => RefreshIndicator(
                  onRefresh: () async {
                    for (final c in children) {
                      ref.invalidate(childVaccinesProvider(c.id));
                    }
                  },
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                    children: [
                      if (children.isEmpty)
                        GlassCard(
                          child: Text('No children are linked to your account yet.',
                              textAlign: TextAlign.center, style: GoogleFonts.inter(color: colorMuted)),
                        ),
                      for (final c in children) _ChildSection(child: c, status: _filters[_filter]),
                      const CertificateHelpCard(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChildSection extends ConsumerWidget {
  final Child child;
  final String? status;
  const _ChildSection({required this.child, required this.status});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(childVaccinesProvider(child.id));
    final all = async.value ?? const <Map<String, dynamic>>[];
    final shown = status == null ? all : all.where((v) => v['status'] == status).toList();
    final given = all.where((v) => v['status'] == 'DONE').length;

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(child.fullName,
                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                ),
                if (all.isNotEmpty)
                  Text('$given/${all.length} given',
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: colorMuted)),
                TextButton.icon(
                  icon: const Icon(Icons.workspace_premium_outlined, size: 18),
                  label: const Text('Certificate'),
                  onPressed: () => context.push('/parent/children/${child.id}/certificate'),
                ),
              ],
            ),
          ),
          if (async.isLoading && all.isEmpty)
            const Padding(padding: EdgeInsets.all(16), child: AppLoader())
          else if (async.hasError)
            GlassCard(child: Text('Could not load vaccinations.', style: GoogleFonts.inter(color: colorMuted)))
          else if (shown.isEmpty)
            GlassCard(child: Text('Nothing here.', style: GoogleFonts.inter(color: colorMuted)))
          else
            for (final v in shown) Padding(padding: const EdgeInsets.only(bottom: 10), child: VaccineGlassRow(v)),
        ],
      ),
    );
  }
}
