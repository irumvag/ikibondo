import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_errors.dart';
import '../../core/api/endpoints.dart';
import '../../core/theme/app_theme.dart';

/// Two steps against /auth/password-reset/request|confirm/: get a 6-digit code
/// by SMS or email, then set a new password with it.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _idCtrl   = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _newCtrl  = TextEditingController();
  final _confCtrl = TextEditingController();
  bool _codeSent  = false;
  bool _loading   = false;
  String? _error;

  @override
  void dispose() {
    _idCtrl.dispose();
    _codeCtrl.dispose();
    _newCtrl.dispose();
    _confCtrl.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() { _loading = true; _error = null; });
    try {
      await action();
    } on _InputError catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = serverMessage(e, 'Something went wrong. Try again.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sendCode() => _run(() async {
        if (_idCtrl.text.trim().isEmpty) {
          throw _InputError('Enter the email or phone number you sign in with.');
        }
        await ApiClient.dio.post(Endpoints.passwordResetRequest, data: {'identifier': _idCtrl.text.trim()});
        setState(() => _codeSent = true);
      });

  Future<void> _confirm() => _run(() async {
        if (_codeCtrl.text.trim().length != 6) throw _InputError('Enter the 6-digit code.');
        if (_newCtrl.text.length < 8) throw _InputError('Use at least 8 characters.');
        if (_newCtrl.text != _confCtrl.text) throw _InputError('The two passwords do not match.');
        await ApiClient.dio.post(Endpoints.passwordResetConfirm, data: {
          'identifier':   _idCtrl.text.trim(),
          'code':         _codeCtrl.text.trim(),
          'new_password': _newCtrl.text,
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password updated. Sign in with the new one.')),
        );
        context.go('/login');
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: colorCream,
      appBar: AppBar(title: const Text('Reset password')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            _codeSent
                ? 'If an account matches, a 6-digit code is on its way by SMS or email. It expires in 10 minutes.'
                : 'We will send a 6-digit code to the phone or email on your account.',
            style: GoogleFonts.inter(fontSize: 14, color: colorMuted),
          ),
          const SizedBox(height: 20),
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: colorHighBg, borderRadius: BorderRadius.circular(10)),
              child: Text(_error!, style: GoogleFonts.inter(color: colorDanger, fontSize: 13)),
            ),
            const SizedBox(height: 16),
          ],
          TextField(
            controller: _idCtrl,
            enabled: !_codeSent,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email or phone number'),
          ),
          if (_codeSent) ...[
            const SizedBox(height: 16),
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              autofillHints: const [AutofillHints.oneTimeCode],
              decoration: const InputDecoration(labelText: 'Code', counterText: ''),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _newCtrl,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(
                labelText: 'New password',
                helperText: 'At least 8 characters. Avoid common words and your name.',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _confCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm new password'),
            ),
          ],
          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : (_codeSent ? _confirm : _sendCode),
              child: _loading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: colorCream))
                  : Text(_codeSent ? 'Set new password' : 'Send code'),
            ),
          ),
          if (_codeSent)
            TextButton(
              onPressed: _loading ? null : () => setState(() { _codeSent = false; _codeCtrl.clear(); }),
              child: const Text('Send a new code'),
            ),
        ],
      ),
    );
  }
}

class _InputError implements Exception {
  _InputError(this.message);
  final String message;
}
