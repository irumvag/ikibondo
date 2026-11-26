import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/content/app_content.dart';
import '../../core/models/child.dart';
import '../../core/models/user.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/announcement_banner.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/risk_badge.dart';
import '../../shared/widgets/sign_out_button.dart';
import '../../shared/widgets/switch_role_button.dart';
import '../../shared/widgets/ui.dart';

// Admins and supervisors on the phone: an overview, the statistics partners see,
// and the children list. Accounts, camps and website text stay on the website.

Map<String, dynamic> _data(dynamic body) {
  final d = body is Map ? (body['data'] ?? body) : null;
  return d is Map ? Map<String, dynamic>.from(d) : const {};
}

/// Admin: platform figures. Supervisor: their own work (camp-level).
final oversightFiguresProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final role = ref.watch(currentUserProvider)?.role;
  final resp = await ApiClient.dio.get(role == UserRole.admin ? Endpoints.landingStats : Endpoints.meSummary);
  return _data(resp.data);
});

/// Statistics with the institutional indicators (admin: every camp; supervisor: their camp).
final oversightInsightsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.insightsOverview);
  return _data(resp.data);
});

final _childrenProvider = FutureProvider.autoDispose.family<List<Child>, String>((ref, query) async {
  final resp = await ApiClient.dio.get(
    Endpoints.children,
    queryParameters: {'page_size': 100, if (query.trim().isNotEmpty) 'search': query.trim()},
  );
  return unwrapList(resp.data).map(Child.fromJson).toList();
});

String _cell(dynamic c) {
  if (c is Map) return c['suppressed'] == true ? '<5' : '${c['value'] ?? 0}';
  return c == null ? '—' : '$c';
}

// ── Overview ────────────────────────────────────────────────────────────────
class OversightHomeScreen extends ConsumerWidget {
  const OversightHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final isAdmin = user?.role == UserRole.admin;
    final figures = ref.watch(oversightFiguresProvider);
    final f = figures.value ?? const {};
    final work = f['work'] is Map ? Map<String, dynamic>.from(f['work'] as Map) : const <String, dynamic>{};

    final tiles = isAdmin
        ? [
            (Icons.child_care, '${f['total_children'] ?? '—'}', 'Children', colorInk),
            (Icons.health_and_safety_outlined, '${f['total_chws_active'] ?? '—'}', 'Active CHWs', colorSuccess),
            (Icons.warning_amber_rounded, '${f['high_risk_30d'] ?? '—'}', 'High-risk, 30 days', colorDanger),
            (Icons.vaccines_outlined, f['vaccination_coverage_pct'] == null ? '—' : '${f['vaccination_coverage_pct']}%', 'Vaccination coverage', colorGold),
            (Icons.call_split, '${f['referrals_open'] ?? '—'}', 'Open referrals', colorWarn),
            (Icons.home_work_outlined, '${f['visit_requests_open'] ?? '—'}', 'Visit requests', colorInk),
          ]
        : [
            (Icons.map_outlined, '${work['zones'] ?? '—'}', 'Zones', colorInk),
            (Icons.health_and_safety_outlined, '${work['chws'] ?? '—'}', 'CHWs', colorSuccess),
            (Icons.monitor_weight_outlined, '${work['checkups_this_month'] ?? '—'}', 'Check-ups this month', colorGold),
          ];
    final byRisk = f['children_by_risk'] is Map ? Map<String, dynamic>.from(f['children_by_risk'] as Map) : null;

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Ikibondo'), actions: const [SwitchRoleButton(), SignOutButton()]),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(oversightFiguresProvider);
          ref.invalidate(announcementsProvider);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            HeroHeader(
              icon: isAdmin ? Icons.admin_panel_settings_outlined : Icons.supervisor_account_outlined,
              title: 'Hello, ${user?.fullName.split(' ').first ?? ''}',
              subtitle: isAdmin
                  ? 'Administrator · ${f['total_camps'] ?? '—'} camps'
                  : 'Supervisor${user?.campName != null ? ' · ${user!.campName}' : ''}',
            ),
            const SizedBox(height: 14),
            const AnnouncementBanner(),
            if (figures.isLoading && f.isEmpty) const Padding(padding: EdgeInsets.all(24), child: AppLoader()),
            if (figures.hasError)
              const EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load the figures', text: 'Pull down to try again.'),
            if (f.isNotEmpty)
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.45,
                children: [
                  for (final t in tiles)
                    SoftCard(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Icon(t.$1, color: t.$4, size: 22),
                          Text(t.$2, style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w800, color: colorInk)),
                          Text(t.$3, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                        ],
                      ),
                    ),
                ],
              ),
            if (byRisk != null) ...[
              const SizedBox(height: 16),
              const SectionTitle("Children's status"),
              _StatusBar(byRisk),
            ],
            const SizedBox(height: 16),
            SoftCard(
              onTap: () => context.go('/oversight/stats'),
              child: Row(
                children: [
                  const Icon(Icons.insights_outlined, color: colorInk),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('Key indicators: wasting, stunting, measles and Penta3 coverage',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                  ),
                  const Icon(Icons.chevron_right, color: colorMuted),
                ],
              ),
            ),
            const SizedBox(height: 10),
            SoftCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.laptop_mac, color: colorMuted),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isAdmin
                          ? 'Accounts, camps, organisations, website and app text, and indicator targets are managed on the Ikibondo website.'
                          : 'Staff, zones and CHW assignments are managed on the Ikibondo website.',
                      style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: colorMuted),
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

