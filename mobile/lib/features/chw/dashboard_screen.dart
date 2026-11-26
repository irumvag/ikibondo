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
import '../../shared/widgets/sign_out_button.dart';
import '../../shared/widgets/switch_role_button.dart';
import '../../shared/widgets/announcement_banner.dart';
import 'visit_requests_screen.dart';
import '../../core/content/app_content.dart';
import '../../shared/widgets/ui.dart';

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
    final user = ref.watch(currentUserProvider);
    final families = ref.watch(chwFamiliesProvider);
    final pending = ref.watch(pendingCountProvider);
    final requests = ref.watch(chwVisitRequestsProvider).value ?? const [];
    final newRequests = requests.where((r) => r['status'] == 'PENDING').toList();
    final openRequests = requests.where((r) => r['status'] == 'PENDING' || r['status'] == 'ACCEPTED').length;
    final children = families.value ?? const <Child>[];
    final highRisk = children.where((c) => c.riskLevel == 'HIGH').length;

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Ikibondo'),
        actions: [
          if (pending > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: ActionChip(
                onPressed: () => context.go('/chw/sync'),
                backgroundColor: colorWarn,
                side: BorderSide.none,
                label: Text('$pending unsynced',
                    style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white)),
              ),
            ),
          const SwitchRoleButton(),
          const SignOutButton(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(chwVisitRequestsProvider);
          ref.invalidate(announcementsProvider);
          return ref.refresh(chwFamiliesProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            HeroHeader(
              icon: Icons.volunteer_activism_outlined,
              title: 'Hello, ${user?.fullName.split(' ').first ?? ''}',
              subtitle: '${children.length} children in your caseload'
                  '${user?.campName != null ? ' · ${user!.campName}' : ''}',
            ),
            const SizedBox(height: 14),
            const AnnouncementBanner(),

            if (newRequests.isNotEmpty) ...[
              SoftCard(
                accent: colorDanger,
                onTap: () => context.go('/chw/requests'),
                child: Row(
                  children: [
                    const Icon(Icons.home_work_outlined, color: colorDanger),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        '${newRequests.length} new visit request${newRequests.length == 1 ? '' : 's'} from parents',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk),
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: colorMuted),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            Row(
              children: [
                StatTile(icon: Icons.child_care, value: '${children.length}', label: 'Children'),
                const SizedBox(width: 10),
                StatTile(icon: Icons.warning_amber_rounded, value: '$highRisk', label: 'High risk',
                    color: colorDanger),
                const SizedBox(width: 10),
                StatTile(icon: Icons.sync, value: '$pending', label: 'Unsynced', color: colorWarn,
                    onTap: () => context.go('/chw/sync')),
              ],
            ),
            const SizedBox(height: 14),

            // Scan — the most used action in the field
            Material(
              borderRadius: BorderRadius.circular(18),
              color: colorInk,
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: () => context.go('/chw/scan'),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.qr_code_scanner, color: Colors.white),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Scan a child\'s card',
                                style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                            Text('Or type the registration number',
                                style: GoogleFonts.inter(fontSize: 12, color: Colors.white70)),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Colors.white70),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                ActionTile(icon: Icons.add_chart, label: 'Log visit', onTap: () => context.go('/chw/visit')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.event_note_outlined, label: "Today's plan", onTap: () => context.go('/chw/plan')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.home_work_outlined, label: 'Visit requests', badge: openRequests,
                    onTap: () => context.go('/chw/requests')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.vaccines_outlined, label: 'Vaccines due', onTap: () => context.go('/chw/vaccines')),
              ],
            ),
            const SizedBox(height: 18),

            const SectionTitle('Your caseload'),
            families.when(
              loading: () => Column(
                children: List.generate(
                    3, (_) => const Padding(padding: EdgeInsets.only(bottom: 10), child: SkeletonCard())),
              ),
              error: (e, _) => const EmptyState(
                  icon: Icons.cloud_off_outlined, title: 'Could not load your caseload', text: 'Pull down to try again.'),
              data: (kids) {
                if (kids.isEmpty) {
                  return const EmptyState(icon: Icons.child_care, title: 'No children assigned yet',
                      text: 'Your supervisor assigns families to you.');
                }
                // High risk first
                const rank = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2};
                final sorted = [...kids]..sort((a, b) => (rank[a.riskLevel] ?? 3).compareTo(rank[b.riskLevel] ?? 3));
                return Column(
                  children: [
                    for (final c in sorted)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: SoftCard(
                          accent: c.riskLevel == 'HIGH' ? colorDanger : null,
                          onTap: () => context.go('/chw/children/${c.id}'),
                          child: Row(
                            children: [
                              InitialAvatar(c.fullName),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(c.fullName,
                                        style: GoogleFonts.inter(
                                            fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                                    Text([c.ageDisplay, c.zoneName].whereType<String>().join(' · '),
                                        style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                                  ],
                                ),
                              ),
                              RiskBadge(riskLevel: c.riskLevel, nutritionStatus: c.nutritionStatus),
                              const SizedBox(width: 4),
                              const Icon(Icons.chevron_right, color: colorMuted),
                            ],
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
