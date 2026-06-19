import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { aqiAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { aqiColor, aqiLabel, aqiBg, cardStyle } from '../components/Charts';

// ── Ward GPS coordinates (Bhopal/Dewas region) ────────────────────────────
const WARD_COORDS: Record<number, [number, number]> = {
  1:  [28.6292, 77.2182],  // Connaught Place
  2:  [28.6506, 77.2302],  // Chandni Chowk
  3:  [28.6469, 77.3153],  // Anand Vihar
  4:  [28.5355, 77.2731],  // Okhla Industrial Area
  5:  [28.5921, 77.0460],  // Dwarka
  6:  [28.7340, 77.1183],  // Rohini
  7:  [28.5696, 77.2433],  // Lajpat Nagar
  8:  [28.6921, 77.1579],  // Wazirpur Industrial
  9:  [28.5969, 77.2183],  // Lodhi Road
  10: [28.6694, 77.2889],  // Shahdara
  11: [28.6080, 77.0200],  // Najafgarh Road
  12: [28.7121, 77.1534],  // GTK Depot
  13: [28.6094, 77.2962],  // Mayur Vihar
  14: [28.5562, 77.1000],  // IGI Airport Area
  15: [28.5197, 77.1545],  // Vasant Kunj
};

// ── 4 Map tile themes ─────────────────────────────────────────────────────
const MAP_THEMES = [
  {
    id: 'standard',
    label: '🗺 Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    description: 'Default street map',
  },
  {
    id: 'dark',
    label: '🌑 Dark',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    attribution: '© Stadia Maps, © OpenMapTiles, © OpenStreetMap',
    description: 'Dark mode for night viewing',
  },
  {
    id: 'satellite',
    label: '🛰 Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
    description: 'Satellite imagery',
  },
  {
    id: 'terrain',
    label: '⛰ Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap, © OpenStreetMap',
    description: 'Topographic terrain map',
  },
];

export default function WardMap() {
  const mapRef         = useRef<any>(null);
  const layerGroupRef  = useRef<any>(null);
  const tileLayerRef   = useRef<any>(null);
  const mapContainerRef= useRef<HTMLDivElement>(null);

  const [selected,   setSelected]  = useState<any>(null);
  const [mapTheme,   setMapTheme]  = useState(MAP_THEMES[0]);
  const [leafletReady, setLeafletReady] = useState(false);
  const { cityAQI }  = useSocket();
  const { isDark }   = useTheme();

  const { data: mapData, isLoading } = useQuery({
    queryKey: ['wardMapLeaflet'],
    queryFn:  () => aqiAPI.getMap().then(r => r.data),
    refetchInterval: 60000,
  });

  const wards = (mapData?.features || []).map((f: any) => ({
    ...f.properties,
    aqi: cityAQI[f.properties.id] ?? f.properties.aqi ?? 0,
    lat: WARD_COORDS[f.properties.id]?.[0] ?? 23.26,
    lng: WARD_COORDS[f.properties.id]?.[1] ?? 77.41,
  }));

  // ── Load Leaflet dynamically ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id    = 'leaflet-css';
      link.rel   = 'stylesheet';
      link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Load Leaflet JS
    const script = document.createElement('script');
    script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    if (!(window as any).L) {
      document.head.appendChild(script);
    } else {
      setLeafletReady(true);
    }
  }, []);

  // ── Initialise map once Leaflet is ready ──────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapRef.current) return;
    const L = (window as any).L;

    // Init map centered on Bhopal region
    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090],
      zoom:   11,
      zoomControl: true,
    });
    mapRef.current = map;

    // Add initial tile layer
    const tile = L.tileLayer(MAP_THEMES[0].url, {
      attribution: MAP_THEMES[0].attribution,
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tile;

    // Layer group for markers
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => { map.remove(); mapRef.current = null; };
  }, [leafletReady]);

  // ── Switch map theme ──────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const L = (window as any).L;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(mapTheme.url, {
      attribution: mapTheme.attribution,
      maxZoom: 19,
    }).addTo(mapRef.current);
  }, [mapTheme, leafletReady]);

  // ── Update ward markers when data changes ─────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !layerGroupRef.current) return;
    const L = (window as any).L;
    layerGroupRef.current.clearLayers();

    wards.forEach((w: any) => {
      const color  = aqiColor(w.aqi);
      const radius = Math.max(18, Math.min(40, (w.aqi / 10)));

      // Custom circle marker with AQI number
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:${radius * 2}px; height:${radius * 2}px;
            border-radius:50%; background:${color}22;
            border:3px solid ${color};
            display:flex; align-items:center; justify-content:center;
            font-weight:700; font-size:${radius > 25 ? 13 : 11}px;
            color:${color}; font-family:sans-serif;
            box-shadow:0 2px 8px ${color}44;
            cursor:pointer;
          ">${w.aqi || '?'}</div>
        `,
        iconSize:   [radius * 2, radius * 2],
        iconAnchor: [radius, radius],
      });

      const marker = L.marker([w.lat, w.lng], { icon })
        .addTo(layerGroupRef.current)
        .bindPopup(`
          <div style="min-width:180px;font-family:sans-serif">
            <div style="font-size:15px;font-weight:700;color:${color};margin-bottom:6px">${w.name}</div>
            <div style="font-size:26px;font-weight:800;color:${color};line-height:1">${w.aqi || '—'}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">${aqiLabel(w.aqi)} · AQI</div>
            <table style="font-size:12px;width:100%;border-collapse:collapse">
              <tr><td style="color:#64748b;padding:3px 0">PM2.5</td><td style="text-align:right;font-weight:500">${w.pm25 ? Number(w.pm25).toFixed(1) + ' µg/m³' : '—'}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">PM10</td><td style="text-align:right;font-weight:500">${w.pm10 ? Number(w.pm10).toFixed(1) + ' µg/m³' : '—'}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Zone</td><td style="text-align:right;font-weight:500">${w.zone || '—'}</td></tr>
              <tr><td style="color:#64748b;padding:3px 0">Sensors</td><td style="text-align:right;font-weight:500">${w.activeSensors ?? '—'} active</td></tr>
            </table>
          </div>
        `)
        .on('click', () => setSelected(w));

      // Pulse animation for critical wards
      if (w.aqi > 200) {
        const pulse = L.circle([w.lat, w.lng], {
          radius:      radius * 20,
          color:       color,
          fillColor:   color,
          fillOpacity: 0.06,
          weight:      1,
          opacity:     0.4,
        }).addTo(layerGroupRef.current);
      }
    });
  }, [wards, leafletReady]);

  const txt   = isDark ? '#e2e8f0' : '#0f172a';
  const muted = isDark ? '#64748b' : '#94a3b8';
  const bg    = isDark ? '#0d1f35' : '#ffffff';
  const bord  = isDark ? 'rgba(0,180,220,.15)' : 'rgba(0,0,0,.08)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 18, color: txt, fontWeight: 600 }}>Ward Pollution Map</div>

      {/* Map theme selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {MAP_THEMES.map(t => (
          <button key={t.id} onClick={() => setMapTheme(t)}
            style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              fontWeight: mapTheme.id === t.id ? 600 : 400, border: 'none',
              background: mapTheme.id === t.id
                ? (isDark ? 'rgba(0,180,220,.2)' : 'rgba(14,165,233,.15)')
                : (isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'),
              color: mapTheme.id === t.id
                ? (isDark ? '#00d4ff' : '#0ea5e9')
                : muted,
              boxShadow: mapTheme.id === t.id
                ? (isDark ? '0 0 0 1px rgba(0,180,220,.4)' : '0 0 0 1px rgba(14,165,233,.4)')
                : 'none',
            }}>
            {t.label}
          </button>
        ))}
        <span style={{ fontSize: 11, color: muted, alignSelf: 'center', marginLeft: 4 }}>
          {mapTheme.description}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
        {/* Leaflet Map */}
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${bord}`, boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,.08)' }}>
          {!leafletReady && (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color: muted }}>
              Loading map…
            </div>
          )}
          <div ref={mapContainerRef} style={{ height: 500, display: leafletReady ? 'block' : 'none' }} />

          {/* AQI legend overlay */}
          <div style={{
            position: 'absolute', bottom: 28, left: 10, zIndex: 1000,
            background: isDark ? 'rgba(4,13,26,.9)' : 'rgba(255,255,255,.92)',
            border: `1px solid ${bord}`, borderRadius: 8, padding: '8px 10px',
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>AQI Scale</div>
            {[
              { c:'#16a34a', l:'Good (0-50)'           },
              { c:'#2563eb', l:'Satisfactory (51-100)'  },
              { c:'#d97706', l:'Moderate (101-200)'     },
              { c:'#ea580c', l:'Poor (201-300)'         },
              { c:'#dc2626', l:'Very Poor (300+)'       },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.c, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#475569' }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ward Detail Panel */}
        <div>
          {/* Summary stats */}
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>City Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { l: 'Total Wards',    v: wards.length },
                { l: 'Critical (>200)', v: wards.filter((w:any) => w.aqi > 200).length, c: '#dc2626' },
                { l: 'Moderate (>100)', v: wards.filter((w:any) => w.aqi > 100 && w.aqi <= 200).length, c: '#d97706' },
                { l: 'Good (≤100)',    v: wards.filter((w:any) => w.aqi <= 100 && w.aqi > 0).length, c: '#16a34a' },
              ].map(s => (
                <div key={s.l} style={{ background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: muted }}>{s.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.c || txt }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected ward detail */}
          <div style={{ ...cardStyle, minHeight: 200 }}>
            {selected ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, color: txt, fontWeight: 600 }}>{selected.name}</div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 52, fontWeight: 800, color: aqiColor(selected.aqi), lineHeight: 1 }}>{selected.aqi || '—'}</div>
                  <div style={{ fontSize: 13, color: aqiColor(selected.aqi) }}>AQI</div>
                </div>
                <div style={{ display: 'inline-block', fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600, marginBottom: 16, background: aqiBg(selected.aqi), color: aqiColor(selected.aqi) }}>
                  {aqiLabel(selected.aqi)}
                </div>
                {[
                  ['PM2.5',          selected.pm25 ? `${Number(selected.pm25).toFixed(1)} µg/m³` : '—'],
                  ['PM10',           selected.pm10 ? `${Number(selected.pm10).toFixed(1)} µg/m³` : '—'],
                  ['Zone',           selected.zone           ?? '—'],
                  ['Active Sensors', selected.activeSensors  ?? '—'],
                  ['Last Updated',   selected.lastUpdated ? new Date(selected.lastUpdated).toLocaleTimeString() : '—'],
                ].map(([l, v]) => (
                  <div key={String(l)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${bord}`, fontSize: 12 }}>
                    <span style={{ color: muted }}>{l}</span>
                    <span style={{ color: txt, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                <button
                  onClick={() => { if (mapRef.current && WARD_COORDS[selected.id]) { mapRef.current.flyTo(WARD_COORDS[selected.id], 14); } }}
                  style={{ marginTop: 14, width: '100%', padding: '8px', background: isDark ? 'rgba(0,180,220,.1)' : 'rgba(14,165,233,.1)', border: `1px solid ${isDark ? 'rgba(0,180,220,.3)' : 'rgba(14,165,233,.3)'}`, color: isDark ? '#00d4ff' : '#0ea5e9', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                  🗺 Zoom to Ward
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: muted, padding: '30px 0', lineHeight: 1.8 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📍</div>
                <div style={{ fontSize: 14, color: txt, marginBottom: 4 }}>Click a ward marker</div>
                <div style={{ fontSize: 12 }}>on the map to see<br/>detailed AQI data</div>
              </div>
            )}
          </div>

          {/* Ward quick list */}
          {wards.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 12, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>All Wards</div>
              {[...wards].sort((a: any, b: any) => (b.aqi || 0) - (a.aqi || 0)).map((w: any) => (
                <div key={w.id} onClick={() => {
                    setSelected(w);
                    if (mapRef.current && WARD_COORDS[w.id]) mapRef.current.flyTo(WARD_COORDS[w.id], 14);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${bord}`, cursor: 'pointer' }}>
                  <span style={{ fontSize: 12, color: txt }}>{w.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: aqiColor(w.aqi || 0) }}>{w.aqi || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && wards.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 14, color: txt, marginBottom: 6 }}>No ward data yet</div>
          <div style={{ fontSize: 12, color: muted }}>Run <code>node tools/sensor-simulator.js</code> to start live data</div>
        </div>
      )}
    </div>
  );
}