class _StatusBar extends StatelessWidget {
  final Map<String, dynamic> byRisk;
  const _StatusBar(this.byRisk);

  @override
  Widget build(BuildContext context) {
    const bands = [
      ('HIGH', 'High risk', colorDanger),
      ('MEDIUM', 'Medium', colorWarn),
      ('LOW', 'Low', colorSuccess),
      ('NOT_MEASURED', 'Not measured yet', colorBorder),
    ];
    final total = bands.fold<int>(0, (s, b) => s + ((byRisk[b.$1] as num?)?.toInt() ?? 0));
    return SoftCard(
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 14,
              child: Row(
                children: [
                  for (final b in bands)
                    if (((byRisk[b.$1] as num?)?.toInt() ?? 0) > 0)
                      Expanded(flex: (byRisk[b.$1] as num).toInt(), child: Container(color: b.$3)),
                  if (total == 0) Expanded(child: Container(color: colorBgSand)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          for (final b in bands)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: b.$3, borderRadius: BorderRadius.circular(3))),
                  const SizedBox(width: 10),
                  Expanded(child: Text(b.$2, style: GoogleFonts.inter(fontSize: 13, color: colorInk))),
                  Text('${byRisk[b.$1] ?? 0}', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w700, color: colorInk)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ── Statistics (same indicators as the website) ─────────────────────────────
class OversightStatsScreen extends ConsumerWidget {
  const OversightStatsScreen({super.key});

  static const _groups = [
    ('Nutrition, 6–59 months', ['gam_rate', 'sam_rate', 'stunting_rate', 'underweight_rate', 'screening_coverage']),
    ('Immunisation', ['measles_coverage', 'penta3_coverage', 'penta_dropout']),
    ('Follow-up', ['referral_completion']),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(oversightInsightsProvider);
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Statistics')),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(oversightInsightsProvider),
        child: async.when(
          loading: () => const AppLoader(),
          error: (_, __) => ListView(children: const [
            EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load statistics', text: 'Pull down to try again.'),
          ]),
          data: (d) {
            final total = d['total'] is Map ? Map<String, dynamic>.from(d['total'] as Map) : null;
            final ind = total?['indicators'] is Map ? Map<String, dynamic>.from(total!['indicators'] as Map) : const <String, dynamic>{};
            final camps = (d['camps'] as List?)?.whereType<Map>().toList() ?? const [];
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (total == null)
                  const EmptyState(icon: Icons.insights_outlined, title: 'No camps to show')
                else ...[
                  Text('${camps.length} camp${camps.length == 1 ? '' : 's'} · ${_cell(total['children'])} children',
                      style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                  const SizedBox(height: 4),
                  Text('Rates need at least 5 children; smaller counts show as "<5".',
                      style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                  for (final g in _groups) ...[
                    const SizedBox(height: 14),
                    SectionTitle(g.$1),
                    for (final k in g.$2) _IndicatorTile(ind[k] is Map ? Map<String, dynamic>.from(ind[k] as Map) : null),
                  ],
                  if (camps.length > 1) ...[
                    const SizedBox(height: 14),
                    const SectionTitle('By camp'),
                    for (final c in camps)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: SoftCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${c['name']}', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk)),
                                    Text('${_cell(c['children'])} children · SAM ${_cell(c['sam'])} · MAM ${_cell(c['mam'])}',
                                        style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                                  ],
                                ),
                              ),
                              _RatePill((c['indicators'] as Map?)?['gam_rate'] as Map?, 'GAM'),
                            ],
                          ),
                        ),
                      ),
                  ],
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

Color _levelColor(String? level) => switch (level) {
      'good' => colorSuccess,
      'watch' => colorWarn,
      'alert' => colorDanger,
      _ => colorMuted,
    };

class _IndicatorTile extends StatelessWidget {
  final Map<String, dynamic>? ind;
  const _IndicatorTile(this.ind);

  @override
  Widget build(BuildContext context) {
    final i = ind;
    if (i == null) return const SizedBox.shrink();
    final color = _levelColor(i['level'] as String?);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SoftCard(
        accent: i['level'] == null ? null : color,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text('${i['label']}', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: colorInk))),
                if (i['value'] != null)
                  Text('${i['value']}%', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: colorInk)),
              ],
            ),
            const SizedBox(height: 4),
            if (i['value'] == null)
              Text('Not enough children yet to show a rate.', style: GoogleFonts.inter(fontSize: 12.5, color: colorMuted))
            else if (i['band'] != null)
              StatusPill('${i['band']}', color: color),
            const SizedBox(height: 4),
            Text('${i['benchmark'] ?? ''}${i['target'] != null ? ' Target: ${i['target']}%.' : ''}',
                style: GoogleFonts.inter(fontSize: 11.5, height: 1.35, color: colorMuted)),
          ],
        ),
      ),
    );
  }
}

