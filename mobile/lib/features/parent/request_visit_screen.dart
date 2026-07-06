import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';
import 'dashboard_screen.dart';

const _symptoms = ['fever', 'diarrhea', 'cough', 'vomiting', 'skin_lesions', 'breathing_difficulty', 'other'];

class RequestVisitScreen extends ConsumerStatefulWidget {
  const RequestVisitScreen({super.key});

  @override
  ConsumerState<RequestVisitScreen> createState() => _RequestVisitScreenState();
}

class _RequestVisitScreenState extends ConsumerState<RequestVisitScreen> {
  String? _selectedChildId;
  String _urgency = 'ROUTINE';
  final Set<String> _selectedSymptoms = {};
  final _concernCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _success;

  @override
  void dispose() { _concernCtrl.dispose(); super.dispose(); }

  Future<void> _submit() async {
    if (_selectedChildId == null) {
      setState(() => _error = 'Please select a child');
      return;
    }
    setState(() { _submitting = true; _error = null; _success = null; });
    try {
      await ApiClient.dio.post(Endpoints.visitRequests, data: {
        'child':         _selectedChildId,
        'urgency':       _urgency,
        'symptom_flags': _selectedSymptoms.toList(),
        'concern_text':  _concernCtrl.text.trim(),
      });
      setState(() { _success = 'Visit request submitted! Your CHW will contact you.'; });
      _concernCtrl.clear();
      _selectedSymptoms.clear();
    } catch (e) {
      setState(() => _error = 'Failed to submit request. Please try again.');
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final childrenAsync = ref.watch(parentChildrenProvider);

    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Request Home Visit')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Success
          if (_success != null)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: colorLowBg, borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colorSuccess.withOpacity(0.3))),
              child: Row(children: [
                const Icon(Icons.check_circle, color: colorSuccess),
                const SizedBox(width: 10),
                Expanded(child: Text(_success!, style: GoogleFonts.inter(fontSize: 13, color: colorSuccess))),
              ]),
            ),

          // Error
          if (_error != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: colorHighBg, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: GoogleFonts.inter(fontSize: 13, color: colorDanger)),
            ),

          const SizedBox(height: 16),

          // Child selector
          Text('Select child', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
          const SizedBox(height: 8),
          childrenAsync.when(
            loading: () => const CircularProgressIndicator(),
            error: (_, __) => const SizedBox.shrink(),
            data: (children) => DropdownButtonFormField<String>(
              value: _selectedChildId,
              hint: Text('Choose a child', style: GoogleFonts.inter(color: colorMuted)),
              items: children.map((c) => DropdownMenuItem(value: c.id, child: Text(c.fullName))).toList(),
              onChanged: (v) => setState(() => _selectedChildId = v),
              decoration: const InputDecoration(),
            ),
          ),

          const SizedBox(height: 20),

          // Urgency
          Text('Urgency', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 10,
            children: ['ROUTINE', 'SOON', 'URGENT'].map((u) {
              final selected = _urgency == u;
              final color = u == 'URGENT' ? colorDanger : u == 'SOON' ? colorWarn : colorSuccess;
              return ChoiceChip(
                label: Text(u, style: GoogleFonts.inter(color: selected ? Colors.white : color, fontWeight: FontWeight.w600)),
                selected: selected,
                selectedColor: color,
                onSelected: (_) => setState(() => _urgency = u),
              );
            }).toList(),
          ),

          const SizedBox(height: 20),

          // Symptoms
          Text('Symptoms observed', style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600, color: colorInk)),
          const SizedBox(height: 8),
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

          const SizedBox(height: 20),

          TextFormField(
            controller: _concernCtrl,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Describe your concern',
              hintText: 'Any additional details about your child\'s condition...',
            ),
          ),

          const SizedBox(height: 28),

          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: colorCream))
                  : const Icon(Icons.send),
              label: Text(_submitting ? 'Submitting…' : 'Request visit'),
            ),
          ),
        ],
      ),
    );
  }
}
