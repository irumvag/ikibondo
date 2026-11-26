import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../providers/auth_provider.dart';
import '../api/response.dart';

/// Text an admin can change on the website (Admin → Site content), with the
/// built-in wording used until they do. Keep in step with DEFAULTS in
/// frontend/src/lib/siteContent.ts.
const Map<String, Map<String, dynamic>> _defaults = {
  'app.feeding': {
    "title": "Feeding your child, by age",
    "body": "What and how much to give at each age, with an example day using foods found in the camp. Wash your hands with soap before cooking and feeding, and use a clean cup and spoon (not a bottle).",
    "steps": [
      {
        "title": "0 to 6 months: breast milk only",
        "description": "Give only breast milk, day and night, whenever the baby wants (8 to 12 times a day). No water, no porridge, no other drinks: breast milk has all the water and food the baby needs.",
      },
      {
        "title": "6 to 8 months: first foods",
        "description": "Keep breastfeeding. Add soft food 2 to 3 times a day, starting with 2 to 3 spoonfuls and slowly up to half a cup. Food should be thick enough to stay on the spoon.\nExample day: thick sorghum or maize porridge with milk · mashed banana or avocado · mashed beans or groundnut paste with a little oil.",
      },
      {
        "title": "9 to 11 months: more meals",
        "description": "Keep breastfeeding. Give 3 to 4 meals and 1 to 2 snacks a day, half a cup each, mashed or finely chopped. Add an animal food every day if you can.\nExample day: porridge with milk and mashed banana · avocado · mashed sweet potato with beans, dodo (green leaves) and small fish (isambaza) · fruit · rice or potato with egg.",
      },
      {
        "title": "12 to 23 months: family food",
        "description": "Keep breastfeeding to 2 years or more. Give 3 to 4 meals and 1 to 2 snacks a day, three quarters to one full cup, cut small. Every day give a food from each group: grains or roots, beans or groundnuts, milk or eggs, fish or meat, green leaves, fruit.\nExample day: porridge with milk · mandazi or fruit · beans, sweet potato, dodo and fish · avocado · ugali with eggs and vegetables.",
      },
      {
        "title": "2 to 5 years",
        "description": "Three family meals and two snacks a day in the child's own plate, so you can see how much they eat. Give milk, eggs, beans, fruit and vegetables. Avoid sweets and sugary drinks.",
      },
      {
        "title": "When your child is sick",
        "description": "Keep breastfeeding and offer food more often, in small amounts. For diarrhoea give ORS and zinc from the health centre. After the illness give one extra meal a day for two weeks.",
      },
    ],
  },
  'app.baby_care': {
    "title": "Caring for your baby",
    "body": "Simple things that keep babies healthy. Your community health worker can show you each one.",
    "steps": [
      {
        "title": "Go to the health centre now if your child",
        "description": "cannot breastfeed or drink · vomits everything · has convulsions (fits) · is very sleepy or hard to wake · breathes fast or with difficulty · has a fever, or a newborn feels cold · has diarrhoea with blood or for many days · a newborn has yellow palms or soles, or a red, smelly cord.",
      },
      {
        "title": "The first days",
        "description": "Breastfeed within the first hour. Keep the baby warm, skin to skin on your chest. Keep the cord clean and dry and put nothing on it. Wait before the first bath.",
      },
      {
        "title": "Sleep",
        "description": "Put the baby to sleep on their back, under a mosquito net, every night.",
      },
      {
        "title": "Clean hands, clean water",
        "description": "Wash hands with soap after the toilet, after changing the baby and before cooking or feeding. Give boiled or treated water to children over 6 months.",
      },
      {
        "title": "Talk and play",
        "description": "Talk, sing and play with your baby every day. Babies learn from your voice and your face, and it helps their brain grow.",
      },
      {
        "title": "Check-ups",
        "description": "Bring your child every month to be weighed and measured, give every vaccine on time, and vitamin A and deworming when the health centre offers them.",
      },
    ],
  },
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
