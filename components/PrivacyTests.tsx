"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  detectConnectivity,
  getBrowserInfo,
  getHardwareInfo,
  getScreenInfo,
  runDnsLeakTest,
  runWebRtcTest,
  webGlInfo,
  type ConnectivityResult,
  type DnsLeakResult,
  type WebRtcResult,
} from "@/lib/browserTests";
import {
  computePrivacyScore,
  evaluateAnonymizers,
  evaluateConnectivity,
  evaluateConsistency,
  evaluateDns,
  evaluateFingerprintSignals,
  evaluateWebRtc,
  type PrivacyTestResult,
  type TestStatus,
} from "@/lib/privacy";
import type { IpIntel } from "@/lib/providers";

const STATUS_STYLE: Record<TestStatus, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
  good: { label: "No issue detected", classes: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", Icon: CheckCircle2 },
  concern: { label: "Potential concern", classes: "bg-amber-500/15 text-amber-600 dark:text-amber-300", Icon: AlertTriangle },
  exposure: { label: "Exposure detected", classes: "bg-red-500/15 text-red-600 dark:text-red-300", Icon: ShieldAlert },
  inconclusive: { label: "Inconclusive", classes: "bg-slate-500/15 text-slate-500 dark:text-slate-400", Icon: HelpCircle },
};

async function fetchIntel(ip: string): Promise<IpIntel | null> {
  try {
    const res = await fetch(`/api/lookup?ip=${encodeURIComponent(ip)}`);
    const json = await res.json().catch(() => ({}));
    return res.ok && json.ok !== false ? (json.data as IpIntel) : null;
  } catch {
    return null;
  }
}

export default function PrivacyTests({ intel }: { intel: IpIntel | null }) {
  const [running, setRunning] = useState<string | null>(null);
  const [webrtc, setWebrtc] = useState<WebRtcResult | null>(null);
  const [dns, setDns] = useState<DnsLeakResult | null>(null);
  const [resolverIntel, setResolverIntel] = useState<IpIntel | null>(null);
  const [conn, setConn] = useState<ConnectivityResult | null>(null);
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const [ran, setRan] = useState(false);

  const browserTz = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; }
  }, []);
  const browserLang = typeof navigator !== "undefined" ? navigator.language : null;

  const countSignals = useCallback(async () => {
    const info = getBrowserInfo();
    const screenInfo = getScreenInfo();
    const hardware = await getHardwareInfo();
    const gl = webGlInfo();
    const signals = [
      info.browserName !== "Unknown",
      !!info.userAgent,
      !!info.timezone,
      info.languages !== "Not Available",
      screenInfo.width > 0,
      screenInfo.colorDepth > 0,
      hardware.hardwareConcurrency !== "Not Available",
      hardware.deviceMemory !== "Not Available",
      hardware.maxTouchPoints !== "0",
      gl.available,
      gl.renderer !== "Not Available" && gl.renderer !== "Masked by browser",
      gl.extensions.length > 0,
    ].filter(Boolean).length;
    setSignalCount(signals);
    return signals;
  }, []);

  const runAll = async () => {
    setRan(true);
    setRunning("webrtc");
    const [rtc, dnsResult, connectivity] = await Promise.all([
      runWebRtcTest(),
      runDnsLeakTest(),
      detectConnectivity(),
    ]);
    setWebrtc(rtc);
    setDns(dnsResult);
    setConn(connectivity);
    setRunning("dns");
    if (dnsResult.resolverIp) setResolverIntel(await fetchIntel(dnsResult.resolverIp));
    setRunning("fingerprint");
    await countSignals();
    setRunning(null);
  };

  const tests: PrivacyTestResult[] = [
    evaluateWebRtc(webrtc, intel?.ip ?? conn?.ipv4 ?? conn?.ipv6 ?? null),
    evaluateDns(dns, resolverIntel, intel),
    evaluateConnectivity(conn),
    evaluateAnonymizers(intel),
    evaluateConsistency(intel, browserTz, browserLang),
    evaluateFingerprintSignals(signalCount),
  ];
  const score = computePrivacyScore(tests);

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <Shield className="h-6 w-6 text-cyan-500" /> Privacy &amp; Leak Test
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Real browser and network diagnostics: WebRTC candidates, the DNS resolver your browser
        actually uses, IPv4/IPv6 connectivity, VPN/proxy indicators, and timezone consistency.
        Tests run only when you press the button.
      </p>

      <div className="glass mt-5 flex flex-col items-start justify-between gap-4 rounded-3xl p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Internet Privacy Score
          </p>
          {score.overall === null ? (
            <p className="mt-1 text-sm text-slate-500">
              {ran ? "Not enough measured tests yet — inconclusive tests never lower the score." : "Run the tests to calculate your score."}
            </p>
          ) : (
            <div className="mt-1 flex items-end gap-3">
              <span className="text-5xl font-extrabold">{score.overall}</span>
              <span className="pb-1.5 text-sm text-slate-500">/ 100</span>
              <span className="mb-1.5 h-2.5 w-40 overflow-hidden rounded-full bg-slate-500/20">
                <span
                  className={`block h-full rounded-full ${score.overall >= 75 ? "bg-emerald-400" : score.overall >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${score.overall}%` }}
                />
              </span>
            </div>
          )}
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">{score.formula}</p>
        </div>
        <button
          onClick={runAll}
          disabled={running !== null}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? "Running tests…" : "Run All Tests"}
        </button>
      </div>

      {ran && score.risks.length > 0 && (
        <div className="mt-4 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-5">
          <h3 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5" /> Detected risks
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-200">
            {score.risks.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <h4 className="mt-3 font-semibold text-amber-700 dark:text-amber-300">Recommended improvements</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-200">
            {score.recommendations.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}
      {ran && score.risks.length === 0 && score.overall !== null && (
        <div className="mt-4 flex items-center gap-2 rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-5 text-sm text-emerald-700 dark:text-emerald-200">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          No exposures were detected by the measured tests. A high score summarizes these signals only — it does not guarantee anonymity or security.
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {tests.map((test) => {
          const style = STATUS_STYLE[test.status];
          const isRunning = running !== null && test.score === null && ran;
          return (
            <article key={test.id} className="glass rounded-3xl p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{test.name}</h3>
                <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.classes}`}>
                  {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <style.Icon className="h-3.5 w-3.5" />}
                  {isRunning ? "Running" : style.label}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{test.result}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{test.explanation}</p>
              <p className="mt-2 text-xs text-slate-500">
                Test score: {test.score === null ? "Not measured (excluded)" : `${test.score} / 100`} · weight ×{test.weight}
              </p>
              {test.details.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-cyan-600 dark:text-cyan-300">
                    Technical details
                  </summary>
                  <ul className="mt-2 space-y-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
                    {test.details.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </details>
              )}
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-medium">Recommendation:</span> {test.recommendation}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
