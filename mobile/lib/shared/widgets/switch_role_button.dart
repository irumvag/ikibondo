import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/user.dart';
import '../../core/providers/auth_provider.dart';

const _labels = {
  UserRole.admin: 'Administrator',
  UserRole.supervisor: 'Supervisor',
  UserRole.nurse: 'Nurse',
  UserRole.chw: 'Community health worker',
  UserRole.parent: 'Parent / guardian',
  UserRole.government: 'Government official',
  UserRole.partner: 'NGO / UN partner',
};

/// "Switch role" for people who hold more than one (e.g. a nurse who is also a parent).
/// Hidden for everyone else.
class SwitchRoleButton extends ConsumerWidget {
  const SwitchRoleButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null || user.switchableRoles.length < 2) return const SizedBox.shrink();
    return PopupMenuButton<UserRole>(
      tooltip: 'Switch role',
      icon: const Icon(Icons.swap_horiz),
      initialValue: user.role,
      onSelected: (role) async {
        if (role == user.role) return;
        final error = await ref.read(authProvider.notifier).switchRole(role);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error ?? 'Now working as ${_labels[role]}')),
          );
        }
      },
      itemBuilder: (_) => [
        for (final r in user.switchableRoles)
          CheckedPopupMenuItem(value: r, checked: r == user.role, child: Text(_labels[r] ?? r.name)),
      ],
    );
  }
}
