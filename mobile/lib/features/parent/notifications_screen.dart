import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/models/notification.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/response.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/ui.dart';
import 'child_detail_screen.dart';
import 'dashboard_screen.dart';

/// In-app messages only: each alert is also stored once per SMS, which would show twice.
final _notifProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.notifications, queryParameters: {'channel': 'PUSH'});
  return unwrapList(resp.data).map(AppNotification.fromJson).toList();
});

/// What the reminder system has sent: totals, unread, reminders, overdue alerts, SMS.
final notificationSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.notificationSummary);
  final data = resp.data is Map ? resp.data['data'] : null;
  return data is Map ? Map<String, dynamic>.from(data) : const {};
});

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  bool _unreadOnly = false;

  void _refreshMessages() {
    ref.invalidate(_notifProvider);
    ref.invalidate(notificationSummaryProvider);
  }

  Future<void> _setRead(AppNotification n, bool read) async {
    await ApiClient.dio.patch(read ? Endpoints.markRead(n.id) : Endpoints.markUnread(n.id));
    _refreshMessages();
  }

  @override
  Widget build(BuildContext context) {
    final notifAsync = ref.watch(_notifProvider);
    final summary = ref.watch(notificationSummaryProvider).value ?? const {};
    final children = ref.watch(parentChildrenProvider).value ?? const <Child>[];

    // Missed and overdue doses, from the vaccination records: shown even when the
    // server's daily reminder has not run, or the phone is offline
    final attention = <({Child child, Map<String, dynamic> dose})>[];
    for (final c in children) {
      for (final v in ref.watch(childVaccinesProvider(c.id)).value ?? const <Map<String, dynamic>>[]) {
        if (v['status'] == 'MISSED' || (v['status'] == 'SCHEDULED' && v['is_overdue'] == true)) {
          attention.add((child: c, dose: v));
        }
      }
    }

    final all = notifAsync.value ?? const <AppNotification>[];
    final unread = all.where((n) => !n.isRead).length;
    final shown = _unreadOnly ? all.where((n) => !n.isRead).toList() : all;

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          if (unread > 0)
            TextButton.icon(
              icon: const Icon(Icons.done_all, color: Colors.white, size: 18),
              onPressed: () async {
                await ApiClient.dio.patch(Endpoints.markAllRead);
                _refreshMessages();
              },
              label: Text('Read all', style: GoogleFonts.inter(fontSize: 13, color: Colors.white)),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentChildrenProvider);
          for (final c in children) {
            ref.invalidate(childVaccinesProvider(c.id));
          }
          _refreshMessages();
          await ref.read(_notifProvider.future);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            _HowRemindersWork(summary: summary),
            const SizedBox(height: 18),

            if (attention.isNotEmpty) ...[
              SectionTitle('Needs attention (${attention.length})'),
              for (final a in attention) _AttentionCard(child: a.child, dose: a.dose),
              const SizedBox(height: 12),
            ],

            Row(
              children: [
                Expanded(
                  child: Text('Messages',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                ),
                SegmentedButton<bool>(
                  segments: [
                    ButtonSegment(value: false, label: Text('All ${all.length}')),
                    ButtonSegment(value: true, label: Text('Unread $unread')),
                  ],
                  selected: {_unreadOnly},
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    textStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                    selectedBackgroundColor: colorInk,
                    selectedForegroundColor: Colors.white,
                    foregroundColor: colorInk,
                  ),
                  onSelectionChanged: (s) => setState(() => _unreadOnly = s.first),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 10),
              child: Text('Tap a message to open it (marks it read). Use ⋮ to mark read or unread; swipe left to remove.',
                  style: GoogleFonts.inter(fontSize: 11.5, color: colorMuted)),
            ),
            if (notifAsync.isLoading && all.isEmpty)
              const Padding(padding: EdgeInsets.all(32), child: AppLoader())
            else if (notifAsync.hasError)
              const EmptyState(icon: Icons.cloud_off_outlined, title: 'Could not load messages',
                  text: 'Pull down to try again.')
            else if (shown.isEmpty)
              EmptyState(
                icon: Icons.notifications_none,
                title: _unreadOnly ? 'No unread messages' : 'No messages yet',
                text: _unreadOnly ? 'You have read everything.' : 'Reminders and visit updates appear here.',
              )
            else
              for (final n in shown)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NotificationTile(
                    n: n,
                    onOpen: () async {
                      if (!n.isRead) await _setRead(n, true);
                      if (n.childId != null && context.mounted) context.go('/parent/children/${n.childId}');
                    },
                    onToggleRead: () => _setRead(n, !n.isRead),
                    onDismiss: () async {
                      await ApiClient.dio.delete(Endpoints.dismissNotif(n.id));
                      _refreshMessages();
                    },
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

/// Explains the reminder schedule and shows what has been sent so far.
class _HowRemindersWork extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _HowRemindersWork({required this.summary});

  @override
  Widget build(BuildContext context) {
    Widget stat(String value, String label) => Expanded(
          child: Column(
            children: [
              Text(value, style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
              Text(label,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(fontSize: 11, color: Colors.white.withValues(alpha: 0.85))),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(colors: [colorInk, colorSky], begin: Alignment.topLeft, end: Alignment.bottomRight),
        boxShadow: softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              stat('${summary['unread'] ?? 0}', 'Unread'),
              stat('${summary['reminders'] ?? 0}', 'Reminders'),
              stat('${summary['overdue_alerts'] ?? 0}', 'Overdue alerts'),
              stat('${summary['sms_sent'] ?? 0}', 'SMS sent'),
            ],
          ),
          const SizedBox(height: 10),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              iconColor: Colors.white,
              collapsedIconColor: Colors.white,
              title: Text('How reminders work',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: Colors.white)),
              childrenPadding: const EdgeInsets.only(bottom: 4),
              children: [
                for (final line in const [
                  ('Before a dose', '7 days, 3 days and 1 day before, and on the day itself, every morning at 08:00.'),
                  ('After a missed dose', 'An overdue alert on day 1, 7, 14 and 21 after the due date.'),
                  ('How it reaches you', 'Here in the app, by SMS to your phone number, and by email if you gave one.'),
                  ('Visits', 'You are told when your health worker accepts, declines or completes a visit you asked for.'),
                ])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: '${line.$1}: ', style: const TextStyle(fontWeight: FontWeight.w700)),
                        TextSpan(text: line.$2),
                      ]),
                      style: GoogleFonts.inter(fontSize: 12.5, height: 1.4, color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AttentionCard extends StatelessWidget {
  final Child child;
  final Map<String, dynamic> dose;
  const _AttentionCard({required this.child, required this.dose});

  @override
  Widget build(BuildContext context) {
    final missed = dose['status'] == 'MISSED';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        accent: colorDanger,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(color: colorHighBg, shape: BoxShape.circle),
              child: const Icon(Icons.vaccines_outlined, color: colorDanger, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${child.fullName}: ${dose['vaccine_name']} ${missed ? 'missed' : 'overdue'}',
                      style: GoogleFonts.inter(fontSize: 13.5, fontWeight: FontWeight.w700, color: colorInk)),
                  const SizedBox(height: 2),
                  Text('Was due on ${dose['scheduled_date']}. Take ${child.fullName.split(' ').first} to the '
                      'health centre, or ask your community health worker.',
                      style: GoogleFonts.inter(fontSize: 12.5, height: 1.4, color: colorMuted)),
                  Wrap(
                    spacing: 12,
                    children: [
                      TextButton(
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                        onPressed: () => context.go('/parent/request-visit'),
                        child: const Text('Request a visit'),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(padding: EdgeInsets.zero, visualDensity: VisualDensity.compact),
                        onPressed: () => context.go('/parent/children/${child.id}'),
                        child: const Text('Open record'),
                      ),
                    ],
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

class _NotificationTile extends StatelessWidget {
  final AppNotification n;
  final VoidCallback onOpen;
  final VoidCallback onToggleRead;
  final VoidCallback onDismiss;
  const _NotificationTile({required this.n, required this.onOpen, required this.onToggleRead, required this.onDismiss});

  ({IconData icon, Color color}) get _look => switch (n.notificationType) {
        'VACCINATION_OVERDUE' || 'SAM_ALERT' || 'HIGH_RISK_ALERT' => (icon: Icons.warning_amber_rounded, color: colorDanger),
        'VACCINATION_REMINDER' => (icon: Icons.alarm, color: colorWarn),
        'VACCINATION_DONE' => (icon: Icons.verified_outlined, color: colorSuccess),
        _ when n.notificationType.startsWith('VISIT_') => (icon: Icons.home_work_outlined, color: colorInk),
        _ => (icon: Icons.notifications_none, color: colorInk),
      };

  @override
  Widget build(BuildContext context) {
    final look = _look;
    return Dismissible(
      key: Key(n.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(color: colorDanger, borderRadius: BorderRadius.circular(16)),
        child: const Icon(Icons.delete_outline, color: Colors.white),
      ),
      onDismissed: (_) => onDismiss(),
      child: SoftCard(
        onTap: onOpen,
        accent: n.isRead ? null : colorInk,
        padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(color: look.color.withValues(alpha: 0.12), shape: BoxShape.circle),
              child: Icon(look.icon, color: look.color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(n.message.replaceFirst('[Ikibondo] ', ''),
                      style: GoogleFonts.inter(
                          fontSize: 13, height: 1.35, color: colorInk,
                          fontWeight: n.isRead ? FontWeight.w400 : FontWeight.w700)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(DateFormat('d MMM, HH:mm').format(DateTime.parse(n.createdAt).toLocal()),
                          style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
                      const SizedBox(width: 8),
                      if (!n.isRead) const StatusPill('Unread', color: colorInk),
                    ],
                  ),
                ],
              ),
            ),
            PopupMenuButton<String>(
              tooltip: 'Message options',
              icon: const Icon(Icons.more_vert, color: colorMuted),
              onSelected: (v) => v == 'read' ? onToggleRead() : onDismiss(),
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'read',
                  child: Text(n.isRead ? 'Mark as unread' : 'Mark as read'),
                ),
                const PopupMenuItem(value: 'remove', child: Text('Remove')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
