/**
 * Browser-only diagnostic helpers for Privacy & Leak Tests and the
 * Browser Fingerprint Lab. Everything here runs locally in the visitor's
 * browser; fingerprint outputs are never transmitted anywhere.
 */

import { classifyIp } from "./ip";

export interface ConnectivityResult {
  ipv4: string | null;
  ipv6: string | null;
  ipv4Available: boolean;
  ipv6Available: boolean;
  checkedAt: string;
}

async function fetchIpFrom(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const ip = typeof data?.ip === "string" ? data.ip.trim() : null;
    return ip && classifyIp(ip) ? ip : null;
  } catch {
    return null;
  }
}

/**
 * Detect IPv4 and IPv6 connectivity separately. api4/api6.ipify.org only
 * answer over the matching address family, so a successful response proves
 * that family works end-to-end from this browser.
 */
export async function detectConnectivity(): Promise<ConnectivityResult> {
  const [ipv4, ipv6] = await Promise.all([
    fetchIpFrom("https://api4.ipify.org?format=json"),
    fetchIpFrom("https://api6.ipify.org?format=json"),
  ]);
  return {
    ipv4,
    ipv6,
    ipv4Available: ipv4 !== null,
    ipv6Available: ipv6 !== null,
    checkedAt: new Date().toISOString(),
  };
}

export interface WebRtcResult {
  publicIps: string[];
  privateIps: string[];
  mdnsCandidates: number;
  rawCandidateCount: number;
  supported: boolean;
}

export async function runWebRtcTest(): Promise<WebRtcResult> {
  if (typeof RTCPeerConnection === "undefined") {
    return { publicIps: [], privateIps: [], mdnsCandidates: 0, rawCandidateCount: 0, supported: false };
  }
  const publicIps = new Set<string>();
  const privateIps = new Set<string>();
  let mdnsCandidates = 0;
  let rawCandidateCount = 0;

  await new Promise<void>((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try { pc.close(); } catch {}
      resolve();
    };
    pc.createDataChannel("probe");
    pc.onicecandidate = (event) => {
      const cand = event.candidate?.candidate ?? "";
      if (!event.candidate) return finish();
      rawCandidateCount += 1;
      if (cand.includes(".local")) {
        // mDNS host candidates are privacy masks, not real IP addresses.
        mdnsCandidates += 1;
        return;
      }
      const tokens = cand.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F]{0,4}(?::[0-9a-fA-F]{0,4}){2,})/g) ?? [];
      for (const token of tokens) {
        const cls = classifyIp(token);
        if (!cls) continue;
        if (cls.isPublic) publicIps.add(token);
        else privateIps.add(token);
      }
    };
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(finish);
    setTimeout(finish, 6000);
  });

  return {
    publicIps: [...publicIps],
    privateIps: [...privateIps],
    mdnsCandidates,
    rawCandidateCount,
    supported: true,
  };
}

export interface DnsLeakResult {
  resolverIp: string | null;
  resolverGeo: string | null;
  edns: string | null;
  method: string;
  error: string | null;
}

/**
 * DNS resolver diagnostic via the EDNS test endpoint at edns.ip-api.com.
 * When the browser resolves that hostname, the authoritative server records
 * which recursive resolver actually asked — revealing the public DNS resolver
 * in use (ISP resolver, VPN DNS, or a DoH provider). A browser cannot see
 * all system DNS traffic, so this measures the resolver path for normal
 * browser DNS lookups only.
 */
export async function runDnsLeakTest(): Promise<DnsLeakResult> {
  const method =
    "Browser-triggered EDNS diagnostic (edns.ip-api.com): the authoritative server reports the recursive resolver that queried it.";
  try {
    const res = await fetch("https://edns.ip-api.com/json", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`EDNS endpoint returned HTTP ${res.status}`);
    const data = await res.json();
    return {
      resolverIp: data?.dns?.ip ?? null,
      resolverGeo: data?.dns?.geo ?? null,
      edns: data?.edns?.geo ?? null,
      method,
      error: null,
    };
  } catch (e) {
    return {
      resolverIp: null,
      resolverGeo: null,
      edns: null,
      method,
      error: e instanceof Error ? e.message : "DNS diagnostic failed",
    };
  }
}

/* ------------------------- fingerprint helpers ------------------------ */

export interface BrowserInfo {
  browserName: string;
  browserVersion: string;
  userAgent: string;
  os: string;
  platform: string;
  language: string;
  languages: string;
  timezone: string;
  cookiesEnabled: string;
  doNotTrack: string;
  javaScript: string;
}

