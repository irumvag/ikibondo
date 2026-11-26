import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/content/app_content.dart';
import '../../core/models/child.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/announcement_banner.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/risk_badge.dart';
import '../../shared/widgets/sign_out_button.dart';
import '../../shared/widgets/switch_role_button.dart';
import '../../core/api/response.dart';
import 'child_detail_screen.dart';

final parentChildrenProvider = FutureProvider.autoDispose<List<Child>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.children);
  final items = unwrapList(resp.data);
  return items.map((e) => Child.fromJson(e)).toList();
});

class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final childrenAsync = ref.watch(parentChildrenProvider);
    final intro = ref.watch(appContentProvider('app.parent_home'));
    final children = childrenAsync.value ?? const <Child>[];

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Ikibondo'),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.go('/parent/notifications'),
          ),
          const SwitchRoleButton(),
          const SignOutButton(),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(announcementsProvider);
          return ref.refresh(parentChildrenProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(
              'Hello, ${user?.fullName.split(' ').first ?? ''}',
              style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: colorInk),
            ),
            const SizedBox(height: 14),

            const AnnouncementBanner(),

            // Admin-edited welcome card (Admin → Site content → Mobile app — parent home)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                    colors: [colorInk, colorSky], begin: Alignment.topLeft, end: Alignment.bottomRight),
                boxShadow: softShadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${intro['title']}',
                      style: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 6),
                  Text('${intro['body']}',
                      style: GoogleFonts.inter(
                          fontSize: 13, height: 1.45, color: Colors.white.withValues(alpha: 0.9))),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Quick actions
            Row(
              children: [
                _Action(Icons.home_work_outlined, 'Request\na visit', () => context.go('/parent/request-visit')),
                const SizedBox(width: 10),
                _Action(Icons.vaccines_outlined, 'Vaccines', () => context.go('/parent/vaccines')),
                const SizedBox(width: 10),
                _Action(
                  Icons.workspace_premium_outlined,
                  'Certificate',
                  () => children.length == 1
                      ? context.push('/parent/children/${children.first.id}/certificate')
                      : context.go('/parent/vaccines'),
                ),
              ],
            ),
            const SizedBox(height: 22),

            Text('Your children',
                style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
            const SizedBox(height: 10),

            childrenAsync.when(
              loading: () => Column(
                children: List.generate(
                    2, (_) => const Padding(padding: EdgeInsets.only(bottom: 12), child: SkeletonCard())),
              ),
              error: (e, _) => _Message(
                icon: Icons.cloud_off_outlined,
                text: 'Could not load your children. Pull down to try again.',
              ),
              data: (children) => children.isEmpty
                  ? const _Message(
                      icon: Icons.child_care,
                      text: 'No children are linked to your account yet. The nurse at your health centre links them.',
                    )
                  : Column(children: children.map((c) => _ChildCard(child: c)).toList()),
            ),
            const SizedBox(height: 10),
            const CertificateHelpCard(),
          ],
        ),
      ),
    );
  }
}

class _Action extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _Action(this.icon, this.label, this.onTap);

  @override
  Widget build(BuildContext context) => Expanded(
        child: Material(
          color: colorBgElev,
          borderRadius: BorderRadius.circular(16),
          elevation: 0,
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: onTap,
            child: Container(
              height: 92,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), boxShadow: softShadow),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, color: colorInk, size: 22),
                  ),
                  const SizedBox(height: 6),
                  Text(label,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: colorInk, height: 1.2)),
                ],
              ),
            ),
          ),
        ),
      );
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Message({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(18), boxShadow: softShadow),
        child: Column(
          children: [
            Icon(icon, size: 40, color: colorMuted),
            const SizedBox(height: 10),
            Text(text, textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
          ],
        ),
      );
}

class _ChildCard extends ConsumerWidget {
  final Child child;
  const _ChildCard({required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Status from the latest check-up; the children list itself carries none
    final records = ref.watch(childRecordsProvider(child.id)).value ?? const [];
    final vaccines = ref.watch(childVaccinesProvider(child.id)).value ?? const [];
    final status = records.isNotEmpty ? records.last['nutrition_status'] as String? : null;
    final next = vaccines.where((v) => v['status'] == 'SCHEDULED').firstOrNull;
    final overdue = vaccines.where((v) => v['status'] == 'SCHEDULED' && v['is_overdue'] == true).length;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: colorBgElev,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => context.go('/parent/children/${child.id}'),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), boxShadow: softShadow),
            child: Column(
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: colorBgSand,
                      child: Text(child.fullName.isNotEmpty ? child.fullName[0] : '?',
                          style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w800, color: colorInk)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(child.fullName,
                              style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                          const SizedBox(height: 2),
                          Text(child.ageDisplay ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                        ],
                      ),
                    ),
                    RiskBadge(nutritionStatus: status),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right, color: colorMuted),
                  ],
                ),
                if (next != null || overdue > 0) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: overdue > 0 ? colorHighBg : colorBgSand,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.vaccines_outlined, size: 18, color: overdue > 0 ? colorDanger : colorInk),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            overdue > 0
                                ? '$overdue vaccine dose${overdue == 1 ? '' : 's'} overdue — ask your health worker'
                                : 'Next vaccine: ${next!['vaccine_name']} on ${next['scheduled_date']}',
                            style: GoogleFonts.inter(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: overdue > 0 ? colorDanger : colorInk),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
