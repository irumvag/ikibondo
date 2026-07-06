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
import '../../shared/widgets/risk_badge.dart';

final parentChildrenProvider = FutureProvider.autoDispose<List<Child>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.children);
  final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
  return items.map((e) => Child.fromJson(e as Map<String, dynamic>)).toList();
});

class ParentDashboardScreen extends ConsumerWidget {
  const ParentDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final childrenAsync = ref.watch(parentChildrenProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Ikibondo'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.go('/parent/notifications'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(parentChildrenProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Hello, ${user?.fullName.split(' ').first ?? ''}',
              style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk),
            ),
            const SizedBox(height: 4),
            Text("Here are your children's health summaries",
                style: GoogleFonts.inter(fontSize: 14, color: colorMuted)),
            const SizedBox(height: 20),

            childrenAsync.when(
              loading: () => Column(
                children: List.generate(2, (_) => const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: SkeletonCard(),
                )),
              ),
              error: (e, _) => Center(child: Text('Failed to load children', style: GoogleFonts.inter(color: colorDanger))),
              data: (children) {
                if (children.isEmpty) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        children: [
                          const Icon(Icons.child_care, size: 56, color: colorMuted),
                          const SizedBox(height: 12),
                          Text('No children linked to your account yet.',
                              style: GoogleFonts.inter(fontSize: 14, color: colorMuted), textAlign: TextAlign.center),
                        ],
                      ),
                    ),
                  );
                }
                return Column(
                  children: children.map((child) => _ChildCard(child: child)).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  final Child child;
  const _ChildCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.go('/parent/children/${child.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: colorBgElev,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorBorder),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Column(
          children: [
            // Risk color strip
            Container(
              height: 5,
              decoration: BoxDecoration(
                color: riskColor(child.riskLevel),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 52, height: 52,
                    decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(14)),
                    child: Center(child: Text(child.fullName[0],
                        style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w700, color: colorInk))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(child.fullName, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                        const SizedBox(height: 2),
                        Text(child.ageDisplay ?? '', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                        const SizedBox(height: 6),
                        RiskBadge(riskLevel: child.riskLevel, nutritionStatus: child.nutritionStatus),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: colorMuted),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
