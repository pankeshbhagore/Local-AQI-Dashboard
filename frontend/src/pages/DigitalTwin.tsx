import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ColumnLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { Map } from 'react-map-gl';
import { useQuery } from '@tanstack/react-query';
import { hotspotAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { aqiColor, aqiLabel } from '../components/Charts';

// No token required for Carto Basemaps!

const INITIAL_VIEW_STATE = {
  longitude: 77.2167,
  latitude: 28.6139,
  zoom: 10,
  pitch: 60,
  bearing: -20
};

export default function DigitalTwin() {
  const { isDark } = useTheme();
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const { data: hotspots } = useQuery({
    queryKey: ['hotspots'],
    queryFn: async () => {
      const res = await hotspotAPI.getAll();
      return res.data.hotspots;
    },
    refetchInterval: 30000,
  });

  // Mock highly granular data for the 3D twin (Normally this would come from a specific backend endpoint)
  const mockGranularData = (hotspots || []).flatMap((h: any) => 
    Array.from({ length: 20 }).map(() => ({
      position: [
        h.lng + (Math.random() - 0.5) * 0.05,
        h.lat + (Math.random() - 0.5) * 0.05
      ],
      aqi: h.aqi_calculated + (Math.random() - 0.5) * 50
    }))
  );

  const layers = [
    new HexagonLayer({
      id: 'hexagon-layer',
      data: mockGranularData,
      pickable: true,
      extruded: true,
      radius: 500,
      elevationScale: 50,
      getPosition: d => d.position,
      getElevationWeight: d => d.aqi,
      getColorWeight: d => d.aqi,
      colorRange: [
        [0, 228, 0],     // Good
        [255, 255, 0],   // Moderate
        [255, 126, 0],   // Unhealthy for Sensitive Groups
        [255, 0, 0],     // Unhealthy
        [143, 63, 151],  // Very Unhealthy
        [126, 0, 35]     // Hazardous
      ],
    })
  ];

  return (
    <div className={`p-4 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>
      <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
        Digital Twin & 3D Plume Modeling
      </h1>
      <p className="mb-4 text-sm opacity-80">
        Real-time 3D volumetric representation of pollution plumes using Deck.GL and Mapbox.
      </p>

      <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={true}
          layers={layers}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
        >
          <Map
            mapStyle={isDark ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"}
          />
        </DeckGL>
      </div>
    </div>
  );
}
