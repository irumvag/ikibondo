import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_errors.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/ui.dart';

/// Home-visit requests from parents in the CHW's caseload (newest first).
final chwVisitRequestsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.visitRequests, queryParameters: {'ordering': '-created_at'});
  return unwrapList(resp.data);
});

const _urgencyColor = {'URGENT': colorDanger, 'SOON': colorWarn, 'ROUTINE': colorInk};
const _statusLabel = {
  'PENDING': 'New',
  'ACCEPTED': 'Accepted',
  'COMPLETED': 'Done',
  'DECLINED': 'Declined',
  'WITHDRAWN': 'Withdrawn',
};

class VisitRequestsScreen extends ConsumerWidget {
  const VisitRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(chwVisitRequestsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Visit requests')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(chwVisitRequestsProvider.future),
        child: async.when(
          loading: () => const AppLoader(),
          error: (e, _) => ListView(children: [
            EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load requests',
                text: serverMessage(e, 'Pull down to try again.')),
          ]),
          data: (all) {
            final open = all.where((r) => r['status'] == 'PENDING' || r['status'] == 'ACCEPTED').toList()
              // Urgent first, then oldest first
              ..sort((a, b) {
                const rank = {'URGENT': 0, 'SOON': 1, 'ROUTINE': 2};
                final u = (rank[a['urgency']] ?? 3).compareTo(rank[b['urgency']] ?? 3);
                return u != 0 ? u : '${a['created_at']}'.compareTo('${b['created_at']}');
              });
            final past = all.where((r) => !open.contains(r)).take(15).toList();
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                SectionTitle('Open (${open.length})'),
                if (open.isEmpty)
                  const EmptyState(icon: Icons.home_work_outlined, title: 'No open requests',
                      text: 'When a parent asks for a home visit, it appears here.'),
                for (final r in open) Padding(padding: const EdgeInsets.only(bottom: 10), child: _RequestCard(r)),
                if (past.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const SectionTitle('Recent'),
                  for (final r in past) Padding(padding: const EdgeInsets.only(bottom: 10), child: _RequestCard(r)),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RequestCard extends ConsumerStatefulWidget {
  final Map<String, dynamic> r;
  const _RequestCard(this.r);

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _busy = false;

  Future<void> _act(String action, {Map<String, dynamic>? data, required String done}) async {
    setState(() => _busy = true);
    try {
      await ApiClient.dio.post('${Endpoints.visitRequest(widget.r['id'] as String)}$action/', data: data ?? {});
      ref.invalidate(chwVisitRequestsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(done), backgroundColor: colorSuccess));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(serverMessage(e, 'Could not update the request.')), backgroundColor: colorDanger));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _decline() async {
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Decline this request?'),
        content: TextField(
          controller: reason,
          decoration: const InputDecoration(labelText: 'Reason (the parent sees this)'),
          maxLines: 2,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Decline')),
        ],
      ),
    );
    if (ok == true) await _act('decline', data: {'reason': reason.text.trim()}, done: 'Request declined');
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    final status = r['status'] as String? ?? '';
    final urgency = r['urgency'] as String? ?? 'ROUTINE';
    final color = _urgencyColor[urgency] ?? colorInk;
    final symptoms = ((r['symptom_flags'] as List?) ?? const []).map((s) => '$s'.replaceAll('_', ' ')).toList();
    final concern = (r['concern_text'] as String?)?.trim() ?? '';
    final created = '${r['created_at'] ?? ''}';

    return SoftCard(
      accent: status == 'PENDING' ? color : null,
      onTap: () => context.go('/chw/children/${r['child']}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              InitialAvatar('${r['child_name'] ?? '?'}', radius: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${r['child_name'] ?? ''}',
                        style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                    Text('Asked by ${r['requested_by_name'] ?? 'parent'} · ${created.length >= 10 ? created.substring(0, 10) : created}',
                        style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                  ],
                ),
              ),
              StatusPill(urgency[0] + urgency.substring(1).toLowerCase(), color: color),
            ],
          ),
          if (symptoms.isNotEmpty || concern.isNotEmpty) ...[
            const SizedBox(height: 10),
            if (symptoms.isNotEmpty)
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [for (final s in symptoms) StatusPill(s, color: colorWarn)],
              ),
            if (concern.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('“$concern”', style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: colorInk)),
            ],
          ],
          const SizedBox(height: 10),
          if (status == 'PENDING')
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : _decline,
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 10)),
                    child: const Text('Decline'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _busy ? null : () => _act('accept', done: 'Accepted — the parent has been told'),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 10)),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            )
          else if (status == 'ACCEPTED')
            Row(
              children: [
                const StatusPill('Accepted', color: colorSuccess),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: _busy ? null : () => _act('complete', done: 'Visit marked as done'),
                  style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10)),
                  icon: const Icon(Icons.check, size: 18),
                  label: const Text('Visit done'),
                ),
              ],
            )
          else
            StatusPill(_statusLabel[status] ?? status,
                color: status == 'COMPLETED' ? colorSuccess : colorMuted),
        ],
      ),
    );
  }
}
