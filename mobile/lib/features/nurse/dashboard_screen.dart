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

final nurseCampChildrenProvider = FutureProvider.autoDispose<List<Child>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.children, queryParameters: {'page_size': 200});
  final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
  return items.map((e) => Child.fromJson(e as Map<String, dynamic>)).toList();
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
    final user     = ref.watch(currentUserProvider);
    final children = ref.watch(nurseCampChildrenProvider);
    final approvals = ref.watch(pendingApprovalsCountProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Ikibondo — Nurse')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(nurseCampChildrenProvider);
          ref.invalidate(pendingApprovalsCountProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Welcome, ${user?.fullName.split(' ').first ?? 'Nurse'}',
                style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk)),
            const SizedBox(height: 4),
            Text(user?.campName ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            const SizedBox(height: 20),

            // Pending approvals alert
            approvals.maybeWhen(
              data: (count) => count > 0
                ? GestureDetector(
                    onTap: () => context.go('/nurse/approvals'),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colorMedBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: colorWarn.withOpacity(0.4)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.pending_actions, color: colorWarn),
                          const SizedBox(width: 10),
                          Expanded(child: Text('$count parent account${count == 1 ? '' : 's'} awaiting approval',
                              style: GoogleFonts.inter(fontSize: 13, color: colorWarn, fontWeight: FontWeight.w600))),
                          const Icon(Icons.chevron_right, color: colorWarn),
                        ],
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
              orElse: () => const SizedBox.shrink(),
            ),

            // KPI cards
            children.when(
              loading: () => const Row(children: [
                Expanded(child: LoadingSkeleton(height: 80)),
                SizedBox(width: 12),
                Expanded(child: LoadingSkeleton(height: 80)),
                SizedBox(width: 12),
                Expanded(child: LoadingSkeleton(height: 80)),
              ]),
              error: (_, __) => const SizedBox.shrink(),
              data: (kids) {
                final high = kids.where((c) => c.riskLevel == 'HIGH').length;
                final sam  = kids.where((c) => c.nutritionStatus == 'SAM').length;
                return Row(
                  children: [
                    _KpiCard(label: 'Registered', value: '${kids.length}', icon: Icons.people, color: colorInk),
                    const SizedBox(width: 12),
                    _KpiCard(label: 'High Risk', value: '$high', icon: Icons.warning_amber, color: colorDanger),
                    const SizedBox(width: 12),
                    _KpiCard(label: 'SAM', value: '$sam', icon: Icons.local_hospital, color: colorDanger),
                  ],
                );
              },
            ),

            const SizedBox(height: 20),

            // Scan banner
            GestureDetector(
              onTap: () => context.go('/nurse/scan'),
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: colorInk, borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    const Icon(Icons.qr_code_scanner, color: colorGold, size: 28),
                    const SizedBox(width: 14),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Scan child QR', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorCream)),
                        Text('Instant record lookup', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF8BBFB0))),
                      ],
                    )),
                    const Icon(Icons.chevron_right, color: colorGold),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Quick actions
            Row(children: [
              _ActionBtn(label: 'Children', icon: Icons.people, onTap: () => context.go('/nurse/children')),
              const SizedBox(width: 10),
              _ActionBtn(label: 'Register', icon: Icons.person_add, onTap: () => context.go('/nurse/register')),
              const SizedBox(width: 10),
              _ActionBtn(label: 'Approvals', icon: Icons.check_circle, onTap: () => context.go('/nurse/approvals')),
            ]),
          ],
        ),
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _KpiCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(14), border: Border.all(color: colorBorder)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(value, style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk)),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
      ]),
    ),
  );
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  const _ActionBtn({required this.label, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(color: colorBgElev, borderRadius: BorderRadius.circular(12), border: Border.all(color: colorBorder)),
        child: Column(children: [
          Icon(icon, color: colorInk, size: 22),
          const SizedBox(height: 6),
          Text(label, style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: colorInk), textAlign: TextAlign.center),
        ]),
      ),
    ),
  );
}
