import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';

/// Signing out wipes this phone's copy of every record, including visits that
/// have not uploaded yet, so say so before doing it.
class SignOutButton extends ConsumerWidget {
  const SignOutButton({super.key});

  Future<void> _confirm(BuildContext context, WidgetRef ref) async {
    final pending = ref.read(pendingCountProvider);
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Sign out?'),
        content: Text(pending > 0
            ? '$pending record${pending == 1 ? ' has' : 's have'} not uploaded yet and will be deleted '
                'from this phone. Connect and sync first to keep ${pending == 1 ? 'it' : 'them'}.'
            : 'Records saved on this phone will be removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(c, true),
            child: Text(pending > 0 ? 'Delete and sign out' : 'Sign out',
                style: const TextStyle(color: colorDanger)),
          ),
        ],
      ),
    );
    if (ok == true) await ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => IconButton(
        tooltip: 'Sign out',
        icon: const Icon(Icons.logout),
        onPressed: () => _confirm(context, ref),
      );
}
