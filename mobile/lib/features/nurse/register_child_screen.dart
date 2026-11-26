import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_errors.dart';
import '../../core/api/endpoints.dart';
import '../../core/api/response.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/ui.dart';

/// Zones of the nurse's camp, for the zone picker.
final _zonesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final campId = ref.watch(currentUserProvider)?.campId;
  if (campId == null) return const [];
  final resp = await ApiClient.dio.get(Endpoints.campZones(campId));
  return unwrapList(resp.data);
});

const _relationships = {
  'mother': 'Mother',
  'father': 'Father',
  'grandparent': 'Grandparent',
  'other relative': 'Other relative',
  'caregiver': 'Caregiver',
};
const _feeding = {'BREAST': 'Breastfeeding only', 'FORMULA': 'Formula', 'MIXED': 'Mixed'};

/// Register a newborn in three steps (same flow as the website): the guardian,
/// the baby, then optionally the parent's app account. The child is saved first,
/// so a failed account never leaves an account with no child behind.
class RegisterChildScreen extends ConsumerStatefulWidget {
  const RegisterChildScreen({super.key});

  @override
  ConsumerState<RegisterChildScreen> createState() => _RegisterChildScreenState();
}

class _RegisterChildScreenState extends ConsumerState<RegisterChildScreen> {
  int _step = 0;
  bool _submitting = false;
  String? _error;
  final _errors = <String, String>{};
  Map<String, dynamic>? _result;

  // Guardian
  final _guardianName = TextEditingController();
  final _guardianPhone = TextEditingController();
  final _guardianNid = TextEditingController();
  String _relationship = 'mother';

  // Baby
  final _childName = TextEditingController();
  final _birthWeight = TextEditingController();
  final _gestAge = TextEditingController();
  DateTime? _dob;
  String? _sex;
  String? _feedingType;
  String? _zone;

  // Parent account
  bool _createAccount = true;
  final _parentEmail = TextEditingController();

  @override
  void dispose() {
    for (final c in [_guardianName, _guardianPhone, _guardianNid, _childName, _birthWeight, _gestAge, _parentEmail]) {
      c.dispose();
    }
    super.dispose();
  }

  String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  bool _validate() {
    _errors.clear();
    if (_step == 0) {
      if (_guardianName.text.trim().length < 3) _errors['gname'] = 'Enter the guardian\'s full name';
      final phone = _guardianPhone.text.replaceAll(RegExp(r'[\s-]'), '');
      if (!RegExp(r'^(\+?250)?0?7\d{8}$').hasMatch(phone)) _errors['gphone'] = 'Enter a Rwandan mobile number, e.g. 078 123 4567';
    } else if (_step == 1) {
      if (_childName.text.trim().length < 2) _errors['cname'] = 'Enter the baby\'s name';
      if (_dob == null) _errors['dob'] = 'Choose the date of birth';
      if (_sex == null) _errors['sex'] = 'Choose girl or boy';
      final w = double.tryParse(_birthWeight.text.trim());
      if (_birthWeight.text.trim().isNotEmpty && (w == null || w < 0.5 || w > 6)) {
        _errors['weight'] = 'Birth weight is usually between 0.5 and 6 kg';
      }
      final g = int.tryParse(_gestAge.text.trim());
      if (_gestAge.text.trim().isNotEmpty && (g == null || g < 22 || g > 44)) {
        _errors['gest'] = 'Between 22 and 44 weeks';
      }
    } else if (_step == 2 && _createAccount) {
      final e = _parentEmail.text.trim();
      if (e.isNotEmpty && !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(e)) _errors['email'] = 'Check the email address';
    }
    setState(() {});
    return _errors.isEmpty;
  }

