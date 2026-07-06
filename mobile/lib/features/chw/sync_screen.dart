import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';

class SyncScreen extends ConsumerWidget {
  const SyncScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync    = ref.watch(syncProvider);
    final isOnline = ref.watch(isOnlineProvider);
    final fmt = DateFormat('MMM d, HH:mm');

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Offline Sync')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isOnline ? colorLowBg : colorHighBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isOnline ? colorSuccess : colorDanger, width: 0.8),
              ),
              child: Row(
                children: [
                  Icon(isOnline ? Icons.wifi : Icons.wifi_off,
                      color: isOnline ? colorSuccess : colorDanger),
                  const SizedBox(width: 10),
                  Text(
                    isOnline ? 'Connected — ready to sync' : 'Offline — changes saved locally',
                    style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isOnline ? colorSuccess : colorDanger),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            if (sync.lastResult != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colorBgSand,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: colorMuted, size: 16),
                    const SizedBox(width: 8),
                    Text('Last sync: ${sync.lastResult}', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            Row(
              children: [
                Text(
                  '${sync.pendingCount} pending operation${sync.pendingCount == 1 ? '' : 's'}',
                  style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colorInk),
                ),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: (!isOnline || sync.isSyncing || sync.pendingCount == 0) ? null : () async {
                    final result = await ref.read(syncProvider.notifier).syncNow();
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(result)),
                      );
                    }
                  },
                  icon: sync.isSyncing
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: colorCream))
                      : const Icon(Icons.sync),
                  label: Text(sync.isSyncing ? 'Syncing…' : 'Sync Now'),
                ),
              ],
            ),

            const SizedBox(height: 16),

            if (sync.pending.isEmpty)
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle_outline, size: 56, color: colorSuccess),
                      const SizedBox(height: 12),
                      Text('All caught up!', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600, color: colorInk)),
                      Text('No pending operations to sync.', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
                    ],
                  ),
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  itemCount: sync.pending.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final op = sync.pending[i];
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colorBgElev,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: op.lastError != null ? colorDanger.withOpacity(0.3) : colorBorder,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(_opIcon(op.opType), color: _opColor(op.opType), size: 22),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_opLabel(op.opType), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
                                if (op.childName != null)
                                  Text(op.childName!, style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                                if (op.lastError != null)
                                  Text('Error: ${op.lastError}', style: GoogleFonts.inter(fontSize: 11, color: colorDanger)),
                              ],
                            ),
                          ),
                          Text(fmt.format(op.createdAt), style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  IconData _opIcon(String op) {
    switch (op) {
      case 'create_visit':        return Icons.add_chart;
      case 'administer_vaccine':  return Icons.vaccines;
      case 'register_child':      return Icons.person_add;
      default:                    return Icons.upload;
    }
  }

  Color _opColor(String op) {
    switch (op) {
      case 'create_visit':        return colorSuccess;
      case 'administer_vaccine':  return colorWarn;
      case 'register_child':      return colorInk;
      default:                    return colorMuted;
    }
  }

  String _opLabel(String op) {
    switch (op) {
      case 'create_visit':        return 'Health visit recorded';
      case 'administer_vaccine':  return 'Vaccine administered';
      case 'register_child':      return 'Child registration';
      default:                    return op;
    }
  }
}
