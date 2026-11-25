import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_errors.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';

final openReferralsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.referrals);
  return unwrapList(resp.data)
      .where((r) => r['status'] == 'PENDING' || r['status'] == 'ACCEPTED')
      .toList();
});

/// Referrals from CHWs in the camp; the nurse records the outcome.
class ReferralsScreen extends ConsumerWidget {
  const ReferralsScreen({super.key});

  Future<void> _complete(BuildContext context, WidgetRef ref, Map<String, dynamic> r) async {
    final outcomeCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Outcome for ${r['child_name'] ?? 'this child'}'),
        content: TextField(
          controller: outcomeCtrl,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'What happened?'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('Save')),
        ],
      ),
    );
    final outcome = outcomeCtrl.text.trim();
    outcomeCtrl.dispose();
    if (ok != true) return;
    try {
      await ApiClient.dio.post(Endpoints.completeReferral('${r['id']}'), data: {'outcome': outcome});
      ref.invalidate(openReferralsProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(serverMessage(e, 'Could not save the outcome.'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final referrals = ref.watch(openReferralsProvider);
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Referrals')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(openReferralsProvider.future),
        child: referrals.when(
          loading: () => ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: 4,
            itemBuilder: (_, __) => const Padding(padding: EdgeInsets.only(bottom: 8), child: SkeletonCard()),
          ),
          error: (e, _) => ListView(padding: const EdgeInsets.all(32), children: [
            Text(serverMessage(e, 'Could not load referrals.'), textAlign: TextAlign.center),
          ]),
          data: (list) => list.isEmpty
              ? ListView(padding: const EdgeInsets.all(32), children: [
                  Text('No open referrals.', textAlign: TextAlign.center, style: GoogleFonts.inter(color: colorMuted)),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final r = list[i];
                    final urgent = r['urgency'] == 'URGENT';
                    final details = [
                      r['target_facility'],
                      r['reason'],
                      if (r['referring_user_name'] != null) 'from ${r['referring_user_name']}',
                    ].where((x) => x != null && '$x'.isNotEmpty).join(' · ');
                    return Card(
                      shape: urgent
                          ? RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(color: colorDanger, width: 1.5),
                            )
                          : null,
                      child: ListTile(
                        title: Text('${r['child_name'] ?? ''}',
                            style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: colorInk)),
                        subtitle: Text(urgent ? 'Urgent · $details' : details),
                        trailing: TextButton(
                          onPressed: () => _complete(context, ref, r),
                          child: const Text('Complete'),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
