import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

class RegisterChildScreen extends ConsumerStatefulWidget {
  const RegisterChildScreen({super.key});

  @override
  ConsumerState<RegisterChildScreen> createState() => _RegisterChildScreenState();
}

class _RegisterChildScreenState extends ConsumerState<RegisterChildScreen> {
  int _step = 0;
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _createdChild;

  // Step 1 — Guardian
  final _guardianNameCtrl    = TextEditingController();
  final _guardianPhoneCtrl   = TextEditingController();
  final _guardianNidCtrl     = TextEditingController();
  String _relationship       = 'MOTHER';

  // Step 2 — Child
  final _childNameCtrl       = TextEditingController();
  final _birthWeightCtrl     = TextEditingController();
  final _gestAgeCtrl         = TextEditingController();
  DateTime? _dob;
  String _sex                = 'M';
  String _feedingType        = 'BREASTFED';
  String _zone               = '';

  // Step 3 — Parent account link
  final _parentEmailCtrl     = TextEditingController();

  @override
  void dispose() {
    _guardianNameCtrl.dispose();
    _guardianPhoneCtrl.dispose();
    _guardianNidCtrl.dispose();
    _childNameCtrl.dispose();
    _birthWeightCtrl.dispose();
    _gestAgeCtrl.dispose();
    _parentEmailCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _submitting = true; _error = null; });
    try {
      final payload = {
        'full_name': _childNameCtrl.text.trim(),
        'date_of_birth': _dob == null ? null : '${_dob!.year}-${_dob!.month.toString().padLeft(2, '0')}-${_dob!.day.toString().padLeft(2, '0')}',
        'sex': _sex,
        'feeding_type': _feedingType,
        if (_birthWeightCtrl.text.isNotEmpty) 'birth_weight_kg': double.tryParse(_birthWeightCtrl.text),
        if (_gestAgeCtrl.text.isNotEmpty) 'gestational_age_weeks': int.tryParse(_gestAgeCtrl.text),
        if (_zone.isNotEmpty) 'zone': _zone,
        'guardian': {
          'full_name': _guardianNameCtrl.text.trim(),
          'phone_number': _guardianPhoneCtrl.text.trim(),
          'relationship': _relationship,
          if (_guardianNidCtrl.text.isNotEmpty) 'national_id': _guardianNidCtrl.text.trim(),
          if (_parentEmailCtrl.text.isNotEmpty) 'email': _parentEmailCtrl.text.trim(),
        },
      };
      final resp = await ApiClient.dio.post(Endpoints.children, data: payload);
      final data = (resp.data['data'] ?? resp.data) as Map<String, dynamic>;
      setState(() { _createdChild = data; _step = 3; });
    } catch (e) {
      setState(() { _error = 'Registration failed. Check all fields and try again.'; });
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_step == 3 && _createdChild != null) {
      return _SuccessScreen(child: _createdChild!);
    }

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Register Newborn')),
      body: Column(
        children: [
          // Stepper indicator
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Row(
              children: List.generate(3, (i) {
                final active = _step == i;
                final done   = _step > i;
                return Expanded(
                  child: Row(
                    children: [
                      Container(
                        width: 28, height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: done ? colorSuccess : (active ? colorInk : colorBorder),
                        ),
                        child: Center(
                          child: done
                              ? const Icon(Icons.check, size: 14, color: Colors.white)
                              : Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                        ),
                      ),
                      if (i < 2) Expanded(child: Container(height: 2, color: done ? colorSuccess : colorBorder)),
                    ],
                  ),
                );
              }),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Guardian', style: GoogleFonts.inter(fontSize: 10, color: _step == 0 ? colorInk : colorMuted, fontWeight: FontWeight.w600)),
                Text('Child Info', style: GoogleFonts.inter(fontSize: 10, color: _step == 1 ? colorInk : colorMuted, fontWeight: FontWeight.w600)),
                Text('Link Account', style: GoogleFonts.inter(fontSize: 10, color: _step == 2 ? colorInk : colorMuted, fontWeight: FontWeight.w600)),
              ],
            ),
          ),

          if (_error != null)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: colorHighBg, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: GoogleFonts.inter(fontSize: 13, color: colorDanger)),
            ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: [
                _GuardianStep(
                  nameCtrl: _guardianNameCtrl,
                  phoneCtrl: _guardianPhoneCtrl,
                  nidCtrl: _guardianNidCtrl,
                  relationship: _relationship,
                  onRelationshipChanged: (v) => setState(() => _relationship = v!),
                ),
                _ChildInfoStep(
                  nameCtrl: _childNameCtrl,
                  birthWeightCtrl: _birthWeightCtrl,
                  gestAgeCtrl: _gestAgeCtrl,
                  dob: _dob,
                  sex: _sex,
                  feedingType: _feedingType,
                  zone: _zone,
                  onDobTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (d != null) setState(() => _dob = d);
                  },
                  onSexChanged: (v) => setState(() => _sex = v!),
                  onFeedingChanged: (v) => setState(() => _feedingType = v!),
                  onZoneChanged: (v) => setState(() => _zone = v),
                ),
                _LinkAccountStep(emailCtrl: _parentEmailCtrl),
              ][_step],
            ),
          ),

          // Navigation buttons
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  if (_step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() { _step--; _error = null; }),
                        child: const Text('Back'),
                      ),
                    ),
                  if (_step > 0) const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _submitting ? null : () {
                        if (_step < 2) {
                          setState(() { _step++; _error = null; });
                        } else {
                          _submit();
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colorInk,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _submitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(_step == 2 ? 'Register' : 'Next',
                              style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: colorCream)),
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
}

// ── Step widgets ──────────────────────────────────────────────────────────────

