import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/sign_out_button.dart';
import '../../shared/widgets/switch_role_button.dart';
import '../../core/api/response.dart';
import '../../shared/widgets/announcement_banner.dart';
import 'sessions_screen.dart';
import 'referrals_screen.dart';
import '../../core/content/app_content.dart';
import '../../shared/widgets/ui.dart';

final nurseCampChildrenProvider = FutureProvider.autoDispose<List<Child>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.children, queryParameters: {'page_size': 200});
  final items = unwrapList(resp.data);
  return items.map((e) => Child.fromJson(e)).toList();
});

final pendingApprovalsCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.pendingApprovals);
  final items = (resp.data['data'] ?? resp.data) as List? ?? [];
  return items.length;
});

class NurseDashboardScreen extends ConsumerWidget {
  const NurseDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final children = ref.watch(nurseCampChildrenProvider);
    final approvals = ref.watch(pendingApprovalsCountProvider).value ?? 0;
    final referrals = ref.watch(openReferralsProvider).value ?? const [];
    final sessions = ref.watch(openSessionsProvider).value ?? const [];
    final kids = children.value ?? const <Child>[];

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Ikibondo'),
        actions: const [SwitchRoleButton(), SignOutButton()],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(nurseCampChildrenProvider);
          ref.invalidate(pendingApprovalsCountProvider);
          ref.invalidate(openReferralsProvider);
          ref.invalidate(openSessionsProvider);
          ref.invalidate(announcementsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            HeroHeader(
              icon: Icons.local_hospital_outlined,
              title: 'Welcome, ${user?.fullName.split(' ').first ?? 'Nurse'}',
              subtitle: [user?.campName, 'Nurse'].whereType<String>().join(' · '),
            ),
            const SizedBox(height: 14),
            const AnnouncementBanner(),

            if (approvals > 0) ...[
              SoftCard(
                accent: colorWarn,
                onTap: () => context.go('/nurse/approvals'),
                child: Row(
                  children: [
                    const Icon(Icons.how_to_reg_outlined, color: colorWarn),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text('$approvals parent account${approvals == 1 ? '' : 's'} waiting for approval',
                          style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                    ),
                    const Icon(Icons.chevron_right, color: colorMuted),
                  ],
                ),
              ),
              const SizedBox(height: 14),
            ],

            Row(
              children: [
                StatTile(icon: Icons.child_care, value: '${kids.length}', label: 'Registered',
                    onTap: () => context.go('/nurse/children')),
                const SizedBox(width: 10),
                StatTile(icon: Icons.call_split, value: '${referrals.length}', label: 'Open referrals',
                    color: colorDanger, onTap: () => context.go('/nurse/referrals')),
                const SizedBox(width: 10),
                StatTile(icon: Icons.vaccines_outlined, value: '${sessions.length}', label: 'Open sessions',
                    color: colorGold, onTap: () => context.go('/nurse/sessions')),
              ],
            ),
            const SizedBox(height: 14),

            Material(
              borderRadius: BorderRadius.circular(18),
              color: colorInk,
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: () => context.go('/nurse/scan'),
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
                            Text('Open the record in one step',
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
                ActionTile(icon: Icons.person_add_alt, label: 'Register newborn', onTap: () => context.go('/nurse/register')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.vaccines_outlined, label: 'Vaccination session', onTap: () => context.go('/nurse/sessions')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.call_split, label: 'Referrals', badge: referrals.length,
                    onTap: () => context.go('/nurse/referrals')),
                const SizedBox(width: 10),
                ActionTile(icon: Icons.how_to_reg_outlined, label: 'Approvals', badge: approvals,
                    onTap: () => context.go('/nurse/approvals')),
              ],
            ),
            const SizedBox(height: 18),

            SoftCard(
              onTap: () => context.go('/nurse/guides'),
              child: Row(
                children: [
                  const Icon(Icons.menu_book_outlined, color: colorInk),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Health guides', style: GoogleFonts.inter(fontSize: 14.5, fontWeight: FontWeight.w700, color: colorInk)),
                        Text('Feeding by age, baby care, vaccines and MUAC: to explain to families',
                            style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: colorMuted),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SectionTitle('Recently registered', action: 'All children', onAction: () => context.go('/nurse/children')),
            children.when(
              loading: () => Column(
                children: List.generate(
                    3, (_) => const Padding(padding: EdgeInsets.only(bottom: 10), child: SkeletonCard())),
              ),
              error: (_, __) => const EmptyState(
                  icon: Icons.cloud_off_outlined, title: 'Could not load children', text: 'Pull down to try again.'),
              data: (all) => all.isEmpty
                  ? const EmptyState(icon: Icons.child_care, title: 'No children registered yet')
                  : Column(
                      children: [
                        for (final c in all.take(5))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: SoftCard(
                              onTap: () => context.go('/nurse/children/${c.id}'),
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
                                        Text('${c.registrationNumber} · ${c.ageDisplay ?? ''}',
                                            style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                                      ],
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right, color: colorMuted),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
