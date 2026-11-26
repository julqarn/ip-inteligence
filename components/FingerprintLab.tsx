"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, RefreshCw } from "lucide-react";
import {
  audioFingerprint,
  canvasFingerprint,
  getBrowserInfo,
  getHardwareInfo,
  getScreenInfo,
  permissionStates,
  webGlInfo,
  type BrowserInfo,
  type HardwareInfo,
  type PermissionStateRow,
  type ScreenInfo,
  type WebGlInfo,
} from "@/lib/browserTests";

const NA = "Not Available";

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 py-1.5 last:border-0 dark:border-white/5">
      <span className="shrink-0 text-slate-500 dark:text-slate-400">{k}</span>
      <span className="break-all text-right font-medium">{v}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function FingerprintLab() {
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [canvas, setCanvas] = useState<{ hash: string; dataUrlLength: number } | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [gl, setGl] = useState<WebGlInfo | null>(null);
  const [audio, setAudio] = useState<{ hash: string; sampleRate: number; detail: string } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionStateRow[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = useCallback(async () => {
    setRunning(true);
    setBrowser(getBrowserInfo());
    setScreenInfo(getScreenInfo());
    setGl(webGlInfo());
    setHardware(await getHardwareInfo());
    setPermissions(await permissionStates());
    try {
      setCanvas(await canvasFingerprint());
      setCanvasError(null);
    } catch (e) {
      setCanvasError(e instanceof Error ? e.message : "Canvas test failed");
    }
    try {
      setAudio(await audioFingerprint());
      setAudioError(null);
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Audio test failed");
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    runAll();
  }, [runAll]);

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-bold">
        <Fingerprint className="h-6 w-6 text-cyan-500" /> Browser Fingerprint Lab
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Everything below is measured locally in your browser through standard web APIs — the same
        signals any website could observe. Nothing is collected, stored, or transmitted.
      </p>
      <button
        onClick={runAll}
        disabled={running}
        className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Regenerate tests
      </button>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Browser Information">
          {browser ? (
            <>
              <Row k="Browser" v={`${browser.browserName} ${browser.browserVersion}`} />
              <Row k="Operating System" v={browser.os} />
              <Row k="Platform" v={browser.platform} />
              <Row k="Language" v={browser.language} />
              <Row k="Preferred Languages" v={browser.languages} />
              <Row k="Timezone" v={browser.timezone} />
              <Row k="Cookies" v={browser.cookiesEnabled} />
              <Row k="Do Not Track" v={browser.doNotTrack} />
              <Row k="JavaScript" v={browser.javaScript} />
              <Row k="User-Agent" v={browser.userAgent} />
            </>
          ) : (
            <p className="text-slate-500">Measuring…</p>
          )}
        </Card>

        <Card title="Screen & Display">
          {screenInfo ? (
            <>
              <Row k="Screen Size" v={`${screenInfo.width}×${screenInfo.height}`} />
              <Row k="Available Size" v={`${screenInfo.availWidth}×${screenInfo.availHeight}`} />
              <Row k="Color Depth" v={`${screenInfo.colorDepth}-bit`} />
              <Row k="Pixel Ratio" v={String(screenInfo.pixelRatio)} />
              <Row k="Orientation" v={screenInfo.orientation} />
              <Row k="Viewport Size" v={screenInfo.viewport} />
            </>
          ) : (
            <p className="text-slate-500">Measuring…</p>
          )}
        </Card>

        <Card title="Hardware Information">
          {hardware ? (
            <>
              <Row k="Hardware Concurrency" v={hardware.hardwareConcurrency} />
              <Row k="Device Memory" v={hardware.deviceMemory} />
              <Row k="Touch Support" v={hardware.touchSupport} />
              <Row k="Max Touch Points" v={hardware.maxTouchPoints} />
              <Row k="Media Devices" v={hardware.mediaDevices} />
            </>
          ) : (
            <p className="text-slate-500">Measuring…</p>
          )}
        </Card>

        <Card title="Canvas Fingerprint">
          {canvas ? (
            <>
              <Row k="SHA-256 Hash" v={canvas.hash} />
              <Row k="Rendered Image Size" v={`${canvas.dataUrlLength} chars (data URL)`} />
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
                A standardized drawing (text, shapes, emoji) is rendered locally and hashed.
                Tiny differences in fonts, GPU, drivers, and anti-aliasing change the pixels —
                and therefore the hash — across devices. The hash never leaves this browser.
              </p>
            </>
          ) : (
            <p className="text-slate-500">{canvasError ?? "Rendering…"}</p>
          )}
        </Card>

        <Card title="WebGL Fingerprint">
          {gl ? (
            gl.available ? (
              <>
                <Row k="WebGL" v="Available" />
                <Row k="Version" v={gl.version} />
                <Row k="Shading Language" v={gl.shadingLanguage} />
                <Row k="Vendor" v={gl.vendor} />
                <Row k="Renderer" v={gl.renderer} />
                <Row k="Max Texture Size" v={gl.maxTextureSize} />
                <Row k="Max Viewport" v={gl.maxViewport} />
                <Row k="Extensions" v={`${gl.extensions.length} supported`} />
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium text-cyan-600 dark:text-cyan-300">Extension list</summary>
                  <p className="mt-1 break-all font-mono text-xs">{gl.extensions.join(", ") || NA}</p>
                </details>
              </>
            ) : (
              <p className="text-slate-500">{gl.error ?? "WebGL is unavailable."}</p>
            )
          ) : (
            <p className="text-slate-500">Measuring…</p>
          )}
        </Card>

        <Card title="Audio Fingerprint Demonstration">
          {audio ? (
            <>
              <Row k="SHA-256 Hash" v={audio.hash} />
              <Row k="Sample Rate" v={`${audio.sampleRate} Hz`} />
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
                {audio.detail} Browsers with anti-fingerprinting protections may add noise or
                block precise rendering, changing or hiding this signal.
              </p>
            </>
          ) : (
            <p className="text-slate-500">{audioError ?? "Rendering audio graph…"}</p>
          )}
        </Card>

        <Card title="Browser Permissions Overview">
          {permissions.length ? (
            <>
              {permissions.map((p) => (
                <Row key={p.name} k={p.name[0].toUpperCase() + p.name.slice(1)} v={p.state} />
              ))}
              <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
                States are read through the Permissions API only. This page never requests
                permission and never activates a camera, microphone, or precise location.
              </p>
            </>
          ) : (
            <p className="text-slate-500">Checking…</p>
          )}
        </Card>

        <Card title="What Fingerprinting Means">
          <div className="space-y-2 leading-relaxed text-slate-600 dark:text-slate-300">
            <p>
              Browser fingerprinting combines many small signals — user-agent, screen, fonts,
              canvas and WebGL rendering, timezone, hardware hints — into a profile that can
              distinguish one browser from others without cookies.
            </p>
            <p>
              A fingerprint is not a permanent identity: updates, new hardware, different
              displays, and privacy protections all change it. This lab therefore does not
              claim a global uniqueness percentage — that would require a legitimate
              comparative dataset.
            </p>
            <p>
              Anti-fingerprinting browsers randomize or standardize these signals. You can
              reduce exposure by using such a browser, limiting extensions, and avoiding
              unusual window sizes and font sets.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
