import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_errors.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';

/// Open vaccination sessions in the nurse's camp. Sessions are opened on the
/// laptop; the phone is for working through the queue of children.
final openSessionsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.clinicSessions, queryParameters: {'status': 'OPEN'});
  return unwrapList(resp.data).where((s) => s['status'] == 'OPEN').toList();
});

final _eligibleProvider =
    FutureProvider.autoDispose.family<List<Map<String, dynamic>>, String>((ref, sessionId) async {
  final resp = await ApiClient.dio.get(Endpoints.sessionEligible(sessionId));
  return unwrapList(resp.data);
});

class SessionsScreen extends ConsumerWidget {
  const SessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(openSessionsProvider);
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Vaccination sessions')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(openSessionsProvider.future),
        child: sessions.when(
          loading: () => const _Loading(),
          error: (e, _) => _Message(serverMessage(e, 'Could not load sessions.')),
          data: (list) => list.isEmpty
              ? const _Message('No open sessions. Open one from the laptop, then pull to refresh.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final s = list[i];
                    final vaccine = '${s['vaccine_name'] ?? 'Vaccine'}';
                    return Card(
                      child: ListTile(
                        title: Text(vaccine, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: colorInk)),
                        subtitle: Text('${s['session_date'] ?? ''} · ${s['attendance_count'] ?? 0} recorded'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(Uri(
                          path: '/nurse/sessions/${s['id']}',
                          queryParameters: {'vaccine': vaccine},
                        ).toString()),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

/// Session mode: one tap per child. With no signal the tap is queued on the
/// phone and uploaded through /sync/batch/ (op `record_attendance`) later.
class SessionModeScreen extends ConsumerStatefulWidget {
  const SessionModeScreen({super.key, required this.sessionId, required this.title});

  final String sessionId;
  final String title;

  @override
  ConsumerState<SessionModeScreen> createState() => _SessionModeScreenState();
}

class _SessionModeScreenState extends ConsumerState<SessionModeScreen> {
  // Local marks so the list updates immediately, online or not
  final Map<String, String> _marked = {};
  final Set<String> _queued = {};
  final _batchCtrl = TextEditingController();

  @override
  void dispose() {
    _batchCtrl.dispose();
    super.dispose();
  }

  Future<void> _mark(Map<String, dynamic> child, String status) async {
    final childId = '${child['id']}';
    final batch = _batchCtrl.text.trim();
    setState(() => _marked[childId] = status);
    try {
      await ApiClient.dio.post(Endpoints.sessionAttendance(widget.sessionId), data: {
        'attendances': [
          {'child': childId, 'status': status, 'batch_number': batch},
        ],
      });
    } catch (e) {
      if (isNetworkError(e)) {
        await ref.read(syncProvider.notifier).enqueue(
          opType: 'record_attendance',
          payload: {'session': widget.sessionId, 'child': childId, 'status': status, 'batch_number': batch},
          childName: '${widget.title}: ${child['full_name'] ?? ''} ($status)',
        );
        if (mounted) setState(() => _queued.add(childId));
      } else {
        if (mounted) {
          setState(() => _marked.remove(childId));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(serverMessage(e, 'Could not record this child.'))),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final eligible = ref.watch(_eligibleProvider(widget.sessionId));
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: Text(widget.title)),
      body: eligible.when(
        loading: () => const _Loading(),
        error: (e, _) => _Message(serverMessage(e, 'Could not load the children for this session.')),
        data: (children) {
          String? statusOf(Map<String, dynamic> c) =>
              _marked['${c['id']}'] ?? (c['already_recorded'] == true ? c['recorded_status'] as String? : null);
          final todo = children.where((c) => statusOf(c) == null).length;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                controller: _batchCtrl,
                decoration: const InputDecoration(labelText: 'Vaccine batch number'),
              ),
              const SizedBox(height: 12),
              Text('$todo of ${children.length} still to record',
                  style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: colorInk)),
              const SizedBox(height: 10),
              for (final c in children) ...[
                _ChildRow(
                  child: c,
                  status: statusOf(c),
                  queued: _queued.contains('${c['id']}'),
                  onGiven: () => _mark(c, 'DONE'),
                  onMissed: () => _mark(c, 'MISSED'),
                ),
                const SizedBox(height: 8),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ChildRow extends StatelessWidget {
  const _ChildRow({
    required this.child,
    required this.status,
    required this.queued,
    required this.onGiven,
    required this.onMissed,
  });

  final Map<String, dynamic> child;
  final String? status;
  final bool queued;
  final VoidCallback onGiven;
  final VoidCallback onMissed;

  @override
  Widget build(BuildContext context) {
    final done = status != null;
    final details = [
      child['age_display'],
      child['registration_number'],
      if (child['is_overdue'] == true && !done) 'overdue',
      if (queued) 'saved on phone, will upload',
    ].where((x) => x != null && '$x'.isNotEmpty).join(' · ');
    return Card(
      child: ListTile(
        title: Text('${child['full_name'] ?? ''}', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
        subtitle: Text(details),
        trailing: done
            ? Text(status == 'DONE' ? 'Given' : 'Missed',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  color: status == 'DONE' ? colorSuccess : colorWarn,
                ))
            : Row(mainAxisSize: MainAxisSize.min, children: [
                TextButton(onPressed: onMissed, child: const Text('Missed')),
                const SizedBox(width: 4),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(minimumSize: const Size(80, 44)),
                  onPressed: onGiven,
                  child: const Text('Given'),
                ),
              ]),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => ListView(
        // ListView so pull-to-refresh still works on an empty screen
        padding: const EdgeInsets.all(32),
        children: [Text(text, textAlign: TextAlign.center, style: GoogleFonts.inter(color: colorMuted))],
      );
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 4,
        itemBuilder: (_, __) => const Padding(padding: EdgeInsets.only(bottom: 8), child: SkeletonCard()),
      );
}
