import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/models/child.dart';
import '../../core/providers/sync_provider.dart';
import '../../core/theme/app_theme.dart';

const _symptoms = [
  'fever', 'diarrhea', 'cough', 'vomiting',
  'skin_lesions', 'breathing_difficulty', 'oedema', 'other'
];

class LogVisitScreen extends ConsumerStatefulWidget {
  final String? preselectedChildId;
  const LogVisitScreen({super.key, this.preselectedChildId});

  @override
  ConsumerState<LogVisitScreen> createState() => _LogVisitScreenState();
}

class _LogVisitScreenState extends ConsumerState<LogVisitScreen> {
  final _formKey     = GlobalKey<FormState>();
  Child? _child;

  // Measurement controllers
  final _weightCtrl = TextEditingController();
  final _heightCtrl = TextEditingController();
  final _muacCtrl   = TextEditingController();
  final _tempCtrl   = TextEditingController();
  final _notesCtrl  = TextEditingController();
  bool _oedema      = false;
  final Set<String> _selectedSymptoms = {};
  bool _submitting  = false;

  @override
  void initState() {
    super.initState();
    if (widget.preselectedChildId != null) _loadChild(widget.preselectedChildId!);
  }

  @override
  void dispose() {
    _weightCtrl.dispose(); _heightCtrl.dispose();
    _muacCtrl.dispose();   _tempCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadChild(String id) async {
    try {
      final resp = await ApiClient.dio.get(Endpoints.child(id));
      final data = resp.data['data'] ?? resp.data;
      setState(() => _child = Child.fromJson(data as Map<String, dynamic>));
    } catch (_) {}
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() || _child == null) return;
    setState(() => _submitting = true);

    final payload = {
      'child':              _child!.id,
      'measurement_date':   DateFormat('yyyy-MM-dd').format(DateTime.now()),
      if (_weightCtrl.text.isNotEmpty) 'weight_kg':   double.tryParse(_weightCtrl.text),
      if (_heightCtrl.text.isNotEmpty) 'height_cm':   double.tryParse(_heightCtrl.text),
      if (_muacCtrl.text.isNotEmpty)   'muac_cm':     double.tryParse(_muacCtrl.text),
      if (_tempCtrl.text.isNotEmpty)   'temperature_c': double.tryParse(_tempCtrl.text),
      'oedema':             _oedema,
      'symptom_flags':      _selectedSymptoms.toList(),
      if (_notesCtrl.text.isNotEmpty) 'notes': _notesCtrl.text.trim(),
    };

    final isOnline = ref.read(isOnlineProvider);

    if (isOnline) {
      try {
        final resp = await ApiClient.dio.post(Endpoints.healthRecords, data: payload);
        final data = resp.data['data'] ?? resp.data;
        final risk = data['risk_level'] as String? ?? 'UNKNOWN';
        if (mounted) {
          _showResult(context, risk, data['nutrition_status_display'] as String? ?? '');
        }
      } catch (e) {
        _saveOffline(payload);
      }
    } else {
      _saveOffline(payload);
    }

    setState(() => _submitting = false);
  }

