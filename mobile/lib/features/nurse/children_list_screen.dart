import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/models/child.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/risk_badge.dart';
import 'dashboard_screen.dart';

class ChildrenListScreen extends ConsumerStatefulWidget {
  const ChildrenListScreen({super.key});

  @override
  ConsumerState<ChildrenListScreen> createState() => _ChildrenListScreenState();
}

class _ChildrenListScreenState extends ConsumerState<ChildrenListScreen> {
  String _search = '';
  String? _riskFilter;

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(nurseCampChildrenProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Children Registry')),
      body: Column(
        children: [
          // Search + filter bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (v) => setState(() => _search = v.toLowerCase()),
                    decoration: InputDecoration(
                      hintText: 'Search by name or reg number…',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String?>(
                  icon: Icon(Icons.filter_list, color: _riskFilter != null ? colorInk : colorMuted),
                  onSelected: (v) => setState(() => _riskFilter = v),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: null, child: Text('All risk levels')),
                    const PopupMenuItem(value: 'HIGH',   child: Text('High risk')),
                    const PopupMenuItem(value: 'MEDIUM', child: Text('Medium risk')),
                    const PopupMenuItem(value: 'LOW',    child: Text('Low risk')),
                  ],
                ),
              ],
            ),
          ),

          Expanded(
            child: childrenAsync.when(
              loading: () => ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: 8,
                itemBuilder: (_, __) => const Padding(padding: EdgeInsets.only(bottom: 8), child: SkeletonCard()),
              ),
              error: (e, _) => Center(child: Text('Failed to load', style: GoogleFonts.inter(color: colorDanger))),
              data: (children) {
                var filtered = children.where((c) {
                  final matchSearch = _search.isEmpty ||
                      c.fullName.toLowerCase().contains(_search) ||
                      c.registrationNumber.toLowerCase().contains(_search);
                  final matchRisk = _riskFilter == null || c.riskLevel == _riskFilter;
                  return matchSearch && matchRisk;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(child: Text('No children found', style: GoogleFonts.inter(color: colorMuted)));
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => _ChildRow(child: filtered[i]),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ChildRow extends StatelessWidget {
  final Child child;
  const _ChildRow({required this.child});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/nurse/children/${child.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: colorBgElev,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: riskBgColor(child.riskLevel), borderRadius: BorderRadius.circular(10)),
              child: Center(child: Text(child.fullName[0],
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: riskColor(child.riskLevel)))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(child.fullName, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
                  Text('${child.registrationNumber} · ${child.ageDisplay ?? ''}',
                      style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
                ],
              ),
            ),
            RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus, compact: true),
          ],
        ),
      ),
    );
  }
}