export function getBrowserInfo(): BrowserInfo {
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "Unknown";
  const patterns: [RegExp, string][] = [
    [/Edg\/([\d.]+)/, "Microsoft Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [re, name] of patterns) {
    const m = ua.match(re);
    if (m) {
      browserName = name;
      browserVersion = m[1];
      break;
    }
  }
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "Not Available";
  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  let timezone = "Not Available";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  return {
    browserName,
    browserVersion,
    userAgent: ua,
    os,
    platform: `${platform} (legacy property — may be reduced for privacy)`,
    language: navigator.language ?? "Not Available",
    languages: (navigator.languages ?? []).join(", ") || "Not Available",
    timezone,
    cookiesEnabled: navigator.cookieEnabled ? "Enabled" : "Disabled",
    doNotTrack: navigator.doNotTrack === "1" ? "Enabled (1)" : navigator.doNotTrack === "0" ? "Disabled (0)" : "Not set / unsupported",
    javaScript: "Enabled (this test is running)",
  };
}

export interface ScreenInfo {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  pixelRatio: number;
  orientation: string;
  viewport: string;
}

export function getScreenInfo(): ScreenInfo {
  let orientation = "Not Available";
  try {
    orientation = screen.orientation?.type ?? (window.innerWidth > window.innerHeight ? "Landscape (inferred)" : "Portrait (inferred)");
  } catch {}
  return {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    orientation,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
  };
}

export interface HardwareInfo {
  hardwareConcurrency: string;
  deviceMemory: string;
  touchSupport: string;
  maxTouchPoints: string;
  mediaDevices: string;
}

export async function getHardwareInfo(): Promise<HardwareInfo> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let mediaDevices = "Not Available";
  try {
    if (navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // Without permission, labels are blank; only counts/kinds are visible.
      const counts: Record<string, number> = {};
      for (const d of devices) counts[d.kind] = (counts[d.kind] ?? 0) + 1;
      mediaDevices =
        Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ") +
        " (labels hidden until permission is granted)";
    }
  } catch {
    mediaDevices = "Blocked by browser";
  }
  return {
    hardwareConcurrency: navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} logical cores` : "Not Available",
    deviceMemory: nav.deviceMemory ? `~${nav.deviceMemory} GB (approximate, bucketed)` : "Not Available",
    touchSupport: "ontouchstart" in window || navigator.maxTouchPoints > 0 ? "Supported" : "Not detected",
    maxTouchPoints: String(navigator.maxTouchPoints ?? "Not Available"),
    mediaDevices,
  };
}

async function sha256Hex(text: string): Promise<string> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback FNV-1a hash when SubtleCrypto is unavailable (non-secure context).
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a-${hash.toString(16).padStart(8, "0")}`;
  }
}

export async function canvasFingerprint(): Promise<{ hash: string; dataUrlLength: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser");
  ctx.textBaseline = "top";
  ctx.font = "16px Arial";
  ctx.fillStyle = "#f60";
  ctx.fillRect(120, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("IP Intelligence 🛰️ 12345", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("IP Intelligence 🛰️ 12345", 4, 17);
  ctx.beginPath();
  ctx.arc(250, 40, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#0af";
  ctx.fill();
  const dataUrl = canvas.toDataURL();
  return { hash: await sha256Hex(dataUrl), dataUrlLength: dataUrl.length };
}

export interface WebGlInfo {
  available: boolean;
  version: string;
  shadingLanguage: string;
  vendor: string;
  renderer: string;
  maxTextureSize: string;
  maxViewport: string;
  extensions: string[];
  error: string | null;
}

export function webGlInfo(): WebGlInfo {
  const base: WebGlInfo = {
    available: false,
    version: "Not Available",
    shadingLanguage: "Not Available",
    vendor: "Not Available",
    renderer: "Not Available",
    maxTextureSize: "Not Available",
    maxViewport: "Not Available",
    extensions: [],
    error: null,
  };
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { ...base, error: "WebGL context creation failed or is blocked" };
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
    return {
      available: true,
      version: String(gl.getParameter(gl.VERSION) ?? "Not Available"),
      shadingLanguage: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) ?? "Not Available"),
      vendor: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) ?? "Not Available") : "Masked by browser",
      renderer: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) ?? "Not Available") : "Masked by browser",
      maxTextureSize: String(gl.getParameter(gl.MAX_TEXTURE_SIZE) ?? "Not Available"),
      maxViewport: maxViewport ? `${maxViewport[0]}×${maxViewport[1]}` : "Not Available",
      extensions: gl.getSupportedExtensions() ?? [],
      error: null,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "WebGL inspection failed" };
  }
}

export async function audioFingerprint(): Promise<{ hash: string; sampleRate: number; detail: string }> {
  const OfflineCtx = window.OfflineAudioContext;
  if (!OfflineCtx) throw new Error("OfflineAudioContext is unavailable in this browser");
  const ctx = new OfflineCtx(1, 44100, 44100);
  const oscillator = ctx.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.value = 10000;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -50;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  oscillator.connect(compressor);
  compressor.connect(ctx.destination);
  oscillator.start(0);
  const buffer = await ctx.startRendering();
  const samples = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += Math.abs(samples[i]);
  const fingerprintValue = sum.toFixed(6);
  return {
    hash: await sha256Hex(fingerprintValue),
    sampleRate: buffer.sampleRate,
    detail: `Rendered-sum signature ${fingerprintValue} from a standardized oscillator/compressor graph. No microphone was used.`,
  };
}

export interface PermissionStateRow {
  name: string;
  state: "Granted" | "Denied" | "Prompt" | "Unsupported";
}

export async function permissionStates(): Promise<PermissionStateRow[]> {
  const names = ["geolocation", "camera", "microphone", "notifications"] as const;
  const rows: PermissionStateRow[] = [];
  for (const name of names) {
    try {
      if (!navigator.permissions?.query) throw new Error("unsupported");
      const status = await navigator.permissions.query({ name: name as PermissionName });
      rows.push({
        name,
        state: status.state === "granted" ? "Granted" : status.state === "denied" ? "Denied" : "Prompt",
      });
    } catch {
      rows.push({ name, state: "Unsupported" });
    }
  }
  return rows;
}
