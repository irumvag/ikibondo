import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_theme.dart';
import '../../core/providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final ok = await ref.read(authProvider.notifier).login(
          _emailCtrl.text.trim(),
          _passCtrl.text,
        );
    if (!ok && mounted) {
      // Error shown via auth state — no need to push separately
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final topInset = MediaQuery.paddingOf(context).top;

    // Light status-bar icons over the dark brand band
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: colorInk,
        body: SingleChildScrollView(
          child: ConstrainedBox(
            constraints:
                BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
            // IntrinsicHeight lets the sheet fill the rest of the screen yet still scroll with the keyboard
            child: IntrinsicHeight(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Brand band ───────────────────────────────────────────────
                  Padding(
                    padding: EdgeInsets.fromLTRB(28, topInset + 48, 28, 40),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: const BoxDecoration(
                                  color: colorGold, shape: BoxShape.circle),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Ikibondo',
                              style: GoogleFonts.inter(
                                fontSize: 30,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                                color: colorCream,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Child growth and care, from the camp to the clinic.',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            height: 1.45,
                            color: colorCream.withValues(alpha: 0.85),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Sign-in sheet ────────────────────────────────────────────
                  Expanded(
                    child: Container(
                      padding: EdgeInsets.fromLTRB(24, 32, 24,
                          MediaQuery.paddingOf(context).bottom + 24),
                      decoration: const BoxDecoration(
                        color: colorCream,
                        borderRadius:
                            BorderRadius.vertical(top: Radius.circular(28)),
                      ),
                      child: AutofillGroup(
                        child: Form(
                          key: _formKey,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                'Sign in',
                                style: GoogleFonts.inter(
                                    fontSize: 24,
                                    fontWeight: FontWeight.w700,
                                    color: colorInk),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Use the email and password from your health centre.',
                                style: GoogleFonts.inter(
                                    fontSize: 14,
                                    color: colorMuted,
                                    height: 1.4),
                              ),
                              const SizedBox(height: 24),
                              if (auth.error != null) ...[
                                Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: colorHighBg,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color:
                                            colorDanger.withValues(alpha: 0.3)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.error_outline,
                                          color: colorDanger, size: 18),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          auth.error!,
                                          style: GoogleFonts.inter(
                                              fontSize: 13, color: colorDanger),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                              TextFormField(
                                controller: _emailCtrl,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autocorrect: false,
                                autofillHints: const [
                                  AutofillHints.username,
                                  AutofillHints.email
                                ],
                                decoration: const InputDecoration(
                                  labelText: 'Email address',
                                  prefixIcon: Icon(Icons.email_outlined),
                                ),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty)
                                    return 'Email is required';
                                  if (!v.contains('@'))
                                    return 'Enter a valid email';
                                  return null;
                                },
                              ),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: _passCtrl,
                                obscureText: _obscure,
                                textInputAction: TextInputAction.go,
                                autofillHints: const [AutofillHints.password],
                                onFieldSubmitted: (_) =>
                                    auth.isLoading ? null : _submit(),
                                decoration: InputDecoration(
                                  labelText: 'Password',
                                  prefixIcon: const Icon(Icons.lock_outline),
                                  suffixIcon: IconButton(
                                    tooltip: _obscure
                                        ? 'Show password'
                                        : 'Hide password',
                                    icon: Icon(_obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                ),
                                validator: (v) {
                                  if (v == null || v.isEmpty)
                                    return 'Password is required';
                                  return null;
                                },
                              ),
                              Align(
                                alignment: Alignment.centerRight,
                                child: TextButton(
                                  onPressed: auth.isLoading
                                      ? null
                                      : () => context.push('/forgot-password'),
                                  child: const Text('Forgot password?'),
                                ),
                              ),
                              const SizedBox(height: 8),
                              SizedBox(
                                height: 52,
                                child: ElevatedButton(
                                  onPressed: auth.isLoading ? null : _submit,
                                  child: auth.isLoading
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: colorCream),
                                        )
                                      : const Text('Sign in'),
                                ),
                              ),
                              const SizedBox(height: 28),
                              Text(
                                'For community health workers, nurses and parents. '
                                'Supervisors, administrators and partners use the website.',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: colorMuted,
                                    height: 1.5),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
