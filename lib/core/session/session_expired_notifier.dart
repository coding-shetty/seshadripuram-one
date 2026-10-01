import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SessionExpiredNotifier {
  final _controller = StreamController<void>.broadcast();
  Stream<void> get onExpired => _controller.stream;

  void notifyExpired() {
    if (!_controller.isClosed) {
      _controller.add(null);
    }
  }

  void dispose() {
    _controller.close();
  }
}

final sessionExpiredNotifierProvider = Provider<SessionExpiredNotifier>((ref) {
  final notifier = SessionExpiredNotifier();
  ref.onDispose(notifier.dispose);
  return notifier;
});
