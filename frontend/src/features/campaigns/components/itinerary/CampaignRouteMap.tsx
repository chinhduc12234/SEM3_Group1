"use client";
import routeMapStyles from "@/features/campaigns/components/itinerary/CampaignRouteMap.module.css";
import { LocalizedTree } from "@/shared/i18n/LocalizedTree";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type RouteStop = {
  date: string;
  start: string;
  ward: string;
  detail: string;
  day: number;
  activity: number;
  province?: string;
  district?: string;
  title?: string;
  schedule?: string[];
  pin?: { latitude: number; longitude: number } | null;
};
type Point = { lon: number; lat: number; label: string };
type PhotonFeature = {
  properties: {
    name?: string;
    state?: string;
    city?: string;
    county?: string;
    district?: string;
    countrycode?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry: { coordinates: number[] };
};
const geocodeCache = new Map<string, Point>();
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const wardName = (value: string) => value.replace(/^(xã|phường|thị trấn)\s+/i, "");
const provinceName = (value: string) =>
  value.replace(/^(tỉnh|thành phố)\s+/i, "").replace(/\s+(province|city)$/i, "");
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function geocodeKey(ward: string, province: string, district?: string) {
  return JSON.stringify([ward, province, district ?? ""]);
}

async function geocode(ward: string, province: string, district: string | undefined, signal: AbortSignal): Promise<Point> {
  const cacheKey = geocodeKey(ward, province, district);
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;
  const expectedDistrict = district?.replace(/^(quận|huyện|thị xã|thành phố)\s+/i, "");
  const query = [wardName(ward), expectedDistrict, provinceName(province)].filter(Boolean).join(" ");
  const url = new URL("/geocode-location", window.location.origin);
  url.searchParams.set("q", query);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Không thể tìm địa điểm. Vui lòng thử lại sau.");
  const data = (await response.json()) as { features?: PhotonFeature[] };
  const expectedWard = normalize(wardName(ward));
  const expectedProvince = normalize(provinceName(province));
  const candidates =
    data.features?.filter(
      (feature) =>
        normalize(wardName(feature.properties.name || "")) === expectedWard &&
        [feature.properties.state, feature.properties.city].some(
          (name) => normalize(provinceName(name || "")) === expectedProvince,
        ) &&
        (!expectedDistrict || [feature.properties.county, feature.properties.district, feature.properties.city].some(
          (name) => normalize(name || "").includes(normalize(expectedDistrict)),
        )) &&
        (feature.properties.countrycode || "").toLowerCase() === "vn",
    ) || [];
  const match =
    candidates.find(
      (feature) =>
        feature.properties.osm_key === "boundary" &&
        feature.properties.osm_value === "administrative",
    ) || candidates.find((feature) => feature.properties.osm_value !== "historic");
  if (!match || !Array.isArray(match.geometry.coordinates) || match.geometry.coordinates.length < 2)
    throw new Error(
      `Không tìm thấy vị trí khớp xã/phường ${ward}, ${province} trên dữ liệu OpenStreetMap. Vui lòng kiểm tra lại tên địa điểm.`,
    );
  const [lon, lat] = match.geometry.coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat))
    throw new Error(`Tọa độ của ${ward} không hợp lệ.`);
  const point = { lon, lat, label: match.properties.name || ward };
  geocodeCache.set(cacheKey, point);
  return point;
}

