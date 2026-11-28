"use client";

import { useEffect, useState } from "react";

export default function DevtoolsGuard() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const blocked =
        event.key === "F12" ||
        (modifier && event.shiftKey && ["i", "j", "c", "k"].includes(key)) ||
        (modifier && ["u", "s"].includes(key));
      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const detectDevtools = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      setDevtoolsOpen(widthGap > 170 || heightGap > 170);
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeys, true);
    detectDevtools();
    const timer = window.setInterval(detectDevtools, 1000);
    window.addEventListener("resize", detectDevtools);

    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeys, true);
      window.clearInterval(timer);
      window.removeEventListener("resize", detectDevtools);
    };
  }, []);

  if (!devtoolsOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Developer tools disabled"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#04122e] px-6 text-center text-white"
    >
      <div className="max-w-md">
        <h1 className="text-2xl font-bold">Developer tools are disabled</h1>
        <p className="mt-3 text-sm text-white/70">
          Please close the browser developer tools to continue using IP Intelligence.
        </p>
      </div>
    </div>
  );
}