  Future<void> _submit() async {
    if (!_validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final user = ref.read(currentUserProvider);
    try {
      // 1. The child (and a new guardian record)
      final resp = await ApiClient.dio.post(Endpoints.children, data: {
        'full_name': _childName.text.trim(),
        'date_of_birth': _iso(_dob!),
        'sex': _sex,
        'camp': user?.campId,
        if (_zone != null) 'zone': _zone,
        // Optional fields only when filled in (the API refuses null)
        if (_birthWeight.text.trim().isNotEmpty) 'birth_weight': double.parse(_birthWeight.text.trim()),
        if (_gestAge.text.trim().isNotEmpty) 'gestational_age': int.parse(_gestAge.text.trim()),
        if (_feedingType != null) 'feeding_type': _feedingType,
        'guardian': {
          'full_name': _guardianName.text.trim(),
          'phone_number': _guardianPhone.text.trim(),
          'relationship': _relationship,
          if (_guardianNid.text.trim().isNotEmpty) 'national_id': _guardianNid.text.trim(),
        },
      });
      final child = Map<String, dynamic>.from((resp.data['data'] ?? resp.data) as Map);
      final result = <String, dynamic>{'child': child};

      // 2. The parent's app account, linked to the guardian
      if (_createAccount) {
        try {
          final acc = await ApiClient.dio.post(Endpoints.users, data: {
            'full_name': _guardianName.text.trim(),
            'phone_number': _guardianPhone.text.trim(),
            if (_parentEmail.text.trim().isNotEmpty) 'email': _parentEmail.text.trim(),
            'role': 'PARENT',
          });
          final parent = Map<String, dynamic>.from((acc.data['data'] ?? acc.data) as Map);
          await ApiClient.dio.post(Endpoints.linkGuardianAccount('${child['guardian']}'),
              data: {'user_id': parent['id']});
          result['parent'] = parent;
        } catch (e) {
          result['account_error'] = serverMessage(e, 'The parent account could not be created.');
        }
      }

      // The official card code for the QR
      try {
        final qr = await ApiClient.dio.get(Endpoints.childQr('${child['id']}'));
        result['qr_code'] = (qr.data['data'] as Map?)?['qr_code'];
      } catch (_) {}

      setState(() => _result = result);
    } catch (e) {
      setState(() => _error = serverMessage(e, 'Registration failed. Check the form and try again.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _next() {
    if (!_validate()) return;
    if (_step < 2) {
      setState(() {
        _step++;
        _error = null;
      });
    } else {
      _submit();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_result != null) {
      return _SuccessScreen(
        result: _result!,
        onAnother: () => setState(() {
          _result = null;
          _step = 0;
          for (final c in [_guardianName, _guardianPhone, _guardianNid, _childName, _birthWeight, _gestAge, _parentEmail]) {
            c.clear();
          }
          _dob = null;
          _sex = null;
          _feedingType = null;
          _zone = null;
        }),
      );
    }

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Register newborn')),
      body: Column(
        children: [
          _StepHeader(step: _step),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: SoftCard(
                      accent: colorDanger,
                      child: Row(children: [
                        const Icon(Icons.error_outline, color: colorDanger),
                        const SizedBox(width: 10),
                        Expanded(child: Text(_error!, style: GoogleFonts.inter(fontSize: 13, color: colorDanger))),
                      ]),
                    ),
                  ),
                ...switch (_step) {
                  0 => _guardianStep(),
                  1 => _babyStep(),
                  _ => _parentStep(),
                },
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
              decoration: const BoxDecoration(
                color: colorBgElev,
                boxShadow: [BoxShadow(color: Color(0x140E4C92), blurRadius: 12, offset: Offset(0, -4))],
              ),
              child: Row(
                children: [
                  if (_step > 0) ...[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _submitting ? null : () => setState(() {
                              _step--;
                              _error = null;
                              _errors.clear();
                            }),
                        child: const Text('Back'),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _next,
                      child: _submitting
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(_step == 2 ? 'Register baby' : 'Continue'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  List<Widget> _guardianStep() => [
        _Section(
          icon: Icons.family_restroom,
          title: 'Who is the guardian?',
          subtitle: 'The person who looks after the baby. They receive reminders by SMS.',
          children: [
            _Field(_guardianName, 'Full name', error: _errors['gname'], icon: Icons.person_outline,
                caps: TextCapitalization.words),
            _Field(_guardianPhone, 'Mobile number', error: _errors['gphone'], icon: Icons.phone_outlined,
                hint: '078 123 4567', keyboard: TextInputType.phone),
            _Field(_guardianNid, 'National ID (optional)', icon: Icons.badge_outlined, keyboard: TextInputType.number),
            const _Label('Relationship to the baby'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final r in _relationships.entries)
                  ChoiceChip(
                    label: Text(r.value),
                    selected: _relationship == r.key,
                    showCheckmark: false,
                    selectedColor: colorInk,
                    labelStyle: GoogleFonts.inter(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: _relationship == r.key ? Colors.white : colorInk),
                    onSelected: (_) => setState(() => _relationship = r.key),
                  ),
              ],
            ),
          ],
        ),
      ];

  List<Widget> _babyStep() {
    final zones = ref.watch(_zonesProvider).value ?? const [];
    return [
      _Section(
        icon: Icons.child_friendly_outlined,
        title: 'About the baby',
        children: [
          _Field(_childName, 'Baby\'s full name', error: _errors['cname'], icon: Icons.child_care,
              caps: TextCapitalization.words),
          // Date of birth
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: _dob ?? DateTime.now(),
                firstDate: DateTime.now().subtract(const Duration(days: 365 * 5)),
                lastDate: DateTime.now(),
                helpText: 'Date of birth',
              );
              if (d != null) setState(() => _dob = d);
            },
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: 'Date of birth',
                prefixIcon: const Icon(Icons.cake_outlined),
                suffixIcon: const Icon(Icons.calendar_month_outlined),
                errorText: _errors['dob'],
              ),
              child: Text(_dob == null ? 'Choose a date' : _iso(_dob!),
                  style: GoogleFonts.inter(fontSize: 15, color: _dob == null ? colorMuted : colorInk)),
            ),
          ),
          const SizedBox(height: 14),
          const _Label('Sex'),
          Row(
            children: [
              for (final s in const [('F', 'Girl', Icons.girl), ('M', 'Boy', Icons.boy)]) ...[
                Expanded(
                  child: _BigChoice(
                    icon: s.$3,
                    label: s.$2,
                    selected: _sex == s.$1,
                    onTap: () => setState(() => _sex = s.$1),
                  ),
                ),
                if (s.$1 == 'F') const SizedBox(width: 10),
              ],
            ],
          ),
          if (_errors['sex'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Text(_errors['sex']!, style: GoogleFonts.inter(fontSize: 12, color: colorDanger)),
            ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Field(_birthWeight, 'Birth weight (kg)', error: _errors['weight'],
                    keyboard: const TextInputType.numberWithOptions(decimal: true), hint: '3.2'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Field(_gestAge, 'Born at (weeks)', error: _errors['gest'],
                    keyboard: TextInputType.number, hint: '39'),
              ),
            ],
          ),
          const _Label('Feeding (optional)'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in _feeding.entries)
                ChoiceChip(
                  label: Text(f.value),
                  selected: _feedingType == f.key,
                  showCheckmark: false,
                  selectedColor: colorInk,
                  labelStyle: GoogleFonts.inter(
                      fontSize: 13, fontWeight: FontWeight.w600,
                      color: _feedingType == f.key ? Colors.white : colorInk),
                  onSelected: (sel) => setState(() => _feedingType = sel ? f.key : null),
                ),
            ],
          ),
          if (zones.isNotEmpty) ...[
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _zone,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Zone (optional)', prefixIcon: Icon(Icons.map_outlined)),
              items: [
                for (final z in zones) DropdownMenuItem(value: '${z['id']}', child: Text('${z['name']}')),
              ],
              onChanged: (v) => setState(() => _zone = v),
            ),
          ],
        ],
      ),
    ];
  }

