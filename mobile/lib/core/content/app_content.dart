import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../providers/auth_provider.dart';
import '../api/response.dart';

/// Text an admin can change on the website (Admin → Site content), with the
/// built-in wording used until they do. Keep in step with DEFAULTS in
/// frontend/src/lib/siteContent.ts.
const Map<String, Map<String, dynamic>> _defaults = {
  'app.parent_home': {
    'title': 'Your child’s health, in one place',
    'body': 'See each child’s growth and vaccinations, ask for a home visit, and get reminders '
        'before a dose is due. Your community health worker is one tap away.',
  },
  'app.certificate': {
    'title': 'Getting a vaccination certificate',
    'body': 'The app shows every dose your child has received. For an official, stamped certificate:',
    'steps': [
      {'title': 'Open Vaccines', 'description': 'Check that every dose your child received is marked as given.'},
      {'title': 'Visit your health centre',
       'description': 'Bring the child’s QR card or registration number to the nurse at your camp.'},
      {'title': 'Collect the certificate', 'description': 'The nurse prints and stamps the certificate from Ikibondo.'},
    ],
  },
};

bool _present(dynamic v) => v is String ? v.trim().isNotEmpty : v is List ? v.isNotEmpty : v != null;

/// Defaults, overridden by the admin's English text, then by the user's language.
Map<String, dynamic> resolveContent(Map<String, dynamic> stored, String key, String lang) {
  final out = Map<String, dynamic>.from(_defaults[key] ?? const {});
  final row = stored[key];
  if (row is Map) {
    for (final layer in [row['content_en'], if (lang != 'en') row['content_$lang']]) {
      if (layer is! Map) continue;
      layer.forEach((field, value) {
        if (out.containsKey(field) && _present(value)) out[field as String] = value;
      });
    }
  }
  return out;
}

final _storedContentProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  try {
    final resp = await ApiClient.dio.get(Endpoints.siteContent);
    final data = resp.data is Map ? resp.data['data'] : null;
    return data is Map ? Map<String, dynamic>.from(data) : const {};
  } catch (_) {
    return const {}; // offline or server down: built-in text
  }
});

/// One section of admin-edited content, ready to show (never fails).
final appContentProvider = Provider.family<Map<String, dynamic>, String>((ref, key) {
  final stored = ref.watch(_storedContentProvider).value ?? const {};
  final lang = ref.watch(authProvider).user?.preferredLanguage ?? 'en';
  return resolveContent(stored, key, lang);
});

/// Announcements the admin marked for dashboards, in the user's language.
final announcementsProvider = FutureProvider.autoDispose<List<String>>((ref) async {
  final lang = ref.watch(authProvider).user?.preferredLanguage ?? 'en';
  try {
    final resp = await ApiClient.dio.get(Endpoints.announcements);
    return unwrapList(resp.data)
        .map((a) => ((a['message_$lang'] as String?)?.trim().isNotEmpty ?? false)
            ? a['message_$lang'] as String
            : (a['message_en'] as String? ?? ''))
        .where((m) => m.isNotEmpty)
        .toList();
  } catch (_) {
    return const [];
  }
});