class _GuardianStep extends StatelessWidget {
  final TextEditingController nameCtrl, phoneCtrl, nidCtrl;
  final String relationship;
  final ValueChanged<String?> onRelationshipChanged;

  const _GuardianStep({
    required this.nameCtrl, required this.phoneCtrl, required this.nidCtrl,
    required this.relationship, required this.onRelationshipChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Guardian Information', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
        const SizedBox(height: 16),
        _field('Full name *', nameCtrl),
        const SizedBox(height: 12),
        _field('Phone number *', phoneCtrl, keyboardType: TextInputType.phone),
        const SizedBox(height: 12),
        _field('National ID (optional)', nidCtrl),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: relationship,
          decoration: _inputDec('Relationship *'),
          items: ['MOTHER', 'FATHER', 'GRANDPARENT', 'OTHER_RELATIVE', 'CAREGIVER']
              .map((r) => DropdownMenuItem(value: r, child: Text(r.replaceAll('_', ' '))))
              .toList(),
          onChanged: onRelationshipChanged,
        ),
      ],
    );
  }
}

class _ChildInfoStep extends StatelessWidget {
  final TextEditingController nameCtrl, birthWeightCtrl, gestAgeCtrl;
  final DateTime? dob;
  final String sex, feedingType, zone;
  final VoidCallback onDobTap;
  final ValueChanged<String?> onSexChanged, onFeedingChanged;
  final ValueChanged<String> onZoneChanged;

  const _ChildInfoStep({
    required this.nameCtrl, required this.birthWeightCtrl, required this.gestAgeCtrl,
    required this.dob, required this.sex, required this.feedingType, required this.zone,
    required this.onDobTap, required this.onSexChanged, required this.onFeedingChanged,
    required this.onZoneChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Child Information', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
        const SizedBox(height: 16),
        _field('Child full name *', nameCtrl),
        const SizedBox(height: 12),
        GestureDetector(
          onTap: onDobTap,
          child: AbsorbPointer(
            child: TextFormField(
              decoration: _inputDec('Date of birth *').copyWith(
                suffixIcon: const Icon(Icons.calendar_today, size: 18),
              ),
              controller: TextEditingController(
                text: dob == null ? '' : '${dob!.year}-${dob!.month.toString().padLeft(2, '0')}-${dob!.day.toString().padLeft(2, '0')}',
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: sex,
          decoration: _inputDec('Sex *'),
          items: const [
            DropdownMenuItem(value: 'M', child: Text('Male')),
            DropdownMenuItem(value: 'F', child: Text('Female')),
          ],
          onChanged: onSexChanged,
        ),
        const SizedBox(height: 12),
        _field('Birth weight (kg, optional)', birthWeightCtrl, keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        _field('Gestational age (weeks, optional)', gestAgeCtrl, keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          value: feedingType,
          decoration: _inputDec('Feeding type'),
          items: ['BREASTFED', 'FORMULA', 'MIXED', 'COMPLEMENTARY']
              .map((f) => DropdownMenuItem(value: f, child: Text(f.replaceAll('_', ' '))))
              .toList(),
          onChanged: onFeedingChanged,
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: zone,
          decoration: _inputDec('Zone / sector (optional)'),
          onChanged: onZoneChanged,
        ),
      ],
    );
  }
}

class _LinkAccountStep extends StatelessWidget {
  final TextEditingController emailCtrl;
  const _LinkAccountStep({required this.emailCtrl});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Link Parent Account', style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w700, color: colorInk)),
        const SizedBox(height: 8),
        Text(
          'Optionally enter the parent\'s email to create or link their account. They can register themselves later.',
          style: GoogleFonts.inter(fontSize: 13, color: colorMuted),
        ),
        const SizedBox(height: 16),
        _field('Parent email (optional)', emailCtrl, keyboardType: TextInputType.emailAddress),
      ],
    );
  }
}

// ── Success screen ────────────────────────────────────────────────────────────

class _SuccessScreen extends StatelessWidget {
  final Map<String, dynamic> child;
  const _SuccessScreen({required this.child});

  @override
  Widget build(BuildContext context) {
    final childId  = child['id'] as String? ?? '';
    final name     = child['full_name'] as String? ?? '';
    final regNum   = child['registration_number'] as String? ?? '';

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Registration Complete')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle, size: 64, color: colorSuccess),
              const SizedBox(height: 16),
              Text('Child Registered!', style: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: colorInk)),
              const SizedBox(height: 8),
              Text(name, style: GoogleFonts.inter(fontSize: 16, color: colorMuted)),
              Text(regNum, style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
              const SizedBox(height: 32),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: colorBgElev,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colorBorder),
                ),
                child: Column(
                  children: [
                    Text('QR Identity Card', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
                    const SizedBox(height: 16),
                    if (childId.isNotEmpty)
                      QrImageView(
                        data: childId,
                        version: QrVersions.auto,
                        size: 200,
                        backgroundColor: Colors.white,
                        eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF085041)),
                        dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Color(0xFF085041)),
                      ),
                    const SizedBox(height: 12),
                    Text(name, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600, color: colorInk)),
                    Text(regNum, style: GoogleFonts.inter(fontSize: 11, color: colorMuted)),
                    const SizedBox(height: 4),
                    Text('Scan to view health record', style: GoogleFonts.inter(fontSize: 10, color: colorMuted)),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                  style: ElevatedButton.styleFrom(backgroundColor: colorInk, padding: const EdgeInsets.symmetric(vertical: 14)),
                  child: Text('Done', style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: colorCream)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

Widget _field(String label, TextEditingController ctrl, {TextInputType? keyboardType}) =>
    TextFormField(controller: ctrl, keyboardType: keyboardType, decoration: _inputDec(label));

InputDecoration _inputDec(String label) => InputDecoration(
  labelText: label,
  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
);
