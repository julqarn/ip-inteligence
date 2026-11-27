"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { flagEmoji, validationError } from "@/lib/ip";
import { detectConnectivity, runDnsLeakTest } from "@/lib/browserTests";
import type { AnonymityReport, CategoryResult, DetectionStatus } from "@/lib/anonymity";
import type { IpIntel } from "@/lib/providers";

const NA = "Not Available";
const SNAPSHOT_KEY = "ip-intelligence-vpn-snapshot";

const STATUS_CLASSES: Record<DetectionStatus, string> = {
  Detected: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
  "Not Detected": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  Likely: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  Unknown: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  Inconclusive: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
};

async function api<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

interface Snapshot {
  at: string;
  ip: string;
  country: string | null;
  isp: string | null;
  asn: string | null;
  networkType: string;
  vpn: DetectionStatus;
  proxy: DetectionStatus;
  tor: DetectionStatus;
  dnsResolver: string | null;
  ipv4: string | null;
  ipv6: string | null;
}

function StatusChip({ status }: { status: DetectionStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}>{status}</span>
  );
}

function DetectionCard({ result, extra }: { result: CategoryResult; extra?: string | null }) {
  return (
    <article className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{result.label}</h3>
        <StatusChip status={result.status} />
      </div>
      {extra && <p className="mt-2 text-sm font-medium">{extra}</p>}
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{result.explanation}</p>
      <dl className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
        <div>Confidence: <span className="font-medium">{result.confidence}</span></div>
        <div>Source: <span className="font-medium">{result.sources.length ? result.sources.join(", ") : NA}</span></div>
        <div>Last updated: <span className="font-medium">{new Date(result.lastUpdated).toLocaleString()}</span></div>
      </dl>
    </article>
  );
}

