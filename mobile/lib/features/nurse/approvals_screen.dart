import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/loading_skeleton.dart';

final _pendingProvider = FutureProvider.autoDispose<List>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.pendingApprovals);
  return (resp.data['data'] ?? resp.data) as List? ?? [];
});

class ApprovalsScreen extends ConsumerWidget {
  const ApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(_pendingProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Parent Approvals')),
      body: pending.when(
        loading: () => ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: 5,
          itemBuilder: (_, __) => const Padding(padding: EdgeInsets.only(bottom: 10), child: SkeletonCard()),
        ),
        error: (_, __) => const Center(child: Text('Failed to load')),
        data: (users) {
          if (users.isEmpty) {
            return Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_circle, size: 56, color: colorSuccess),
                const SizedBox(height: 12),
                Text('No pending approvals', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colorInk)),
              ]),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: users.length,
            itemBuilder: (ctx, i) => _UserApprovalTile(user: users[i] as Map<String, dynamic>, ref: ref),
          );
        },
      ),
    );
  }
}

class _UserApprovalTile extends StatefulWidget {
  final Map<String, dynamic> user;
  final WidgetRef ref;
  const _UserApprovalTile({required this.user, required this.ref});

  @override
  State<_UserApprovalTile> createState() => _UserApprovalTileState();
}

class _UserApprovalTileState extends State<_UserApprovalTile> {
  bool _approving = false;

  Future<void> _approve() async {
    setState(() => _approving = true);
    try {
      await ApiClient.dio.patch(Endpoints.approveUser(widget.user['id'] as String));
      widget.ref.invalidate(_pendingProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.user['full_name']} approved'),
            backgroundColor: colorSuccess,
          ),
        );
      }
    } catch (_) {
      setState(() => _approving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final u = widget.user;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorBgElev,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colorBorder),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: colorBgSand,
            child: Text(
              (u['full_name'] as String? ?? '?')[0].toUpperCase(),
              style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(u['full_name'] as String? ?? '', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                Text(u['email'] as String? ?? '', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                if (u['phone_number'] != null)
                  Text(u['phone_number'] as String, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: _approving ? null : _approve,
            style: ElevatedButton.styleFrom(
              backgroundColor: colorSuccess,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            ),
            child: _approving
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text('Approve', style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
