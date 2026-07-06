import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/notification.dart';
import '../../core/theme/app_theme.dart';

final _notifProvider = FutureProvider.autoDispose<List<AppNotification>>((ref) async {
  final resp = await ApiClient.dio.get(Endpoints.notifications);
  final items = (resp.data['data']?['results'] ?? resp.data['results'] ?? []) as List;
  return items.map((e) => AppNotification.fromJson(e as Map<String, dynamic>)).toList();
});

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(_notifProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ApiClient.dio.patch(Endpoints.markAllRead);
              ref.invalidate(_notifProvider);
            },
            child: Text('Mark all read', style: GoogleFonts.inter(fontSize: 13, color: colorCream)),
          ),
        ],
      ),
      body: notifAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load notifications')),
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.notifications_none, size: 56, color: colorMuted),
                  const SizedBox(height: 12),
                  Text('No notifications', style: GoogleFonts.inter(fontSize: 16, color: colorInk, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(_notifProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final n = notifications[i];
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
                        border: Border.all(
                          color: n.isHighRisk ? colorDanger.withOpacity(0.3) : colorBorder,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38, height: 38,
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
                                      fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600,
                                    ),
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 4),
                                Text(
                                  DateFormat('MMM d, HH:mm').format(DateTime.parse(n.createdAt).toLocal()),
                                  style: GoogleFonts.inter(fontSize: 11, color: colorMuted),
                                ),
                              ],
                            ),
                          ),
                          if (!n.isRead)
                            Container(
                              width: 8, height: 8,
                              decoration: const BoxDecoration(color: colorInk, shape: BoxShape.circle),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
