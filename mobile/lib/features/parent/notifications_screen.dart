import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/notification.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/response.dart';
import '../../shared/widgets/brand.dart';
import '../../core/models/child.dart';
import 'child_detail_screen.dart';
import 'dashboard_screen.dart';

final _notifProvider =
    FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.notifications);
  final items = unwrapList(resp.data);
  return items.map((e) => AppNotification.fromJson(e)).toList();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(_notifProvider);
    final children = ref.watch(parentChildrenProvider).value ?? const <Child>[];

    // Missed and overdue doses, worked out from the vaccination records so they
    // show even when the server's daily reminder has not run (or offline).
    final attention = <({Child child, Map<String, dynamic> dose})>[];
    for (final c in children) {
      for (final v in ref.watch(childVaccinesProvider(c.id)).value ??
          const <Map<String, dynamic>>[]) {
        if (v['status'] == 'MISSED' ||
            (v['status'] == 'SCHEDULED' && v['is_overdue'] == true)) {
          attention.add((child: c, dose: v));
        }
      }
    }

    Future<void> refresh() async {
      ref.invalidate(parentChildrenProvider);
      for (final c in children) {
        ref.invalidate(childVaccinesProvider(c.id));
      }
      return ref.refresh(_notifProvider.future);
    }

    final notifications = notifAsync.value ?? const <AppNotification>[];

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          if (notifications.any((n) => !n.isRead))
            TextButton(
              onPressed: () async {
                await ApiClient.dio.patch(Endpoints.markAllRead);
                ref.invalidate(_notifProvider);
              },
              child: Text('Mark all read',
                  style: GoogleFonts.inter(fontSize: 13, color: Colors.white)),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            if (attention.isNotEmpty) ...[
              _Heading('Needs attention', count: attention.length),
              for (final a in attention)
                _AttentionCard(child: a.child, dose: a.dose),
              const SizedBox(height: 18),
            ],
            const _Heading('Messages'),
            if (notifAsync.isLoading && notifications.isEmpty)
              const Padding(padding: EdgeInsets.all(32), child: AppLoader())
            else if (notifAsync.hasError)
              _Empty(
                  icon: Icons.cloud_off_outlined,
                  text: 'Could not load messages. Pull down to try again.')
            else if (notifications.isEmpty)
              _Empty(
                icon: Icons.notifications_none,
                text: attention.isEmpty
                    ? 'No alerts. You will be told here when a vaccine is due or a visit is arranged.'
                    : 'No messages yet.',
              )
            else
              for (final n in notifications)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NotificationTile(
                      n: n, onChanged: () => ref.invalidate(_notifProvider)),
                ),
          ],
        ),
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  final String text;
  final int? count;
  const _Heading(this.text, {this.count});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
        child: Row(
          children: [
            Text(text,
                style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: colorInk)),
            if (count != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                    color: colorHighBg,
                    borderRadius: BorderRadius.circular(20)),
                child: Text('$count',
                    style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: colorDanger)),
              ),
            ],
          ],
        ),
      );
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String text;
  const _Empty({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
            color: colorBgElev,
            borderRadius: BorderRadius.circular(18),
            boxShadow: softShadow),
        child: Column(
          children: [
            Icon(icon, size: 40, color: colorMuted),
            const SizedBox(height: 10),
            Text(text,
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
          ],
        ),
      );
}

class _AttentionCard extends StatelessWidget {
  final Child child;
  final Map<String, dynamic> dose;
  const _AttentionCard({required this.child, required this.dose});

  @override
  Widget build(BuildContext context) {
    final missed = dose['status'] == 'MISSED';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorBgElev,
        borderRadius: BorderRadius.circular(16),
        boxShadow: softShadow,
        border: Border(
            left: BorderSide(
                color: colorDanger.withValues(alpha: 0.8), width: 4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration:
                const BoxDecoration(color: colorHighBg, shape: BoxShape.circle),
            child: const Icon(Icons.vaccines_outlined,
                color: colorDanger, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    '${child.fullName}: ${dose['vaccine_name']} ${missed ? 'missed' : 'overdue'}',
                    style: GoogleFonts.inter(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: colorInk)),
                const SizedBox(height: 2),
                Text(
                    'Was due on ${dose['scheduled_date']}. Take ${child.fullName.split(' ').first} to the '
                    'health centre, or ask your community health worker.',
                    style: GoogleFonts.inter(
                        fontSize: 12.5, height: 1.4, color: colorMuted)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  children: [
                    TextButton(
                      style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact),
                      onPressed: () => context.go('/parent/request-visit'),
                      child: const Text('Request a visit'),
                    ),
                    TextButton(
                      style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          visualDensity: VisualDensity.compact),
                      onPressed: () =>
                          context.go('/parent/children/${child.id}'),
                      child: const Text('Open record'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final AppNotification n;
  final VoidCallback onChanged;
  const _NotificationTile({required this.n, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: Key(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: colorDanger,
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) async {
        await ApiClient.dio.delete(Endpoints.dismissNotif(n.id));
        onChanged();
      },
      child: GestureDetector(
        onTap: () async {
          if (!n.isRead) {
            await ApiClient.dio.patch(Endpoints.markRead(n.id));
          }
          if (n.childId != null && context.mounted) {
            context.go('/parent/children/${n.childId}');
          }
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: n.isRead ? colorBgElev : colorBgSand,
            borderRadius: BorderRadius.circular(14),
            boxShadow: softShadow,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: n.isHighRisk ? colorHighBg : colorMedBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  n.isHighRisk ? Icons.warning_amber : Icons.vaccines,
                  color: n.isHighRisk ? colorDanger : colorWarn,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(n.message,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: colorInk,
                          fontWeight:
                              n.isRead ? FontWeight.normal : FontWeight.w600,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('MMM d, HH:mm')
                          .format(DateTime.parse(n.createdAt).toLocal()),
                      style: GoogleFonts.inter(fontSize: 11, color: colorMuted),
                    ),
                  ],
                ),
              ),
              if (!n.isRead)
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                      color: colorInk, shape: BoxShape.circle),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
