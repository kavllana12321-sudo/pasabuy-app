
"use client";

import { useEffect, useRef } from "react";

import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

// Ituro sa MapLibre kung saan kukunin ang worker file.
setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url
  ).toString()
);

type MapPickerProps = {
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
  }) => void;
};

export default function MapPicker({
  onLocationSelect,
}: MapPickerProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const callbackRef = useRef(onLocationSelect);

  useEffect(() => {
    callbackRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [121.4737, 14.5794],
      zoom: 12,
    });

    mapRef.current = map;

    map.addControl(
      new NavigationControl(),
      "top-right"
    );

    map.on("click", (event) => {
      const latitude = event.lngLat.lat;
      const longitude = event.lngLat.lng;

      if (markerRef.current) {
        markerRef.current.setLngLat([
          longitude,
          latitude,
        ]);
      } else {
        markerRef.current = new Marker({
          color: "#2563eb",
        })
          .setLngLat([longitude, latitude])
          .addTo(map);
      }

      callbackRef.current?.({
        latitude,
        longitude,
      });
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="w-full">
      <div
        ref={mapContainer}
        className="h-[400px] w-full overflow-hidden rounded-xl border border-gray-300"
      />

      <p className="mt-2 text-sm text-gray-500">
        Click anywhere on the map to place your location pin.
      </p>
    </div>
  );
}