  List<Widget> _parentStep() => [
        _Section(
          icon: Icons.phone_iphone,
          title: 'Parent app account',
          subtitle: 'With an account the parent sees growth, vaccines and reminders on their own phone.',
          children: [
            SwitchListTile.adaptive(
              contentPadding: EdgeInsets.zero,
              value: _createAccount,
              activeColor: colorInk,
              title: Text('Create an account for ${_guardianName.text.trim().isEmpty ? 'the guardian' : _guardianName.text.trim()}',
                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
              subtitle: Text('They choose their own password from a link sent by SMS.',
                  style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
              onChanged: (v) => setState(() => _createAccount = v),
            ),
            if (_createAccount)
              _Field(_parentEmail, 'Email (optional)', error: _errors['email'], icon: Icons.alternate_email,
                  keyboard: TextInputType.emailAddress),
          ],
        ),
        const SizedBox(height: 14),
        _Section(
          icon: Icons.fact_check_outlined,
          title: 'Check before registering',
          children: [
            _Review('Baby', '${_childName.text.trim()} · ${_sex == 'F' ? 'girl' : 'boy'} · born ${_dob == null ? '' : _iso(_dob!)}'),
            if (_birthWeight.text.trim().isNotEmpty || _gestAge.text.trim().isNotEmpty)
              _Review('At birth', [
                if (_birthWeight.text.trim().isNotEmpty) '${_birthWeight.text.trim()} kg',
                if (_gestAge.text.trim().isNotEmpty) '${_gestAge.text.trim()} weeks',
              ].join(' · ')),
            _Review('Guardian',
                '${_guardianName.text.trim()} (${_relationships[_relationship]}) · ${_guardianPhone.text.trim()}'),
            _Review('Camp', ref.watch(currentUserProvider)?.campName ?? ''),
          ],
        ),
      ];
}

// ── Pieces ─────────────────────────────────────────────────────────────────
class _StepHeader extends StatelessWidget {
  final int step;
  const _StepHeader({required this.step});

  @override
  Widget build(BuildContext context) {
    const steps = [('Guardian', Icons.family_restroom), ('Baby', Icons.child_care), ('Parent app', Icons.phone_iphone)];
    return Container(
      color: colorBgElev,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
      child: Row(
        children: [
          for (var i = 0; i < steps.length; i++) ...[
            Expanded(
              child: Column(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: i < step ? colorSuccess : (i == step ? colorInk : colorBgSand),
                    ),
                    child: Icon(i < step ? Icons.check : steps[i].$2,
                        size: 19, color: i <= step ? Colors.white : colorMuted),
                  ),
                  const SizedBox(height: 5),
                  Text(steps[i].$1,
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: i == step ? FontWeight.w700 : FontWeight.w500,
                          color: i == step ? colorInk : colorMuted)),
                ],
              ),
            ),
            if (i < steps.length - 1)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Container(height: 2, color: i < step ? colorSuccess : colorBorder),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final List<Widget> children;
  const _Section({required this.icon, required this.title, this.subtitle, required this.children});

  @override
  Widget build(BuildContext context) => SoftCard(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
                  child: Icon(icon, size: 20, color: colorInk),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(title, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
                ),
              ],
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle!, style: GoogleFonts.inter(fontSize: 12.5, height: 1.4, color: colorMuted)),
            ],
            const SizedBox(height: 16),
            ...children,
            const SizedBox(height: 8),
          ],
        ),
      );
}

