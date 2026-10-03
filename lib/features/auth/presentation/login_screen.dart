import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/api_auth_repository.dart';
import '../data/auth_repository.dart';
import 'auth_providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _idController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      await ref.read(authRepositoryProvider).login(_idController.text, _passwordController.text);
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Seshadripuram One')),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: AutofillGroup(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Sign in', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
              TextField(
                controller: _idController,
                textInputAction: TextInputAction.next,
                autofillHints: const [AutofillHints.username],
                decoration: const InputDecoration(labelText: 'College, student, or employee ID'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordController,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                onSubmitted: (_) => _loading ? null : _login(),
                decoration: const InputDecoration(labelText: 'Password'),
              ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
              const SizedBox(height: 20),
              FilledButton(onPressed: _loading ? null : _login, child: Text(_loading ? 'Signing in…' : 'Sign in')),
              TextButton(onPressed: _loading ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ActivationScreen())), child: const Text('Activate your college account')),
            ]),
          ),
        ),
      ),
    ),
  );
}

class ActivationScreen extends ConsumerStatefulWidget {
  const ActivationScreen({super.key});

  @override
  ConsumerState<ActivationScreen> createState() => _ActivationScreenState();
}

class _ActivationScreenState extends ConsumerState<ActivationScreen> {
  final _idController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  int _step = 0;
  bool _loading = false;
  String? _error;
  ActivationGrant? _grant;

  @override
  void dispose() {
    _idController.dispose();
    _otpController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    setState(() { _loading = true; _error = null; });
    final repository = ref.read(authRepositoryProvider);
    try {
      if (_step == 0) {
        await repository.requestActivation(_idController.text);
        if (mounted) setState(() => _step = 1);
      } else if (_step == 1) {
        final grant = await repository.verifyOtp(_idController.text, _otpController.text);
        if (mounted) setState(() { _grant = grant; _step = 2; });
      } else {
        await repository.setPassword(institutionId: _idController.text, activationGrant: _grant!.value, password: _passwordController.text);
        if (mounted) Navigator.of(context).pop();
      }
    } on AuthException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final labels = ['Verify your college ID', 'Enter the OTP', 'Set a password'];
    return Scaffold(
      appBar: AppBar(title: const Text('Activate account')),
      body: Center(child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: AutofillGroup(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(labels[_step], style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 16),
              if (_step == 0)
                TextField(
                  controller: _idController,
                  autofillHints: const [AutofillHints.username],
                  decoration: const InputDecoration(labelText: 'College, student, or employee ID'),
                ),
              if (_step == 1)
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  decoration: const InputDecoration(labelText: 'Six-digit OTP'),
                ),
              if (_step == 2)
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(labelText: 'Password (at least 12 characters)'),
                ),
              if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
              const SizedBox(height: 20),
              FilledButton(onPressed: _loading ? null : _continue, child: Text(_loading ? 'Please wait…' : _step == 2 ? 'Activate account' : 'Continue')),
            ]),
          ),
        ),
      )),
    );
  }
}