  Future<void> _saveOffline(Map<String, dynamic> payload) async {
    await ref.read(syncProvider.notifier).enqueue(
      opType:    'create_visit',
      payload:   payload,
      childName: _child?.fullName,
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved offline — will sync when connected',
              style: GoogleFonts.inter()),
          backgroundColor: colorSuccess,
        ),
      );
      context.go('/chw');
    }
  }

  void _showResult(BuildContext ctx, String risk, String status) {
    showDialog(
      context: ctx,
      builder: (_) => AlertDialog(
        title: Text('Visit recorded', style: GoogleFonts.inter(fontWeight: FontWeight.w700, color: colorInk)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: colorSuccess, size: 48),
            const SizedBox(height: 12),
            Text('ML Assessment', style: GoogleFonts.inter(fontSize: 13, color: colorMuted)),
            const SizedBox(height: 4),
            Text(status.isNotEmpty ? status : risk,
                style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700,
                    color: risk == 'HIGH' ? colorDanger : risk == 'MEDIUM' ? colorWarn : colorSuccess)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () { Navigator.pop(context); context.go('/chw'); },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Log Visit')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Child selector ────────────────────────────────────────────
            if (_child != null)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colorBgElev,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colorBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(color: colorBgSand, borderRadius: BorderRadius.circular(10)),
                      child: Center(child: Text(_child!.fullName[0], style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: colorInk))),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_child!.fullName, style: GoogleFonts.inter(fontWeight: FontWeight.w600, color: colorInk)),
                        Text(_child!.ageDisplay ?? '', style: GoogleFonts.inter(fontSize: 12, color: colorMuted)),
                      ],
                    )),
                  ],
                ),
              )
            else
              OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.search),
                label: const Text('Select child'),
              ),

            const SizedBox(height: 20),

            Text('Measurements', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: colorInk)),
            const SizedBox(height: 12),

            Row(children: [
              Expanded(child: _NumField(ctrl: _weightCtrl, label: 'Weight (kg)', hint: 'e.g. 8.5',
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    final n = double.tryParse(v);
                    if (n == null || n < 1 || n > 30) return '1–30 kg';
                    return null;
                  })),
              const SizedBox(width: 12),
              Expanded(child: _NumField(ctrl: _heightCtrl, label: 'Height (cm)', hint: 'e.g. 75',
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    final n = double.tryParse(v);
                    if (n == null || n < 40 || n > 130) return '40–130 cm';
                    return null;
                  })),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _NumField(ctrl: _muacCtrl, label: 'MUAC (cm)', hint: 'e.g. 12.5',
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    final n = double.tryParse(v);
                    if (n == null || n < 5 || n > 25) return '5–25 cm';
                    return null;
                  })),
              const SizedBox(width: 12),
              Expanded(child: _NumField(ctrl: _tempCtrl, label: 'Temperature (°C)', hint: 'e.g. 37.2')),
            ]),

            const SizedBox(height: 16),

            // Oedema toggle
            SwitchListTile(
              value: _oedema,
              onChanged: (v) => setState(() => _oedema = v),
              title: Text('Bilateral oedema present', style: GoogleFonts.inter(fontSize: 14, color: colorInk)),
              activeColor: colorDanger,
              contentPadding: EdgeInsets.zero,
            ),

            const SizedBox(height: 16),

            Text('Symptom flags', style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: colorInk)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8, runSpacing: 8,
              children: _symptoms.map((s) {
                final selected = _selectedSymptoms.contains(s);
                return FilterChip(
                  label: Text(s.replaceAll('_', ' '), style: GoogleFonts.inter(fontSize: 12)),
                  selected: selected,
                  onSelected: (v) => setState(() => v ? _selectedSymptoms.add(s) : _selectedSymptoms.remove(s)),
                  selectedColor: colorHighBg,
                  checkmarkColor: colorDanger,
                );
              }).toList(),
            ),

            const SizedBox(height: 16),

            TextFormField(
              controller: _notesCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Clinical notes (optional)'),
            ),

            const SizedBox(height: 28),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: (_submitting || _child == null) ? null : _submit,
                icon: _submitting
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: colorCream))
                    : const Icon(Icons.save),
                label: Text(_submitting ? 'Saving…' : 'Save visit'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NumField extends StatelessWidget {
  final TextEditingController ctrl;
  final String label;
  final String hint;
  final String? Function(String?)? validator;

  const _NumField({required this.ctrl, required this.label, required this.hint, this.validator});

  @override
  Widget build(BuildContext context) => TextFormField(
    controller: ctrl,
    keyboardType: const TextInputType.numberWithOptions(decimal: true),
    decoration: InputDecoration(labelText: label, hintText: hint),
    validator: validator,
  );
}