class _Field extends StatelessWidget {
  final TextEditingController ctrl;
  final String label;
  final String? error, hint;
  final IconData? icon;
  final TextInputType? keyboard;
  final TextCapitalization caps;
  const _Field(this.ctrl, this.label,
      {this.error, this.hint, this.icon, this.keyboard, this.caps = TextCapitalization.none});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: TextField(
          controller: ctrl,
          keyboardType: keyboard,
          textCapitalization: caps,
          textInputAction: TextInputAction.next,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            errorText: error,
            prefixIcon: icon == null ? null : Icon(icon),
          ),
        ),
      );
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 2, bottom: 8),
        child: Text(text, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorMuted)),
      );
}

class _BigChoice extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _BigChoice({required this.icon, required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: selected ? colorInk : colorBgElev,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: selected ? colorInk : colorBorder, width: 1.5),
          ),
          child: Column(
            children: [
              Icon(icon, size: 30, color: selected ? Colors.white : colorInk),
              Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 14, fontWeight: FontWeight.w700, color: selected ? Colors.white : colorInk)),
            ],
          ),
        ),
      );
}

class _Review extends StatelessWidget {
  final String label;
  final String value;
  const _Review(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 78, child: Text(label, style: GoogleFonts.inter(fontSize: 13, color: colorMuted))),
            Expanded(
              child: Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
            ),
          ],
        ),
      );
}

