import 'dart:convert';

import 'package:http/http.dart' as http;

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://ip-intelligence-pi.vercel.app',
);

typedef JsonMap = Map<String, dynamic>;

bool isValidIp(String value) {
  final ip = value.trim();
  final ipv4 = RegExp(r'^(\d{1,3}\.){3}\d{1,3}$');
  if (ipv4.hasMatch(ip)) {
    return ip.split('.').every((part) => int.parse(part) <= 255);
  }
  return RegExp(r'^[0-9a-fA-F:]+$').hasMatch(ip) &&
      ip.contains(':') &&
      ip.length <= 45;
}

Future<JsonMap> _getJson(String path) async {
  final response = await http
      .get(Uri.parse('$apiBaseUrl$path'), headers: {'Accept': 'application/json'})
      .timeout(const Duration(seconds: 20));
  final body = jsonDecode(response.body) as JsonMap;
  if (response.statusCode < 200 || response.statusCode >= 300 || body['ok'] != true) {
    throw Exception(body['error']?.toString() ?? 'Request failed (HTTP ${response.statusCode})');
  }
  return (body['data'] as JsonMap?) ?? <String, dynamic>{};
}

class IpApi {
  static Future<JsonMap> myIp() => _getJson('/api/myip');

  static Future<JsonMap> lookup(String ip) =>
      _getJson('/api/lookup?ip=${Uri.encodeQueryComponent(ip)}');

  static Future<JsonMap> anonymity(String ip) =>
      _getJson('/api/anonymity?ip=${Uri.encodeQueryComponent(ip)}');

  static Future<JsonMap> dns(String name, String type) => _getJson(
        '/api/dns?name=${Uri.encodeQueryComponent(name)}&type=${Uri.encodeQueryComponent(type)}',
      );

  static Future<JsonMap> rdap(String ip) =>
      _getJson('/api/rdap?ip=${Uri.encodeQueryComponent(ip)}');

  static Future<JsonMap> asn(String asn) =>
      _getJson('/api/asn?asn=${Uri.encodeQueryComponent(asn)}');
}

String textValue(Object? value) {
  if (value == null || value.toString().isEmpty) return 'Not Available';
  if (value is bool) return value ? 'Yes' : 'No';
  return value.toString();
}

String boolLabel(Object? value) {
  if (value == null) return 'Unknown';
  return value == true ? 'Detected' : 'Not Detected';
}
