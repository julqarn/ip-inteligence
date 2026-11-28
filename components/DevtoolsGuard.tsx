"use client";

import { useEffect } from "react";

export default function DevtoolsGuard() {
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
      if (widthGap > 170 || heightGap > 170) {
        window.location.replace("/caught.html");
      }
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

  return null;
}