// ── After registering ──────────────────────────────────────────────────────
class _SuccessScreen extends StatelessWidget {
  final Map<String, dynamic> result;
  final VoidCallback onAnother;
  const _SuccessScreen({required this.result, required this.onAnother});

  @override
  Widget build(BuildContext context) {
    final child = result['child'] as Map<String, dynamic>;
    final parent = result['parent'] as Map<String, dynamic>?;
    final delivery = parent?['setup_delivery'] as Map?;
    final setupLink = parent?['setup_link'] as String?;
    final code = (result['qr_code'] as String?) ?? '${child['registration_number']}';

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Baby registered'), automaticallyImplyLeading: false),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const HeroHeader(icon: Icons.check_circle_outline, title: 'Registered', subtitle: 'The vaccination schedule has been created.'),
          const SizedBox(height: 14),
          SoftCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const IkibondoLogo(size: 28),
                const SizedBox(height: 12),
                Text('${child['full_name']}', style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.w800, color: colorInk)),
                const SizedBox(height: 4),
                Text('${child['registration_number']}',
                    style: GoogleFonts.robotoMono(fontSize: 14, fontWeight: FontWeight.w600, color: colorMuted)),
                const SizedBox(height: 14),
                QrImageView(
                  data: code,
                  size: 190,
                  eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.circle, color: colorInk),
                  dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.circle, color: Color(0xFF0B2545)),
                ),
                const SizedBox(height: 8),
                Text('The parent can show this card at every visit',
                    style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          if (result['account_error'] != null)
            SoftCard(
              accent: colorWarn,
              child: Text('Baby registered, but the parent account was not created: ${result['account_error']}',
                  style: GoogleFonts.inter(fontSize: 13, color: colorInk)),
            )
          else if (parent != null)
            SoftCard(
              accent: colorSuccess,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Parent account created',
                      style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w700, color: colorInk)),
                  const SizedBox(height: 4),
                  Text(
                    delivery?['sms'] == true || delivery?['email'] == true
                        ? 'A link to choose a password was sent${delivery?['sms'] == true ? ' by SMS' : ''}'
                            '${delivery?['email'] == true ? ' by email' : ''}.'
                        : 'No SMS or email could be sent. Let the parent scan this code with their phone to set a password:',
                    style: GoogleFonts.inter(fontSize: 13, height: 1.4, color: colorMuted),
                  ),
                  if (setupLink != null) ...[
                    const SizedBox(height: 10),
                    Center(child: QrImageView(data: setupLink, size: 160)),
                  ],
                ],
              ),
            ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            icon: const Icon(Icons.folder_open_outlined),
            label: const Text('Open the baby\'s record'),
            onPressed: () => context.go('/nurse/children/${child['id']}'),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            icon: const Icon(Icons.person_add_alt),
            label: const Text('Register another baby'),
            onPressed: onAnother,
          ),
        ],
      ),
    );
  }
}
