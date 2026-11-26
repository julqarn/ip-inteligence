"use client";

import { useState } from "react";
import { GitCompareArrows, Loader2, Search } from "lucide-react";
import { flagEmoji, validationError } from "@/lib/ip";
import type { IpIntel } from "@/lib/providers";

const NA = "Not Available";

async function fetchIntel(ip: string): Promise<IpIntel> {
  const res = await fetch(`/api/lookup?ip=${encodeURIComponent(ip)}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? `Lookup failed (${res.status})`);
  return json.data as IpIntel;
}

function v(x: string | number | null | undefined): string {
  return x === null || x === undefined || x === "" ? NA : String(x);
}
function b(x: boolean | null): string {
  return x === null ? NA : x ? "Yes" : "No";
}
function networkType(i: IpIntel): string {
  if (i.hosting || i.datacenter) return "Hosting / Datacenter";
  if (i.mobile) return "Mobile";
  if (i.connectionType) return i.connectionType;
  if (i.hosting === false) return "Residential (provider: non-hosting)";
  return NA;
}

const ROWS: { label: string; get: (i: IpIntel) => string }[] = [
  { label: "Country", get: (i) => (i.country ? `${flagEmoji(i.countryCode)} ${i.country}` : NA) },
  { label: "Region", get: (i) => v(i.region) },
  { label: "City", get: (i) => v(i.city) },
  { label: "ISP", get: (i) => v(i.isp) },
  { label: "ASN", get: (i) => v(i.asn) },
  { label: "ASN Organization", get: (i) => v(i.asnOrg) },
  { label: "Network Type", get: networkType },
  { label: "Timezone", get: (i) => v(i.timezone) },
  { label: "Hosting", get: (i) => b(i.hosting ?? i.datacenter) },
  { label: "VPN", get: (i) => b(i.vpn) },
  { label: "Proxy", get: (i) => b(i.proxy) },
  { label: "Tor", get: (i) => b(i.tor) },
  { label: "Mobile", get: (i) => b(i.mobile) },
  { label: "Abuse Score", get: (i) => (i.abuseScore === null ? NA : `${i.abuseScore} / 100`) },
];

export default function CompareIps({ myIp }: { myIp: IpIntel | null }) {
  const [ipA, setIpA] = useState("");
  const [ipB, setIpB] = useState("");
  const [a, setA] = useState<IpIntel | null>(null);
  const [bIntel, setBIntel] = useState<IpIntel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    const errA = validationError(ipA);
    const errB = validationError(ipB);
    if (errA || errB) {
      setError(errA ?? errB);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const [ra, rb] = await Promise.all([fetchIntel(ipA.trim()), fetchIntel(ipB.trim())]);
      setA(ra);
      setBIntel(rb);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-400 dark:border-white/15";

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <GitCompareArrows className="h-6 w-6 text-cyan-500" /> Compare Two IPs
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Side-by-side intelligence for two addresses. Differences are highlighted.
      </p>

      <div className="glass mt-5 rounded-3xl p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input value={ipA} onChange={(e) => setIpA(e.target.value)} placeholder="First IP — e.g. 8.8.8.8" className={inputCls} aria-label="First IP address" />
          <input value={ipB} onChange={(e) => setIpB(e.target.value)} placeholder="Second IP — e.g. 1.1.1.1" className={inputCls} aria-label="Second IP address" />
          <button
            onClick={compare}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Compare
          </button>
        </div>
        {myIp && (
          <button
            onClick={() => setIpA(myIp.ip)}
            className="mt-3 text-sm font-medium text-cyan-600 underline dark:text-cyan-300"
          >
            Use my IP ({myIp.ip}) as the first address
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {a && bIntel && (
        <div className="glass mt-4 overflow-x-auto rounded-3xl p-5">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="py-2 pr-3 font-semibold text-slate-500">Field</th>
                <th className="py-2 pr-3 font-mono font-semibold">{a.ip}</th>
                <th className="py-2 font-mono font-semibold">{bIntel.ip}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const va = row.get(a);
                const vb = row.get(bIntel);
                const different = va !== vb;
                return (
                  <tr key={row.label} className="border-b border-slate-200/60 last:border-0 dark:border-white/5">
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{row.label}</td>
                    <td className={`py-2 pr-3 font-medium ${different ? "bg-amber-400/10 text-amber-700 dark:text-amber-300" : ""}`}>{va}</td>
                    <td className={`py-2 font-medium ${different ? "bg-amber-400/10 text-amber-700 dark:text-amber-300" : ""}`}>{vb}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Amber rows differ between the two addresses. Sources: {a.provider} / {bIntel.provider}.
          </p>
        </div>
      )}
    </section>
  );
}
