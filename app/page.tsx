"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Database,
  Fingerprint,
  Globe2,
  History,
  Info,
  Loader2,
  MapPin,
  Moon,
  Network,
  Radar,
  RefreshCw,
  Search,
  Server,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { classifyIp, flagEmoji, validationError } from "@/lib/ip";
import type { IpIntel } from "@/lib/providers";
import { detectConnectivity, type ConnectivityResult } from "@/lib/browserTests";
import CompareIps from "@/components/CompareIps";
import PrivacyTests from "@/components/PrivacyTests";
import FingerprintLab from "@/components/FingerprintLab";
import Logo from "@/components/Logo";
import VpnProxyDetector from "@/components/VpnProxyDetector";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = "home" | "compare" | "privacy" | "vpn" | "fingerprint" | "tools" | "history" | "about";

interface HistoryEntry {
  ip: string;
  at: string;
  country: string | null;
  city: string | null;
  isp: string | null;
}

const HISTORY_KEY = "ip-intelligence-history";
const NA = "Not Available";

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return NA;
  return String(v);
}
function boolVal(v: boolean | null): string {
  if (v === null) return NA;
  return v ? "Yes" : "No";
}

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return json.data as T;
}

export default function HomePage() {
  const [view, setView] = useState<View>("home");
  const [dark, setDark] = useState(true);
  const [query, setQuery] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<IpIntel | null>(null);
  const [myIp, setMyIp] = useState<IpIntel | null>(null);
  const [myIpError, setMyIpError] = useState<string | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rdap, setRdap] = useState<any>(null);
  const [ptr, setPtr] = useState<any>(null);
  const [asnInfo, setAsnInfo] = useState<any>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [reach, setReach] = useState<string | null>(null);
  const [webrtc, setWebrtc] = useState<string[] | null>(null);
  const [webrtcRunning, setWebrtcRunning] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const saveHistory = useCallback((intel: IpIntel) => {
    setHistory((prev) => {
      const next = [
        {
          ip: intel.ip,
          at: new Date().toISOString(),
          country: intel.country,
          city: intel.city,
          isp: intel.isp,
        },
        ...prev.filter((h) => h.ip !== intel.ip),
      ].slice(0, 30);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const runDiagnostics = useCallback(async (intel: IpIntel) => {
    setRdap(null);
    setPtr(null);
    setAsnInfo(null);
    setReach(null);
    setDiagError(null);
    if (!intel.isPublic) return;
    try {
      const [rdapData, ptrData] = await Promise.all([
        api<any>(`/api/rdap?ip=${encodeURIComponent(intel.ip)}`),
        api<any>(`/api/dns?name=${encodeURIComponent(intel.ip)}&type=PTR`),
      ]);
      setRdap(rdapData);
      setPtr(ptrData);
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "Diagnostics failed");
    }
  }, []);

  const lookup = useCallback(
    async (rawIp: string, pushHistory = true) => {
      const ip = rawIp.trim();
      const err = validationError(ip);
      if (err) {
        setInputError(err);
        return;
      }
      setInputError(null);
      setLoadError(null);
      setLoading(true);
      setView("home");
      try {
        const intel = await api<IpIntel>(`/api/lookup?ip=${encodeURIComponent(ip)}`);
        setResult(intel);
        if (pushHistory) saveHistory(intel);
        runDiagnostics(intel);
        const url = new URL(window.location.href);
        url.searchParams.set("ip", intel.ip);
        window.history.replaceState(null, "", url.toString());
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Lookup failed");
      } finally {
        setLoading(false);
      }
    },
    [runDiagnostics, saveHistory]
  );

  // Initial load: history, theme, shared ?ip=, and automatic My IP detection.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {}

    const shared = new URLSearchParams(window.location.search).get("ip");
    detectConnectivity().then(setConnectivity).catch(() => {});
    (async () => {
      try {
        const mine = await api<IpIntel>("/api/myip");
        setMyIp(mine);
        if (!shared) {
          setResult(mine);
          runDiagnostics(mine);
        }
      } catch (e) {
        setMyIpError(e instanceof Error ? e.message : "Could not detect your IP");
      }
      if (shared) lookup(shared);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  const refreshMyIp = async () => {
    setRefreshing(true);
    setMyIpError(null);
    try {
      const [mine, conn] = await Promise.all([api<IpIntel>("/api/myip"), detectConnectivity()]);
      setMyIp(mine);
      setConnectivity(conn);
      setResult(mine);
      runDiagnostics(mine);
      showToast("Your IP detection refreshed");
    } catch (e) {
      setMyIpError(e instanceof Error ? e.message : "Could not detect your IP");
    } finally {
      setRefreshing(false);
    }
  };

  const copyText = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(msg);
    } catch {
      showToast("Copy failed — your browser blocked clipboard access");
    }
  };

  const shareResult = async () => {
    if (!result) return;
    const url = new URL(window.location.href);
    url.searchParams.set("ip", result.ip);
    const link = url.toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: `IP Intelligence: ${result.ip}`, url: link });
        return;
      } catch {}
    }
    copyText(link, "Shareable link copied");
  };

  const runReachability = async () => {
    if (!result) return;
    setReach("Testing…");
    const started = performance.now();
    try {
      const data = await api<any>(`/api/dns?name=${encodeURIComponent(result.ip)}&type=PTR`);
      const ms = Math.round(performance.now() - started);
      setReach(
        `DNS resolution for this IP completed in ${ms} ms (resolver latency ${data.latencyMs ?? "—"} ms, status ${data.status}). Browsers cannot send ICMP ping, so this is a DNS reachability test, not a ping.`
      );
    } catch (e) {
      setReach(e instanceof Error ? e.message : "Reachability test failed");
    }
  };

  const runAsnLookup = async () => {
    if (!result?.asn) return;
    try {
      setAsnInfo(await api<any>(`/api/asn?asn=${encodeURIComponent(result.asn)}`));
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "ASN lookup failed");
    }
  };

  const runWebrtc = async () => {
    setWebrtcRunning(true);
    setWebrtc(null);
    const found = new Set<string>();
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.createDataChannel("probe");
      pc.onicecandidate = (event) => {
        const cand = event.candidate?.candidate ?? "";
        const match = cand.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{3,})/);
        if (match && !cand.includes(".local")) found.add(match[1]);
        if (!event.candidate) {
          pc.close();
          setWebrtc([...found]);
          setWebrtcRunning(false);
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      setTimeout(() => {
        if (webrtcRunning) {
          pc.close();
          setWebrtc([...found]);
          setWebrtcRunning(false);
        }
      }, 6000);
    } catch {
      setWebrtc([]);
      setWebrtcRunning(false);
    }
  };

  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  const tzMatch =
    result?.timezone && browserTz ? result.timezone === browserTz : null;

  const securitySignals = result
    ? [
        { label: "VPN", value: result.vpn },
        { label: "Proxy", value: result.proxy },
        { label: "Tor exit node", value: result.tor },
        { label: "Hosting / datacenter", value: result.hosting ?? result.datacenter },
      ]
    : [];
  const knownSignals = securitySignals.filter((s) => s.value !== null);
  const flaggedSignals = knownSignals.filter((s) => s.value === true);

  return (
    <div className="min-h-screen">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_20%_-10%,rgba(34,211,238,0.14),transparent),radial-gradient(50rem_26rem_at_90%_0%,rgba(52,245,162,0.10),transparent)]" />

      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-[#050a12]/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => setView("home")}
            className="flex items-center gap-2 text-left"
            aria-label="IP Intelligence home"
          >
            <Logo className="h-9 w-9 shrink-0" />
            <span>
              <span className="block text-base font-extrabold leading-tight">
                IP <span className="neon-text">Intelligence</span>
              </span>
              <span className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:block">
                Understand Every IP. Explore Every Network.
              </span>
            </span>
          </button>
          <nav className="flex items-center gap-1 text-sm">
              {(
                [
                  ["home", "Lookup", Search],
                  ["compare", "Compare", Network],
                  ["privacy", "Privacy", Shield],
                  ["vpn", "VPN Detector", ShieldCheck],
                  ["fingerprint", "Fingerprint", Fingerprint],
                  ["tools", "Diagnostics", Wrench],
                  ["history", "History", History],
                  ["about", "About", Info],
                ] as const
              ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition ${
                  view === key
                    ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                    : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            <button
              onClick={() => setDark((d) => !d)}
              className="ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10"
              aria-label="Toggle dark / light mode"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8">
        {view === "home" && (
          <>
            <section className="text-center">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                What does the internet <span className="neon-text">see</span>?
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:text-base">
                Instant public-IP detection, geolocation, ISP &amp; ASN details, DNS and RDAP
                diagnostics, and honest security indicators — from real providers, never invented.
              </p>

              {/* My IP strip */}
              <div className="glass mx-auto mt-6 flex max-w-2xl flex-col items-center gap-2 rounded-2xl px-5 py-4 sm:flex-row sm:justify-between">
                <div className="text-center sm:text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Your public IP address
                  </p>
                  {myIp ? (
                    <p className="font-mono text-xl font-semibold">
                      {flagEmoji(myIp.countryCode)} {myIp.ip}
                    </p>
                  ) : myIpError ? (
                    <p className="text-sm text-red-500">{myIpError}</p>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Detecting…
                    </p>
                  )}
                  {myIp && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      IPv{myIp.version} · {[myIp.city, myIp.country].filter(Boolean).join(", ") || NA} ·{" "}
                      {val(myIp.isp)}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {connectivity
                      ? `IPv4: ${connectivity.ipv4Available ? connectivity.ipv4 : "Not detected"} · IPv6: ${connectivity.ipv6Available ? connectivity.ipv6 : "Not detected"}`
                      : "Checking IPv4 / IPv6 connectivity…"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={refreshMyIp}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/15"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                  </button>
                  <button
                    onClick={() => myIp && copyText(myIp.ip, "Your IP copied")}
                    disabled={!myIp}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-40 dark:border-white/15"
                  >
                    <ClipboardCopy className="h-4 w-4" /> Copy
                  </button>
                  <button
                    onClick={() => myIp && lookup(myIp.ip)}
                    disabled={!myIp}
                    className="rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  >
                    Analyze my IP
                  </button>
                </div>
              </div>

              {/* Search */}
              <form
                className="mx-auto mt-6 max-w-2xl"
                onSubmit={(e) => {
                  e.preventDefault();
                  lookup(query);
                }}
              >
                <div className="glass flex items-center gap-2 rounded-2xl p-2">
                  <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter an IPv4 or IPv6 address — e.g. 8.8.8.8"
                    className="w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-slate-400 sm:text-base"
                    aria-label="IP address to look up"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => myIp && lookup(myIp.ip)}
                    className="hidden shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium dark:border-white/15 sm:block"
                  >
                    My IP
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                    Lookup
                  </button>
                </div>
                {inputError && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-red-500">
                    <XCircle className="h-4 w-4" /> {inputError}
                  </p>
                )}
                {loadError && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-red-500">
                    <ShieldAlert className="h-4 w-4" /> {loadError}
                  </p>
                )}
              </form>
            </section>

            {loading && (
              <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading results">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass rounded-2xl p-5">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton mt-4 h-3 w-full" />
                    <div className="skeleton mt-2 h-3 w-5/6" />
                    <div className="skeleton mt-2 h-3 w-2/3" />
                  </div>
                ))}
              </section>
            )}

            {!loading && result && (
              <section className="mt-10">
                {/* Result header */}
                <div className="glass rounded-3xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        IP Intelligence Report
                      </p>
                      <h2 className="mt-1 break-all font-mono text-2xl font-bold sm:text-4xl">
                        {flagEmoji(result.countryCode)} {result.ip}
                      </h2>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-cyan-500" />
                          {[result.city, result.region, result.country].filter(Boolean).join(", ") || NA}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-emerald-500" /> {val(result.isp)}
                        </span>
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-300">
                          IPv{result.version} · {result.ipType}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyText(result.ip, "IP address copied")}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-white/15"
                      >
                        <ClipboardCopy className="h-4 w-4" /> Copy IP
                      </button>
                      <button
                        onClick={shareResult}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-white/15"
                      >
                        <Share2 className="h-4 w-4" /> Share
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    Source: {result.provider} · fetched {new Date(result.fetchedAt).toLocaleString()} ·
                    IP geolocation is approximate (city/region level), never an exact address.
                  </p>
                  {!result.isPublic && result.classificationNote && (
                    <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                      <strong>{result.ipType} address.</strong> {result.classificationNote}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Card title="Basic IP Information" icon={<Globe2 className="h-5 w-5 text-cyan-500" />}>
                    <Row k="IP Address" v={result.ip} mono />
                    <Row k="IP Version" v={`IPv${result.version}`} />
                    <Row k="IP Type" v={result.ipType} />
                    <Row k="Hostname" v={val(result.hostname)} />
                    <Row
                      k="Reverse DNS"
                      v={result.reverseDns ?? ptr?.records?.[0]?.value ?? NA}
                    />
                    <Row k="ASN Number" v={val(result.asn)} />
                    <Row k="ASN Organization" v={val(result.asnOrg)} />
                    <Row k="Organization" v={val(result.org)} />
                    <Row k="ISP" v={val(result.isp)} />
                    <Row k="Connection Type" v={val(result.connectionType)} />
                  </Card>

                  <Card title="Geolocation" icon={<MapPin className="h-5 w-5 text-emerald-500" />}>
                    <Row k="Country" v={result.country ? `${flagEmoji(result.countryCode)} ${result.country}` : NA} />
                    <Row k="Country Flag" v={result.countryCode ? flagEmoji(result.countryCode) : NA} />
                    <Row k="Country Code" v={val(result.countryCode)} />
                    <Row k="Region / State" v={val(result.region)} />
                    <Row k="City" v={val(result.city)} />
                    <Row k="District" v={val(result.district)} />
                    <Row k="Postal / ZIP" v={val(result.postal)} />
                    <Row k="Latitude" v={val(result.latitude)} />
                    <Row k="Longitude" v={val(result.longitude)} />
                    <Row k="Continent" v={val(result.continent)} />
                    <Row k="Timezone" v={val(result.timezone)} />
                    <Row k="UTC Offset" v={val(result.utcOffset)} />
                    <Row k="Location Accuracy" v={val(result.accuracy)} />
                  </Card>

                  <Card title="ISP & Network" icon={<Network className="h-5 w-5 text-blue-500" />}>
                    <Row k="ISP Name" v={val(result.isp)} />
                    <Row k="Organization" v={val(result.org)} />
                    <Row k="ASN" v={val(result.asn)} />
                    <Row k="ASN Organization" v={val(result.asnOrg)} />
                    <Row
                      k="Network Range / CIDR"
                      v={rdap?.cidrs?.join(", ") || result.networkRange || NA}
                    />
                    <Row k="Connection Type" v={val(result.connectionType)} />
                    <Row k="Hosting Provider" v={boolVal(result.hosting)} />
                    <Row k="Datacenter" v={boolVal(result.datacenter ?? result.hosting)} />
                    <Row k="Mobile Network" v={boolVal(result.mobile)} />
                    <Row
                      k="Hosting / Residential"
                      v={
                        result.hosting === true || result.datacenter === true
                          ? "Hosting / Datacenter"
                          : result.hosting === false
                            ? "Residential (provider: non-hosting)"
                            : NA
                      }
                    />
                    <Row k="Proxy" v={boolVal(result.proxy)} />
                    <Row k="VPN" v={boolVal(result.vpn)} />
                    <Row k="Tor Exit Node" v={boolVal(result.tor)} />
                  </Card>

                  <Card title="Security & Reputation" icon={<Shield className="h-5 w-5 text-cyan-500" />}>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {securitySignals.map((s) => (
                        <span
                          key={s.label}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            s.value === null
                              ? "bg-slate-500/10 text-slate-500 dark:text-slate-400"
                              : s.value
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                          }`}
                        >
                          {s.label}: {s.value === null ? "Unknown" : s.value ? "Detected" : "Not Detected"}
                        </span>
                      ))}
                    </div>
                    <Row k="Abuse Score (AbuseIPDB)" v={result.abuseScore === null ? NA : `${result.abuseScore} / 100`} />
                    <Row k="Abuse Reports (90 days)" v={val(result.abuseReports)} />
                    <Row k="Known Malicious" v={result.abuseScore === null ? NA : result.abuseScore >= 75 ? "High abuse confidence" : "No high-confidence reports"} />
                    <Row k="Blacklist Status" v={result.abuseScore === null ? NA : result.abuseReports ? "Reports on record" : "No reports on record"} />
                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {result.threatSummary ??
                        (knownSignals.length === 0
                          ? "Threat-intelligence data is not available for this lookup from the configured providers, so no reputation conclusion is drawn. Configure ABUSEIPDB_API_KEY to enable abuse scoring."
                          : flaggedSignals.length > 0
                            ? `Available provider signals flag: ${flaggedSignals.map((s) => s.label).join(", ")}. This indicates the IP is associated with anonymizing or hosting infrastructure — it does not by itself prove malicious activity.`
                            : "Available provider signals show no VPN, proxy, Tor or hosting indicators for this IP. Absence of a signal is not a guarantee of safety.")}
                    </p>
                  </Card>
                </div>

                {/* Map */}
                <div className="glass mt-4 rounded-3xl p-5">
                  <h3 className="mb-1 flex items-center gap-2 font-semibold">
                    <MapPin className="h-5 w-5 text-cyan-500" /> Approximate Location Map
                  </h3>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    The marker shows the provider&apos;s city/region-level estimate. IP lookup cannot
                    identify an exact physical address or live location.
                  </p>
                  {result.latitude !== null && result.longitude !== null ? (
                    <MapView
                      latitude={result.latitude}
                      longitude={result.longitude}
                      label={[result.city, result.country].filter(Boolean).join(", ") || result.ip}
                      sublabel={result.isp ?? undefined}
                    />
                  ) : (
                    <EmptyState text="No coordinates are available for this IP, so no map can be drawn." />
                  )}
                </div>

                {/* Diagnostics */}
                <div className="glass mt-4 rounded-3xl p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold">
                    <Activity className="h-5 w-5 text-emerald-500" /> Network Diagnostics
                  </h3>
                  {diagError && <p className="mb-3 text-sm text-red-500">{diagError}</p>}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Reverse DNS (PTR)</h4>
                      {ptr ? (
                        ptr.records?.length ? (
                          <ul className="space-y-1 font-mono text-sm">
                            {ptr.records.map((r: any, i: number) => (
                              <li key={i} className="break-all rounded-lg bg-slate-500/5 px-3 py-2 dark:bg-white/5">
                                {r.value} <span className="text-slate-400">(TTL {r.ttl})</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-500">{ptr.note ?? "No PTR record published for this IP."}</p>
                        )
                      ) : (
                        <p className="text-sm text-slate-500">{result.isPublic ? "Querying…" : NA}</p>
                      )}

                      <h4 className="mb-2 mt-5 text-sm font-semibold">Reachability</h4>
                      <button
                        onClick={runReachability}
                        disabled={!result.isPublic}
                        className="rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-700 disabled:opacity-40 dark:text-cyan-300"
                      >
                        Run DNS reachability test
                      </button>
                      {reach && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{reach}</p>}

                      <h4 className="mb-2 mt-5 text-sm font-semibold">ASN Details</h4>
                      {result.asn ? (
                        <>
                          <button
                            onClick={runAsnLookup}
                            className="rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-300"
                          >
                            Look up {result.asn}
                          </button>
                          {asnInfo && (
                            <div className="mt-2 text-sm">
                              <Row k="AS Name" v={val(asnInfo.name)} />
                              <Row k="Country" v={val(asnInfo.country)} />
                              <Row k="Status" v={asnInfo.status?.join(", ") || NA} />
                              <Row
                                k="Organizations"
                                v={asnInfo.organizations?.map((o: any) => o.name).filter(Boolean).join("; ") || NA}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">{NA}</p>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <Database className="h-4 w-4" /> WHOIS / RDAP Registration
                      </h4>
                      {rdap ? (
                        rdap.available ? (
                          <div className="text-sm">
                            <Row k="Network Name" v={val(rdap.name)} />
                            <Row k="Handle" v={val(rdap.handle)} />
                            <Row k="Range" v={rdap.startAddress ? `${rdap.startAddress} – ${rdap.endAddress}` : NA} />
                            <Row k="CIDR" v={rdap.cidrs?.join(", ") || NA} />
                            <Row k="Country" v={val(rdap.country)} />
                            <Row k="Status" v={rdap.status?.join(", ") || NA} />
                            <Row
                              k="Registered To"
                              v={rdap.entities?.map((e: any) => e.name).filter(Boolean).join("; ") || NA}
                            />
                            <Row
                              k="Events"
                              v={
                                rdap.events
                                  ?.map((e: any) => `${e.action}: ${e.date?.slice(0, 10)}`)
                                  .join("; ") || NA
                              }
                            />
                            <p className="mt-2 text-xs text-slate-500">Source: {rdap.source}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">{rdap.note}</p>
                        )
                      ) : (
                        <p className="text-sm text-slate-500">{result.isPublic ? "Querying registry…" : NA}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Browser & leak signals (Whoer-inspired, original implementation) */}
                <div className="glass mt-4 rounded-3xl p-5">
                  <h3 className="mb-1 flex items-center gap-2 font-semibold">
                    <Fingerprint className="h-5 w-5 text-blue-500" /> Browser &amp; Leak Signals
                  </h3>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    Signals your own browser already sends with every request. Compare them with the
                    IP report above to spot VPN/proxy mismatches. Nothing here is stored or sent anywhere.
                  </p>
                  <div className="grid gap-4 text-sm lg:grid-cols-2">
                    <div>
                      <Row k="Browser Timezone" v={val(browserTz)} />
                      <Row k="IP Timezone" v={val(result.timezone)} />
                      <Row
                        k="Timezone Match"
                        v={tzMatch === null ? NA : tzMatch ? "Match" : "Mismatch — common with VPN/proxy use"}
                      />
                      <Row k="Language" v={typeof navigator !== "undefined" ? navigator.language : NA} />
                      <Row
                        k="Screen"
                        v={typeof window !== "undefined" ? `${window.screen.width}×${window.screen.height}` : NA}
                      />
                    </div>
                    <div>
                      <Row k="User Agent" v={typeof navigator !== "undefined" ? navigator.userAgent : NA} />
                      <button
                        onClick={runWebrtc}
                        disabled={webrtcRunning}
                        className="mt-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-700 disabled:opacity-50 dark:text-cyan-300"
                      >
                        {webrtcRunning ? "Running WebRTC check…" : "Run WebRTC leak check"}
                      </button>
                      {webrtc !== null && (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {webrtc.length
                            ? `WebRTC exposed candidate IP(s): ${webrtc.join(", ")}. If any differ from your VPN exit IP, sites may see them.`
                            : "No raw IP candidates were exposed (modern browsers usually mask local IPs behind mDNS names)."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!loading && !result && !loadError && (
              <section className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  ["Instant My-IP detection", "Your public IP, country, city, ISP and ASN appear as soon as the page loads."],
                  ["Real diagnostics", "Reverse DNS, RDAP registration, ASN records and DNS-over-HTTPS lookups — live, not simulated."],
                  ["Honest security signals", "VPN, proxy, Tor and hosting indicators only when a provider actually reports them."],
                ].map(([title, text]) => (
                  <div key={title} className="glass rounded-2xl p-5">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {view === "compare" && <CompareIps myIp={myIp} />}

        {view === "privacy" && <PrivacyTests intel={myIp ?? result} />}

        {view === "vpn" && <VpnProxyDetector myIp={myIp} showToast={showToast} />}

        {view === "fingerprint" && <FingerprintLab />}

        {view === "tools" && <ToolsView showToast={showToast} onLookup={lookup} />}

        {view === "history" && (
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Lookup History</h2>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    try {
                      localStorage.removeItem(HISTORY_KEY);
                    } catch {}
                    showToast("History cleared");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 dark:border-red-500/30 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" /> Clear all
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Stored only in this browser (localStorage). No account, no server copy.
            </p>
            {history.length === 0 ? (
              <EmptyState text="No lookups yet. Search an IP and it will appear here." />
            ) : (
              <ul className="mt-5 space-y-3">
                {history.map((h) => (
                  <li key={h.ip + h.at} className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                    <button onClick={() => lookup(h.ip)} className="min-w-0 text-left">
                      <span className="block break-all font-mono font-semibold">{h.ip}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {[h.city, h.country].filter(Boolean).join(", ") || NA} · {val(h.isp)} ·{" "}
                        {new Date(h.at).toLocaleString()}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        const next = history.filter((x) => !(x.ip === h.ip && x.at === h.at));
                        setHistory(next);
                        try {
                          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
                        } catch {}
                      }}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:text-red-500"
                      aria-label={`Remove ${h.ip} from history`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view === "about" && (
          <section className="glass rounded-3xl p-6 sm:p-8">
            <h2 className="text-2xl font-bold">About IP Intelligence</h2>
            <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
              IP Intelligence answers a simple question — what does the internet see when a device
              connects? Enter any public IPv4 or IPv6 address to explore its approximate
              geolocation, ISP, autonomous system, network range, registration records and
              available security indicators.
            </p>
            <h3 className="mt-6 font-semibold">Capabilities</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
              <li>Automatic public-IP detection and full IP lookup (IPv4 &amp; IPv6)</li>
              <li>Geolocation with an interactive OpenStreetMap view</li>
              <li>ISP, ASN, CIDR and RDAP/WHOIS registration data</li>
              <li>DNS lookups (A, AAAA, MX, NS, TXT, CNAME, PTR, SOA) over DNS-over-HTTPS</li>
              <li>Reverse DNS, ASN registry lookup and DNS reachability testing</li>
              <li>VPN / proxy / Tor / hosting indicators and optional AbuseIPDB scoring</li>
              <li>Browser timezone and WebRTC leak-signal checks</li>
              <li>IP comparison, Privacy &amp; Leak Tests with a transparent privacy score</li>
              <li>Browser Fingerprint Lab (canvas, WebGL, audio, permissions — all local)</li>
            </ul>
            <h3 className="mt-6 font-semibold">Limitations</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600 dark:text-slate-300">
              <li>IP geolocation is approximate — typically city or region level, sometimes wrong.</li>
              <li>Private and reserved addresses have no public data and are explained, not geolocated.</li>
              <li>Security indicators depend on provider data; missing data is shown as “Not Available”, never guessed.</li>
              <li>Browsers cannot send ICMP ping or scan ports, so reachability is tested via DNS resolution.</li>
            </ul>
            <h3 className="mt-6 font-semibold">Privacy</h3>
            <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
              No accounts and no tracking. Lookup history lives only in your browser&apos;s
              localStorage. API keys, when configured, stay on the server. Lookups are sent to the
              configured IP-data providers (ipapi.co / ipwho.is), Cloudflare DNS-over-HTTPS and
              RDAP registries — the same public services any IP tool must query.
            </p>
          </section>
        )}

        <footer className="mt-14 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <p className="flex items-center justify-center gap-1.5">
            <Server className="h-3.5 w-3.5" /> Data: ipapi.co · ipwho.is · RDAP (rdap.org) · Cloudflare
            DNS-over-HTTPS · Map © OpenStreetMap contributors
          </p>
          <p className="mt-1">IP geolocation is approximate and must not be used to identify a person&apos;s exact location.</p>
        </footer>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-slate-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        {icon} {title}
      </h3>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 py-1.5 last:border-0 dark:border-white/5">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{k}</span>
      <span className={`break-all text-right font-medium ${mono ? "font-mono" : ""} ${v === NA ? "text-slate-400 dark:text-slate-500" : ""}`}>
        {v}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15">
      {text}
    </div>
  );
}

/* ------------------------------- Tools ------------------------------- */

function ToolsView({
  showToast,
  onLookup,
}: {
  showToast: (m: string) => void;
  onLookup: (ip: string) => void;
}) {
  const [v4, setV4] = useState("");
  const [v6, setV6] = useState("");
  const [domain, setDomain] = useState("");
  const [dnsType, setDnsType] = useState("A");
  const [dnsResult, setDnsResult] = useState<any>(null);
  const [revIp, setRevIp] = useState("");
  const [revResult, setRevResult] = useState<any>(null);
  const [asn, setAsn] = useState("");
  const [asnResult, setAsnResult] = useState<any>(null);
  const [rdapIp, setRdapIp] = useState("");
  const [rdapResult, setRdapResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tool failed");
    } finally {
      setBusy(null);
    }
  };

  const v4Class = v4.trim() ? classifyIp(v4.trim()) : null;
  const v6Class = v6.trim() ? classifyIp(v6.trim()) : null;

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-400 dark:border-white/15";
  const btnCls =
    "shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50";

  return (
    <section>
      <h2 className="text-2xl font-bold">Network Tools</h2>
      <p className="mt-1 text-sm text-slate-500">
        Every tool below runs a real validation or a live public-service query.
      </p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="IPv4 Validator" icon={<CheckCircle2 className="h-5 w-5 text-cyan-500" />}>
          <input value={v4} onChange={(e) => setV4(e.target.value)} placeholder="192.168.1.1" className={inputCls} aria-label="IPv4 address" />
          {v4.trim() &&
            (v4Class?.version === 4 ? (
              <p className="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Valid IPv4 · {v4Class.label}
                {v4Class.isPublic && (
                  <button onClick={() => onLookup(v4.trim())} className="ml-2 underline">
                    Look it up
                  </button>
                )}
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-red-500">
                <XCircle className="h-4 w-4" /> Not a valid IPv4 address
              </p>
            ))}
        </Card>

        <Card title="IPv6 Validator" icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}>
          <input value={v6} onChange={(e) => setV6(e.target.value)} placeholder="2606:4700:4700::1111" className={inputCls} aria-label="IPv6 address" />
          {v6.trim() &&
            (v6Class?.version === 6 ? (
              <p className="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Valid IPv6 · {v6Class.label}
                {v6Class.isPublic && (
                  <button onClick={() => onLookup(v6.trim())} className="ml-2 underline">
                    Look it up
                  </button>
                )}
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-red-500">
                <XCircle className="h-4 w-4" /> Not a valid IPv6 address
              </p>
            ))}
        </Card>

        <Card title="DNS Lookup" icon={<Globe2 className="h-5 w-5 text-blue-500" />}>
          <div className="flex gap-2">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className={inputCls} aria-label="Domain name" />
            <select
              value={dnsType}
              onChange={(e) => setDnsType(e.target.value)}
              className="rounded-xl border border-slate-300 bg-transparent px-2 text-sm dark:border-white/15 dark:bg-[#0a1420]"
              aria-label="DNS record type"
            >
              {["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <button
              className={btnCls}
              disabled={busy === "dns"}
              onClick={() =>
                run("dns", async () => {
                  setDnsResult(
                    await api<any>(`/api/dns?name=${encodeURIComponent(domain.trim())}&type=${dnsType}`)
                  );
                })
              }
            >
              {busy === "dns" ? "…" : "Query"}
            </button>
          </div>
          {dnsResult && (
            <div className="mt-3">
              <p className="text-xs text-slate-500">
                {dnsResult.query} · {dnsResult.type} · {dnsResult.status} · {dnsResult.latencyMs} ms via {dnsResult.resolver}
              </p>
              {dnsResult.records.length ? (
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  {dnsResult.records.map((r: any, i: number) => (
                    <li key={i} className="break-all rounded-lg bg-slate-500/5 px-3 py-2 dark:bg-white/5">
                      {r.type} · TTL {r.ttl} · {r.value}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No {dnsResult.type} records returned.</p>
              )}
            </div>
          )}
        </Card>

        <Card title="Reverse DNS Lookup" icon={<Radar className="h-5 w-5 text-cyan-500" />}>
          <div className="flex gap-2">
            <input value={revIp} onChange={(e) => setRevIp(e.target.value)} placeholder="8.8.8.8" className={inputCls} aria-label="IP for reverse DNS" />
            <button
              className={btnCls}
              disabled={busy === "ptr"}
              onClick={() =>
                run("ptr", async () => {
                  const err = validationError(revIp);
                  if (err) throw new Error(err);
                  setRevResult(await api<any>(`/api/dns?name=${encodeURIComponent(revIp.trim())}&type=PTR`));
                })
              }
            >
              {busy === "ptr" ? "…" : "Resolve"}
            </button>
          </div>
          {revResult && (
            <p className="mt-3 break-all font-mono text-sm">
              {revResult.records?.length
                ? revResult.records.map((r: any) => r.value).join(", ")
                : revResult.note ?? "No PTR record published."}
            </p>
          )}
        </Card>

        <Card title="ASN Lookup" icon={<Network className="h-5 w-5 text-emerald-500" />}>
          <div className="flex gap-2">
            <input value={asn} onChange={(e) => setAsn(e.target.value)} placeholder="AS15169" className={inputCls} aria-label="Autonomous system number" />
            <button
              className={btnCls}
              disabled={busy === "asn"}
              onClick={() =>
                run("asn", async () => {
                  setAsnResult(await api<any>(`/api/asn?asn=${encodeURIComponent(asn.trim())}`));
                })
              }
            >
              {busy === "asn" ? "…" : "Look up"}
            </button>
          </div>
          {asnResult && (
            <div className="mt-3">
              <Row k="ASN" v={val(asnResult.asn)} />
              <Row k="Name" v={val(asnResult.name)} />
              <Row k="Country" v={val(asnResult.country)} />
              <Row k="Status" v={asnResult.status?.join(", ") || NA} />
              <Row k="Organizations" v={asnResult.organizations?.map((o: any) => o.name).filter(Boolean).join("; ") || NA} />
            </div>
          )}
        </Card>

        <Card title="WHOIS / RDAP & IP Range" icon={<Database className="h-5 w-5 text-blue-500" />}>
          <div className="flex gap-2">
            <input value={rdapIp} onChange={(e) => setRdapIp(e.target.value)} placeholder="1.1.1.1" className={inputCls} aria-label="IP for RDAP lookup" />
            <button
              className={btnCls}
              disabled={busy === "rdap"}
              onClick={() =>
                run("rdap", async () => {
                  const err = validationError(rdapIp);
                  if (err) throw new Error(err);
                  setRdapResult(await api<any>(`/api/rdap?ip=${encodeURIComponent(rdapIp.trim())}`));
                })
              }
            >
              {busy === "rdap" ? "…" : "Query"}
            </button>
          </div>
          {rdapResult &&
            (rdapResult.available ? (
              <div className="mt-3">
                <Row k="Network" v={val(rdapResult.name)} />
                <Row k="Range" v={rdapResult.startAddress ? `${rdapResult.startAddress} – ${rdapResult.endAddress}` : NA} />
                <Row k="CIDR" v={rdapResult.cidrs?.join(", ") || NA} />
                <Row k="Country" v={val(rdapResult.country)} />
                <Row k="Registered To" v={rdapResult.entities?.map((e: any) => e.name).filter(Boolean).join("; ") || NA} />
                <button
                  onClick={() => rdapResult.cidrs?.[0] && showToast(`CIDR: ${rdapResult.cidrs[0]}`)}
                  className="mt-2 text-xs text-cyan-600 underline dark:text-cyan-300"
                >
                  Show primary CIDR
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{rdapResult.note}</p>
            ))}
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        Tools query only fixed public services (Cloudflare DNS-over-HTTPS, RDAP). Private and
        reserved IPs are classified locally and never probed. No port scanning is performed.
      </p>
    </section>
  );
}
