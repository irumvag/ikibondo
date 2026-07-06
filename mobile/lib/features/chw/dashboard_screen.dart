import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/risk_badge.dart';

// ── Families provider ──────────────────────────────────────────────────────
final chwFamiliesProvider = FutureProvider.autoDispose<List<Child>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.chwFamilies);
  final items = (resp.data['data'] ?? resp.data) as List? ?? [];
  // families endpoint returns guardians → extract children
  final children = <Child>[];
  for (final fam in items) {
    final kids = fam['children'] as List? ?? [];
    children.addAll(kids.map((c) => Child.fromJson(c as Map<String, dynamic>)));
  }
  return children;
});

class ChwDashboardScreen extends ConsumerWidget {
  const ChwDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user     = ref.watch(currentUserProvider);
    final families = ref.watch(chwFamiliesProvider);
    final pending  = ref.watch(pendingCountProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Ikibondo'),
        actions: [
          if (pending > 0)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: GestureDetector(
                onTap: () => context.go('/chw/sync'),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: colorWarn,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$pending unsynced',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(chwFamiliesProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Greeting
            Text(
              'Hello, ${user?.fullName.split(' ').first ?? 'CHW'}',
              style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk),
            ),
            const SizedBox(height: 4),
            Text(
              'Here\'s your caseload overview',
              style: GoogleFonts.inter(fontSize: 14, color: colorMuted),
            ),
            const SizedBox(height: 20),

            // ── KPI row ───────────────────────────────────────────────────
            families.when(
              data: (children) {
                final highRisk = children.where((c) => c.riskLevel == 'HIGH').length;
                return Row(
                  children: [
                    _KpiCard(label: 'Children', value: '${children.length}', icon: Icons.people, color: colorInk),
                    const SizedBox(width: 12),
                    _KpiCard(label: 'High Risk', value: '$highRisk', icon: Icons.warning_amber, color: colorDanger),
                    const SizedBox(width: 12),
                    _KpiCard(label: 'Unsynced', value: '$pending', icon: Icons.sync, color: pending > 0 ? colorWarn : colorSuccess),
                  ],
                );
              },
              loading: () => const Row(children: [
                Expanded(child: LoadingSkeleton(height: 80)),
                SizedBox(width: 12),
                Expanded(child: LoadingSkeleton(height: 80)),
                SizedBox(width: 12),
                Expanded(child: LoadingSkeleton(height: 80)),
              ]),
              error: (e, _) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 20),

            // ── Scan QR banner ────────────────────────────────────────────
            GestureDetector(
              onTap: () => context.go('/chw/scan'),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: colorInk,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.qr_code_scanner, color: colorGold, size: 28),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Scan child QR card', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorCream)),
                          Text('Instant health record lookup', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF8BBFB0))),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: colorGold),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // ── Quick actions ─────────────────────────────────────────────
            Row(
              children: [
                _ActionBtn(label: 'Log Visit', icon: Icons.add_chart, color: colorSuccess, onTap: () => context.go('/chw/visit')),
                const SizedBox(width: 10),
                _ActionBtn(label: 'Today\'s Plan', icon: Icons.calendar_today, color: colorGold, onTap: () => context.go('/chw/plan')),
                const SizedBox(width: 10),
                _ActionBtn(label: 'Sync', icon: Icons.sync, color: pending > 0 ? colorWarn : colorMuted, onTap: () => context.go('/chw/sync')),
              ],
            ),

            const SizedBox(height: 24),

            // ── Children list ─────────────────────────────────────────────
            Text('Your caseload', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colorInk)),
            const SizedBox(height: 12),

            families.when(
              data: (children) {
                if (children.isEmpty) {
                  return const _EmptyState(message: 'No children assigned yet.');
                }
                return Column(
                  children: children.map((child) => _ChildTile(child: child)).toList(),
                );
              },
              loading: () => Column(
                children: List.generate(4, (_) => const Padding(
                  padding: EdgeInsets.only(bottom: 10),
                  child: SkeletonCard(),
                )),
              ),
              error: (e, _) => Center(
                child: Text('Failed to load families', style: GoogleFonts.inter(color: colorDanger)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _KpiCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colorBgElev,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colorBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk)),
            Text(label, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
          ],
        ),
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({required this.label, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: colorBgElev,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colorBorder),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: colorInk), textAlign: TextAlign.center),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChildTile extends StatelessWidget {
  final Child child;
  const _ChildTile({required this.child});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/chw/children/${child.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colorBgElev,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colorBorder),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: const Offset(0, 2))],
        ),
        child: Row(
          children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(12)),
              child: Center(child: Text(child.fullName[0], style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(child.fullName, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                  Text('${child.ageDisplay ?? ''} · ${child.guardianName ?? ''}',
                      style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                ],
              ),
            ),
            RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(32),
    child: Column(
      children: [
        const Icon(Icons.people_outline, size: 48, color: colorMuted),
        const SizedBox(height: 12),
        Text(message, style: GoogleFonts.inter(fontSize: 14, color: colorMuted), textAlign: TextAlign.center),
      ],
    ),
  );
}