export default function CampaignRouteMap({
  stops,
  province,
  autoShow = true,
  onPick,
}: {
  stops: RouteStop[];
  province: string;
  autoShow?: boolean;
  onPick?: (pin: NonNullable<RouteStop["pin"]>) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null),
    mapInstance = useRef<Leaflet.Map | null>(null),
    abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; }, [onPick]);
  const editable = !!onPick;
  const stopKey = JSON.stringify({ stops, province, editable });
  const label = (stop: RouteStop) => stop.title
    ? `Ngày ${stop.day} · ${stop.title}`
    : `Ngày ${stop.day} · Hoạt động ${stop.activity}`;
  useEffect(() => {
    setStatus("");
    return () => {
      abortRef.current?.abort();
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [stopKey]);
  async function showLocations() {
    if ((!stops.length && !editable) || !mapRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setStatus("Đang tìm vị trí các hoạt động…");
    try {
      const points: { point: Point; stop: RouteStop }[] = [];
      const missing: RouteStop[] = [];
      const failed = new Set<string>();
      let lastRequest = 0;
      for (const stop of stops) {
        if (controller.signal.aborted) return;
        if (stop.pin) {
          points.push({ point: { lat: stop.pin.latitude, lon: stop.pin.longitude, label: stop.detail }, stop });
          continue;
        }
        const stopProvince = stop.province || province;
        if (!stop.ward || !stopProvince) { missing.push(stop); continue; }
        const key = geocodeKey(stop.ward, stopProvince, stop.district);
        if (failed.has(key)) { missing.push(stop); continue; }
        const cached = geocodeCache.has(key);
        if (!cached && lastRequest) {
          const delay = 1100 - (Date.now() - lastRequest);
          if (delay > 0) await sleep(delay);
        }
        if (controller.signal.aborted) return;
        if (!cached) lastRequest = Date.now();
        try {
          points.push({ point: await geocode(stop.ward, stopProvince, stop.district, controller.signal), stop });
        } catch {
          if (controller.signal.aborted) return;
          failed.add(key);
          missing.push(stop);
        }
      }
      if (controller.signal.aborted) return;
      mapInstance.current?.remove();
      mapInstance.current = null;
      {
        const L = await import("leaflet");
        if (controller.signal.aborted || !mapRef.current) return;
        const map = L.map(mapRef.current);
        mapInstance.current = map;
        if (editable) map.on("click", ({ latlng }: Leaflet.LeafletMouseEvent) => {
          const { lat, lng } = latlng.wrap();
          pick.current?.({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
        }).addTo(map);
        const grouped = new Map<string, { point: Point; stops: RouteStop[] }>();
        points.forEach(({ point, stop }) => {
          const key = `${point.lat},${point.lon}`;
          const group = grouped.get(key);
          if (group) group.stops.push(stop);
          else grouped.set(key, { point, stops: [stop] });
        });
        grouped.forEach(({ point, stops: items }) => {
          const marker = L.circleMarker([point.lat, point.lon], {
            radius: 8,
            color: "#fff",
            weight: 2,
            fillColor: "#bd262d",
            fillOpacity: 1,
          }).addTo(map);
          const content = document.createElement("div");
          items.forEach((stop) => {
            const line = document.createElement("div");
            line.textContent = [label(stop), stop.date, stop.detail || stop.ward, stop.start, ...(stop.schedule ?? [])].filter(Boolean).join("\n");
            line.style.whiteSpace = "pre-line";
            content.appendChild(line);
          });
          marker.bindPopup(content);
          const tooltip = document.createElement("span");
          tooltip.textContent = items.map(label).join(", ");
          marker.bindTooltip(tooltip, { direction: "top" });
        });
        if (points.length) map.fitBounds(
          L.latLngBounds(points.map(({ point }) => [point.lat, point.lon] as Leaflet.LatLngTuple)),
          { padding: [35, 35], maxZoom: 14 },
        );
        else map.setView([16.2, 107.8], 6);
      }
      setStatus(
        missing.length
          ? `Không tìm được vị trí cho ${missing.length} địa điểm. Địa chỉ vẫn được liệt kê bên dưới.`
          : points.length ? "Đã hiển thị các địa điểm trên bản đồ." : "",
      );
    } catch {
      if (!controller.signal.aborted) setStatus("Không thể hiển thị bản đồ. Vui lòng thử lại.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (autoShow) void showLocations();
  }, [autoShow, stopKey]);
  return (
    <LocalizedTree>
      <div>
        {editable && <p className="muted">Bấm vào bản đồ để đặt ghim tại điểm triển khai.</p>}
        {stops.some((stop) => !stop.pin && stop.ward) && <p className="muted">Các điểm chưa đặt ghim được ước lượng theo xã/phường.</p>}
        {!editable && stops.length === 0 && <p className="notice">Chưa có địa điểm để hiển thị.</p>}
        {!editable && <ol className={routeMapStyles.routeStops}>
          {stops.map((stop, i) => (
            <li key={i}>
              <strong>
                {label(stop)}{!stop.title && `: ${stop.ward}, ${stop.province || province}`}
              </strong>
              <small>
                {[stop.date, stop.start, stop.detail].filter(Boolean).join(" · ")}
              </small>
              {stop.schedule?.map((entry, index) => <small key={index}>{entry}</small>)}
            </li>
          ))}
        </ol>}
        {status && (
          <p className="notice" role="status">
            {status}
          </p>
        )}
        <div
          ref={mapRef}
          className={routeMapStyles.routeMap}
          hidden={!stops.length && !editable}
          aria-label="Bản đồ địa điểm hoạt động"
        />
        <small>
          Dữ liệu © OpenStreetMap contributors.{" "}
          <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">
            Góp ý dữ liệu bản đồ
          </a>
          .
        </small>
      </div>
    </LocalizedTree>
  );
}