class _RatePill extends StatelessWidget {
  final Map? ind;
  final String label;
  const _RatePill(this.ind, this.label);

  @override
  Widget build(BuildContext context) {
    final v = ind?['value'];
    if (v == null) return Text('$label —', style: GoogleFonts.inter(fontSize: 12, color: colorMuted));
    return StatusPill('$label $v%', color: _levelColor(ind?['level'] as String?));
  }
}

// ── Children ────────────────────────────────────────────────────────────────
class OversightChildrenScreen extends ConsumerStatefulWidget {
  const OversightChildrenScreen({super.key});

  @override
  ConsumerState<OversightChildrenScreen> createState() => _OversightChildrenScreenState();
}

class _OversightChildrenScreenState extends ConsumerState<OversightChildrenScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_childrenProvider(_query));
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Children')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by name or registration number'),
              textInputAction: TextInputAction.search,
              onSubmitted: (v) => setState(() => _query = v),
              onChanged: (v) {
                if (v.isEmpty) setState(() => _query = '');
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => ref.invalidate(_childrenProvider(_query)),
              child: async.when(
                loading: () => const AppLoader(),
                error: (_, __) => ListView(children: const [
                  EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load children'),
                ]),
                data: (kids) => kids.isEmpty
                    ? ListView(children: const [EmptyState(icon: Icons.child_care, title: 'No children found')])
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                        itemCount: kids.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) {
                          final c = kids[i];
                          return SoftCard(
                            onTap: () => context.go('/oversight/children/${c.id}'),
                            child: Row(
                              children: [
                                InitialAvatar(c.fullName),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(c.fullName, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                                      Text([c.registrationNumber, c.ageDisplay, c.campName].whereType<String>().join(' · '),
                                          style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                                    ],
                                  ),
                                ),
                                RiskBadge(riskLevel: c.riskLevel, nutritionStatus: c.nutritionStatus, compact: true),
                                const Icon(Icons.chevron_right, color: colorMuted),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