export default function VpnProxyDetector({
  myIp,
  showToast,
}: {
  myIp: IpIntel | null;
  showToast: (m: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<AnonymityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [after, setAfter] = useState<Snapshot | null>(null);
  const [snapBusy, setSnapBusy] = useState(false);

  const analyze = useCallback(async (rawIp: string) => {
    const ip = rawIp.trim();
    const err = validationError(ip);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      setReport(await api<AnonymityReport>(`/api/anonymity?ip=${encodeURIComponent(ip)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SNAPSHOT_KEY);
      if (saved) setSnapshot(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (myIp && !report) analyze(myIp.ip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myIp]);

  const takeSnapshot = async (): Promise<Snapshot> => {
    const [mine, conn, dns] = await Promise.all([
      api<IpIntel>("/api/myip"),
      detectConnectivity(),
      runDnsLeakTest(),
    ]);
    const rep = await api<AnonymityReport>(`/api/anonymity?ip=${encodeURIComponent(mine.ip)}`);
    return {
      at: new Date().toISOString(),
      ip: mine.ip,
      country: mine.country,
      isp: mine.isp,
      asn: mine.asn,
      networkType: rep.networkType,
      vpn: rep.vpn.status,
      proxy: rep.proxy.status,
      tor: rep.tor.status,
      dnsResolver: dns.resolverIp,
      ipv4: conn.ipv4,
      ipv6: conn.ipv6,
    };
  };

  const saveBefore = async () => {
    setSnapBusy(true);
    try {
      const snap = await takeSnapshot();
      setSnapshot(snap);
      setAfter(null);
      try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); } catch {}
      showToast("Before-VPN snapshot saved locally");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setSnapBusy(false);
    }
  };

  const runAfter = async () => {
    setSnapBusy(true);
    try {
      setAfter(await takeSnapshot());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison test failed");
    } finally {
      setSnapBusy(false);
    }
  };

  const copyIp = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.ip);
      showToast("IP address copied");
    } catch {
      showToast("Copy failed — your browser blocked clipboard access");
    }
  };

  const compareRows: { label: string; before: string; after: string }[] =
    snapshot && after
      ? [
          { label: "Public IP", before: snapshot.ip, after: after.ip },
          { label: "Country", before: snapshot.country ?? NA, after: after.country ?? NA },
          { label: "ISP", before: snapshot.isp ?? NA, after: after.isp ?? NA },
          { label: "ASN", before: snapshot.asn ?? NA, after: after.asn ?? NA },
          { label: "Network Type", before: snapshot.networkType, after: after.networkType },
          { label: "VPN Status", before: snapshot.vpn, after: after.vpn },
          { label: "Proxy Status", before: snapshot.proxy, after: after.proxy },
          { label: "Tor Status", before: snapshot.tor, after: after.tor },
          { label: "DNS Resolver", before: snapshot.dnsResolver ?? NA, after: after.dnsResolver ?? NA },
          { label: "IPv4", before: snapshot.ipv4 ?? "Not detected", after: after.ipv4 ?? "Not detected" },
          { label: "IPv6", before: snapshot.ipv6 ?? "Not detected", after: after.ipv6 ?? "Not detected" },
        ]
      : [];

  const leakNotes: string[] = [];
  if (snapshot && after) {
    if (snapshot.ip === after.ip)
      leakNotes.push("Your public IP did not change — the VPN may not be active, or both tests ran on the same connection.");
    if (snapshot.ip !== after.ip && snapshot.dnsResolver && snapshot.dnsResolver === after.dnsResolver)
      leakNotes.push("Your IP changed but the DNS resolver stayed the same — a potential DNS leak if you expected DNS to move inside the VPN tunnel.");
    if (snapshot.ipv6 && after.ipv6 && snapshot.ipv6 === after.ipv6 && snapshot.ipv4 !== after.ipv4)
      leakNotes.push("IPv4 changed but IPv6 stayed the same — a potential IPv6 leak if your VPN only tunnels IPv4.");
    if (leakNotes.length === 0)
      leakNotes.push("No obvious IP/DNS/IPv6 leaks were observed in this comparison. That does not prove the VPN is fully secure — WebRTC and fingerprint signals should also be checked.");
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <Shield className="h-6 w-6 text-purple-500" /> VPN &amp; Proxy Detector
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Multi-source anonymity analysis: provider security indicators, the Tor Project exit list,
        ASN/ownership analysis, and optional intelligence APIs. Every result names its source and
        confidence — detection is probabilistic, never 100% certain.
      </p>

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          analyze(query);
        }}
      >
        <div className="glass flex items-center gap-2 rounded-2xl p-2">
          <Search className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a public IPv4 or IPv6 address"
            className="w-full bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-slate-400 sm:text-base"
            aria-label="IP address to analyze"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => myIp && analyze(myIp.ip)}
            disabled={!myIp}
            className="hidden shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-white/15 sm:block"
          >
            My IP
          </button>
          <button
            type="button"
            onClick={() => report && analyze(report.ip)}
            disabled={!report || loading}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-white/15"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Analyze
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </form>

      {loading && !report && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading detection results">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-3xl p-5">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton mt-4 h-3 w-full" />
              <div className="skeleton mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {report && (
        <>
          <div className="glass mt-6 rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Anonymity Report · IPv{report.version} · {report.ipType}
                </p>
                <h3 className="mt-1 break-all font-mono text-2xl font-bold sm:text-3xl">
                  {flagEmoji(report.countryCode)} {report.ip}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {[report.country, report.isp, report.asn].filter(Boolean).join(" · ") || NA}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium">VPN <StatusChip status={report.vpn.status} /></span>
                  <span className="flex items-center gap-1.5 text-xs font-medium">Proxy <StatusChip status={report.proxy.status} /></span>
                  <span className="flex items-center gap-1.5 text-xs font-medium">Tor <StatusChip status={report.tor.status} /></span>
                  <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-300">
                    Network: {report.networkType}
                  </span>
                </div>
              </div>
              <button
                onClick={copyIp}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-white/15"
              >
                <ClipboardCopy className="h-4 w-4" /> Copy IP
              </button>
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {report.summary}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-500/5 p-4 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Network Classification Confidence</p>
                <p className="mt-1 text-lg font-bold">{report.classificationConfidence}</p>
                <p className="text-xs text-slate-500">How strongly the measured signals support the classification above.</p>
              </div>
              <div className="rounded-2xl bg-slate-500/5 p-4 dark:bg-white/5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">IP Reputation Risk</p>
                <p className="mt-1 text-lg font-bold">
                  {report.reputationRisk.level}
                  {report.reputationRisk.score !== null ? ` · ${report.reputationRisk.score}/100` : ""}
                </p>
                <p className="text-xs leading-relaxed text-slate-500">{report.reputationRisk.explanation}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetectionCard result={report.vpn} extra={report.vpnProvider ? `Provider: ${report.vpnProvider}` : null} />
            <DetectionCard result={report.proxy} />
            <DetectionCard result={report.tor} />
            <DetectionCard result={report.hosting} extra={report.hostingProvider ? `Provider: ${report.hostingProvider}` : null} />
            <DetectionCard result={report.datacenter} />
            <DetectionCard result={report.residential} />
            <DetectionCard result={report.mobile} />
            <DetectionCard result={report.corporate} />
            <article className="glass rounded-3xl p-5">
              <h3 className="font-semibold">Proxy Subtypes</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.values(report.proxySubtypes).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>{s.label}</span>
                    <StatusChip status={s.status} />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Subtypes need provider classification data or proxied-request header inspection.
                Unknown here means “not measurable from IP intelligence alone”, not “absent”.
              </p>
            </article>
          </div>

          <details className="glass mt-4 rounded-3xl p-5">
            <summary className="cursor-pointer font-semibold">Intelligence signals &amp; sources</summary>
            {report.disagreements.length > 0 && (
              <div className="mt-3 rounded-xl border border-orange-400/40 bg-orange-400/10 p-3 text-sm text-orange-700 dark:text-orange-300">
                {report.disagreements.map((d) => (
                  <p key={d} className="flex items-start gap-1.5"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> {d}</p>
                ))}
              </div>
            )}
            <ul className="mt-3 space-y-1.5 font-mono text-xs text-slate-600 dark:text-slate-300">
              {report.signals.map((s, i) => (
                <li key={i} className="break-all">
                  [{s.category}] {s.name} = {s.value === null ? "unknown" : String(s.value)} — {s.evidence}
                  {s.inference ? " (inference)" : ""}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Sources used: {report.sourcesUsed.join(", ")}. Unavailable: {report.unavailableSources.join("; ")}.
            </p>
          </details>
        </>
      )}

      <div className="glass mt-4 rounded-3xl p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <Camera className="h-5 w-5 text-cyan-500" /> Compare My Connection
        </h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Save a snapshot now (stored only in this browser), connect to your VPN, then run the
          second test. Changes are highlighted; an IP change alone never proves a VPN is fully secure.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={saveBefore}
            disabled={snapBusy}
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {snapBusy ? "Working…" : "Save snapshot (before VPN)"}
          </button>
          <button
            onClick={runAfter}
            disabled={snapBusy || !snapshot}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium disabled:opacity-40 dark:border-white/15"
          >
            Run after-VPN test
          </button>
          {snapshot && (
            <span className="self-center text-xs text-slate-500">
              Snapshot: {snapshot.ip} · {new Date(snapshot.at).toLocaleString()}
            </span>
          )}
        </div>
        {snapshot && after && (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    <th className="py-2 pr-3 font-semibold text-slate-500">Field</th>
                    <th className="py-2 pr-3 font-semibold">Before</th>
                    <th className="py-2 font-semibold">After</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => {
                    const changed = row.before !== row.after;
                    return (
                      <tr key={row.label} className="border-b border-slate-200/60 last:border-0 dark:border-white/5">
                        <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{row.label}</td>
                        <td className={`py-2 pr-3 font-medium ${changed ? "bg-cyan-400/10" : ""}`}>{row.before}</td>
                        <td className={`py-2 font-medium ${changed ? "bg-cyan-400/10" : ""}`}>{row.after}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {leakNotes.map((n) => (
                <li key={n} className="flex items-start gap-1.5">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {n}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
