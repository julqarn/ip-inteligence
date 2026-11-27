# IP Intelligence — Flutter Mobile App

The Flutter mobile app for IP Intelligence, published alongside the website in this repository under `mobile/`.

## Features

- Automatic public IP detection
- IPv4 and IPv6 lookup
- Geolocation, ISP, ASN, hostname, reverse DNS, and network range
- VPN, proxy, Tor, hosting, residential, mobile, and corporate indicators with confidence states
- DNS, RDAP, and ASN diagnostics
- On-device lookup history
- Copy IP and open approximate location in OpenStreetMap

The app uses the production IP Intelligence API at `https://ip-intelligence-pi.vercel.app`. Override it with `--dart-define=API_BASE_URL=https://your-api.example.com`.

## Run

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

## Store release

Android package and iOS bundle ID: `com.julqarn.ipintelligence`

```bash
flutter build appbundle --release
flutter build ipa --release
```

Publish the privacy policy at a public HTTPS URL before store submission. Store listing notes: IP geolocation is approximate, VPN/proxy results are confidence-labelled indicators, lookup history stays on the device, and entered IP/DNS queries are sent to the IP Intelligence API.
