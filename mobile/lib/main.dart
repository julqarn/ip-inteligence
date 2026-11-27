import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';

void main() {
  runApp(const IpIntelligenceApp());
}

class IpIntelligenceApp extends StatelessWidget {
  const IpIntelligenceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IP Intelligence',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        scaffoldBackgroundColor: const Color(0xFF050A12),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF22D3EE),
          secondary: Color(0xFF34F5A2),
          surface: Color(0xFF0B1626),
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF0B1626),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: Color(0xFF16324F)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF0B1626),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _tab = 0;
  final _query = TextEditingController();
  final _vpnQuery = TextEditingController();
  final _dnsName = TextEditingController(text: 'example.com');
  String _dnsType = 'A';

  JsonMap? _intel;
  JsonMap? _report;
  JsonMap? _dns;
  JsonMap? _rdap;
  JsonMap? _asn;
  List<JsonMap> _history = [];
  bool _loading = false;
  bool _vpnLoading = false;
  bool _toolLoading = false;
  String? _error;
  String? _vpnError;
  String? _toolError;

  @override
  void initState() {
    super.initState();
    _loadHistory();
    _lookup('');
  }

  @override
  void dispose() {
    _query.dispose();
    _vpnQuery.dispose();
    _dnsName.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('history');
    if (raw == null) return;
    final decoded = jsonDecode(raw) as List<dynamic>;
    setState(() => _history = decoded.cast<JsonMap>());
  }

  Future<void> _saveHistory(JsonMap intel) async {
    final next = <JsonMap>[
      {
        'ip': intel['ip'],
        'at': DateTime.now().toIso8601String(),
        'country': intel['country'],
        'isp': intel['isp'],
      },
      ..._history.where((item) => item['ip'] != intel['ip']),
    ].take(30).toList();
    setState(() => _history = next);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('history', jsonEncode(next));
  }

  Future<void> _lookup(String ip) async {
    final target = ip.trim();
    if (target.isNotEmpty && !isValidIp(target)) {
      setState(() => _error = 'Please enter a valid IPv4 or IPv6 address.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = target.isEmpty ? await IpApi.myIp() : await IpApi.lookup(target);
      setState(() {
        _intel = data;
        _query.text = data['ip'].toString();
        _vpnQuery.text = data['ip'].toString();
      });
      await _saveHistory(data);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _analyzeVpn() async {
    final target = _vpnQuery.text.trim();
    if (!isValidIp(target)) {
      setState(() => _vpnError = 'Enter a valid public IP address to analyze.');
      return;
    }
    setState(() {
      _vpnLoading = true;
      _vpnError = null;
    });
    try {
      final data = await IpApi.anonymity(target);
      setState(() => _report = data);
    } catch (e) {
      setState(() => _vpnError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _vpnLoading = false);
    }
  }

  Future<void> _runTool(String kind) async {
    setState(() {
      _toolLoading = true;
      _toolError = null;
    });
    try {
      if (kind == 'dns') {
        final data = await IpApi.dns(_dnsName.text.trim(), _dnsType);
        setState(() => _dns = data);
      } else if (kind == 'rdap') {
        final target = (_intel?['ip'] ?? _query.text).toString().trim();
        if (!isValidIp(target)) throw Exception('Enter a valid IP on the Lookup tab first.');
        final data = await IpApi.rdap(target);
        setState(() => _rdap = data);
      } else if (kind == 'asn') {
        final asn = (_intel?['asn'] ?? '').toString().trim().toUpperCase();
        if (asn.isEmpty) throw Exception('No ASN is available for the current IP yet.');
        final data = await IpApi.asn(asn.startsWith('AS') ? asn : 'AS$asn');
        setState(() => _asn = data);
      }
    } catch (e) {
      setState(() => _toolError = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _toolLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [_lookupPage(), _vpnPage(), _toolsPage(), _historyPage(), _aboutPage()];
    return Scaffold(
      appBar: AppBar(
        title: const Text('IP Intelligence'),
        backgroundColor: const Color(0xFF050A12),
      ),
      body: pages[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.search), label: 'Lookup'),
          NavigationDestination(icon: Icon(Icons.shield_outlined), label: 'VPN'),
          NavigationDestination(icon: Icon(Icons.build_outlined), label: 'Tools'),
          NavigationDestination(icon: Icon(Icons.history), label: 'History'),
          NavigationDestination(icon: Icon(Icons.info_outline), label: 'About'),
        ],
      ),
    );
  }

  Widget _lookupPage() {
    final intel = _intel;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _query,
          decoration: const InputDecoration(labelText: 'IPv4 or IPv6 address'),
          autocorrect: false,
          onSubmitted: _lookup,
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: _loading ? null : () => _lookup(_query.text),
                child: const Text('Search'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton(
                onPressed: _loading ? null : () => _lookup(''),
                child: const Text('My IP'),
              ),
            ),
          ],
        ),
        if (_loading) const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
        if (_error != null) _errorBox(_error!),
        if (intel != null) ...[
          _card('Public IP', [
            Text(intel['ip'].toString(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
            Wrap(spacing: 8, children: [
              Chip(label: Text('IPv${intel['version']}')),
              Chip(label: Text(textValue(intel['ipType']))),
              Chip(label: Text(intel['isPublic'] == true ? 'Public' : 'Non-public')),
            ]),
            if (intel['classificationNote'] != null) Text(textValue(intel['classificationNote'])),
            Wrap(spacing: 8, children: [
              OutlinedButton(
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: intel['ip'].toString()));
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('IP copied')));
                  }
                },
                child: const Text('Copy IP'),
              ),
              if (intel['latitude'] != null && intel['longitude'] != null)
                OutlinedButton(
                  onPressed: () => launchUrl(
                    Uri.parse('https://www.openstreetmap.org/?mlat=${intel['latitude']}&mlon=${intel['longitude']}#map=10/${intel['latitude']}/${intel['longitude']}'),
                    mode: LaunchMode.externalApplication,
                  ),
                  child: const Text('Map'),
                ),
            ]),
          ]),
          _card('Geolocation', [
            _row('Country', '${textValue(intel['country'])} (${textValue(intel['countryCode'])})'),
            _row('Region', textValue(intel['region'])),
            _row('City', textValue(intel['city'])),
            _row('Postal code', textValue(intel['postal'])),
            _row('Continent', textValue(intel['continent'])),
            _row('Coordinates', intel['latitude'] == null ? 'Not Available' : '${intel['latitude']}, ${intel['longitude']}'),
            _row('Timezone', '${textValue(intel['timezone'])} (${textValue(intel['utcOffset'])})'),
            const Text('IP geolocation is approximate and never shows an exact address or live location.'),
          ]),
          _card('Network', [
            _row('ISP', textValue(intel['isp'])),
            _row('Organization', textValue(intel['org'])),
            _row('ASN', textValue(intel['asn'])),
            _row('ASN organization', textValue(intel['asnOrg'])),
            _row('Hostname', textValue(intel['hostname'])),
            _row('Reverse DNS', textValue(intel['reverseDns'])),
            _row('Network range', textValue(intel['networkRange'])),
            _row('Connection type', textValue(intel['connectionType'])),
          ]),
          _card('Security indicators', [
            Wrap(spacing: 8, children: [
              Chip(label: Text('VPN: ${boolLabel(intel['vpn'])}')),
              Chip(label: Text('Proxy: ${boolLabel(intel['proxy'])}')),
              Chip(label: Text('Tor: ${boolLabel(intel['tor'])}')),
              Chip(label: Text('Hosting: ${boolLabel(intel['hosting'])}')),
              Chip(label: Text('Mobile: ${boolLabel(intel['mobile'])}')),
            ]),
            _row('Abuse score', textValue(intel['abuseScore'])),
            _row('Threat summary', textValue(intel['threatSummary'])),
            _row('Provider', textValue(intel['provider'])),
          ]),
        ],
      ],
    );
  }

  Widget _vpnPage() {
    final report = _report;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _card('VPN, Proxy & Anonymity Detector', [
          TextField(
            controller: _vpnQuery,
            decoration: const InputDecoration(labelText: 'Public IP to analyze'),
            autocorrect: false,
            onSubmitted: (_) => _analyzeVpn(),
          ),
          FilledButton(onPressed: _vpnLoading ? null : _analyzeVpn, child: const Text('Analyze IP')),
          if (_vpnLoading) const Center(child: CircularProgressIndicator()),
          if (_vpnError != null) _errorBox(_vpnError!),
        ]),
        if (report != null) ...[
          _card('Classification', [
            _row('IP', textValue(report['ip'])),
            _row('Network type', textValue(report['networkType'])),
            _row('Country', textValue(report['country'])),
            _row('ISP / ASN', '${textValue(report['isp'])} · ${textValue(report['asn'])}'),
            _row('Classification confidence', textValue(report['classificationConfidence'])),
            _row('Reputation risk', textValue(report['reputationRisk'])),
          ]),
          for (final key in ['vpn', 'proxy', 'tor', 'hosting', 'datacenter', 'residential', 'mobile', 'corporate'])
            if (report[key] is JsonMap) _detectionCard(report[key] as JsonMap),
          const Text('A VPN is not inherently malicious, and a residential IP is not automatically trustworthy.'),
        ],
      ],
    );
  }

  Widget _toolsPage() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _card('DNS lookup', [
          TextField(controller: _dnsName, decoration: const InputDecoration(labelText: 'Domain'), autocorrect: false),
          Wrap(
            spacing: 8,
            children: [
              for (final type in ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'])
                ChoiceChip(
                  label: Text(type),
                  selected: _dnsType == type,
                  onSelected: (_) => setState(() => _dnsType = type),
                ),
            ],
          ),
          FilledButton(onPressed: _toolLoading ? null : () => _runTool('dns'), child: const Text('Run DNS lookup')),
          if (_dns != null) ...[
            _row('Status', textValue(_dns!['status'])),
            _row('Latency', '${textValue(_dns!['latencyMs'])} ms'),
            for (final record in ((_dns!['records'] as List?) ?? []))
              Text('${(record as JsonMap)['type']} · TTL ${(record)['ttl']} · ${(record)['data']}'),
          ],
        ]),
        _card('RDAP registration', [
          FilledButton(onPressed: _toolLoading ? null : () => _runTool('rdap'), child: const Text('Check current IP')),
          if (_rdap != null) ...[
            _row('Name', textValue(_rdap!['name'])),
            _row('Range', '${textValue(_rdap!['startAddress'])} – ${textValue(_rdap!['endAddress'])}'),
            _row('CIDR', ((_rdap!['cidrs'] as List?) ?? []).join(', ')),
            _row('Registry', textValue(_rdap!['registry'])),
            _row('Source', textValue(_rdap!['source'])),
          ],
        ]),
        _card('ASN lookup', [
          FilledButton(onPressed: _toolLoading ? null : () => _runTool('asn'), child: const Text('Check current ASN')),
          if (_asn != null) ...[
            _row('ASN', textValue(_asn!['asn'])),
            _row('Name', textValue(_asn!['name'])),
            _row('Organizations', (((_asn!['organizations'] as List?) ?? []).map((o) => (o as JsonMap)['name']).whereType<String>()).join(', ')),
            _row('Source', textValue(_asn!['source'])),
          ],
        ]),
        if (_toolLoading) const Center(child: CircularProgressIndicator()),
        if (_toolError != null) _errorBox(_toolError!),
      ],
    );
  }

  Widget _historyPage() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _card('Lookup history', [
          if (_history.isEmpty) const Text('No lookups yet.'),
          for (final item in _history)
            ListTile(
              title: Text(textValue(item['ip'])),
              subtitle: Text('${textValue(item['country'])} · ${textValue(item['isp'])}'),
              onTap: () {
                setState(() => _tab = 0);
                _lookup(item['ip'].toString());
              },
            ),
          if (_history.isNotEmpty)
            OutlinedButton(
              onPressed: () async {
                setState(() => _history = []);
                final prefs = await SharedPreferences.getInstance();
                await prefs.remove('history');
              },
              child: const Text('Clear history'),
            ),
        ]),
      ],
    );
  }

  Widget _aboutPage() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _card('About IP Intelligence', [
          const Text(
            'IP Intelligence shows public-IP geolocation, ISP and ASN details, RDAP registration, DNS diagnostics, and VPN/proxy/Tor indicators from real providers. Unavailable fields stay “Not Available” instead of being invented.',
          ),
          _row('Version', '1.0.0'),
          _row('Website', 'ip-intelligence-pi.vercel.app'),
          _row('Privacy', 'Lookups are sent to the IP Intelligence API. History stays on this device.'),
          FilledButton(
            onPressed: () => launchUrl(Uri.parse('https://ip-intelligence-pi.vercel.app'), mode: LaunchMode.externalApplication),
            child: const Text('Open website'),
          ),
        ]),
      ],
    );
  }

  Widget _detectionCard(JsonMap detection) {
    final sources = ((detection['sources'] as List?) ?? []).join(', ');
    return _card(textValue(detection['label']), [
      Wrap(spacing: 8, children: [
        Chip(label: Text(textValue(detection['status']))),
        Chip(label: Text('Confidence: ${textValue(detection['confidence'])}')),
      ]),
      Text(textValue(detection['explanation'])),
      if (sources.isNotEmpty) Text('Sources: $sources'),
    ]);
  }

  Widget _card(String title, List<Widget> children) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            ...children.expand((child) => [child, const SizedBox(height: 8)]),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF94A3B8)))),
        Expanded(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
      ],
    );
  }

  Widget _errorBox(String message) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF2A0F1C), borderRadius: BorderRadius.circular(12)),
      child: Text(message, style: const TextStyle(color: Color(0xFFFDA4AF))),
    );
  }
}
