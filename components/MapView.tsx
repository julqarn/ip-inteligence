"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  latitude: number;
  longitude: number;
  label: string;
  sublabel?: string;
}

/**
 * Leaflet + OpenStreetMap approximate-location map.
 * IP geolocation points at a city/region area — never an exact address.
 */
export default function MapView({ latitude, longitude, label, sublabel }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current, { scrollWheelZoom: true }).setView([latitude, longitude], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: '<div class="ip-pin"></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      L.marker([latitude, longitude], { icon })
        .addTo(map)
        .bindPopup(
          `<strong>${label}</strong>${sublabel ? `<br/>${sublabel}` : ""}<br/>${latitude.toFixed(4)}, ${longitude.toFixed(4)}<br/><em>Approximate IP location</em>`
        )
        .openPopup();

      // Broad radius ring to communicate approximation honestly.
      L.circle([latitude, longitude], {
        radius: 25000,
        color: "#22d3ee",
        weight: 1,
        fillColor: "#22d3ee",
        fillOpacity: 0.08,
      }).addTo(map);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [latitude, longitude, label, sublabel]);

  return (
    <div
      ref={ref}
      className="h-80 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10"
      role="img"
      aria-label={`Map showing approximate location: ${label}`}
    />
  );
}
