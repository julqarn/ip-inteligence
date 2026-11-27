import 'package:flutter_test/flutter_test.dart';
import 'package:ip_intelligence/api.dart';

void main() {
  test('validates IPv4 and IPv6 addresses', () {
    expect(isValidIp('8.8.8.8'), isTrue);
    expect(isValidIp('999.1.1.1'), isFalse);
    expect(isValidIp('2606:4700:4700::1111'), isTrue);
    expect(isValidIp('not-an-ip'), isFalse);
  });
}
