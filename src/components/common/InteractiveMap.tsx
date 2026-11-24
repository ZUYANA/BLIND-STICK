import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Coordinates, NavigationRoute, PlacePOI } from '../../types';
import { CHIKKAMAGALURU_COORDS, CKM_CITY_BOUNDS, CKM_KNOWN_PLACES } from '../../services/placesService';
import {
  Compass,
  Layers,
  MapPin,
  Navigation,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Key,
  Maximize2,
  CheckCircle2,
  Info,
  Map as MapIcon
} from 'lucide-react';

// Fix Leaflet default icon URL issues in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export type MapTileStyle = 'google_roadmap' | 'google_satellite' | 'google_terrain' | 'osm_voyager';

interface InteractiveMapProps {
  currentLocation?: Coordinates;
  route?: NavigationRoute | null;
  destination?: PlacePOI | null;
  heading?: number;
  obstacleDetected?: boolean;
  obstacleDistanceCm?: number;
  onRecalculateRoute?: () => void;
  className?: string;
  showNearbyPOIs?: boolean;
  interactive?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  currentLocation = CHIKKAMAGALURU_COORDS,
  route,
  destination,
  heading = 0,
  obstacleDetected = false,
  obstacleDistanceCm,
  onRecalculateRoute,
  className = 'h-full w-full',
  showNearbyPOIs = true,
  interactive = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const poiLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [followUser, setFollowUser] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapTileStyle>(() => {
    return (localStorage.getItem('stick_map_tile_style') as MapTileStyle) || 'google_roadmap';
  });
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return (
      localStorage.getItem('stick_google_maps_api_key') ||
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    );
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tile layer URLs
  const getTileUrl = (style: MapTileStyle) => {
    switch (style) {
      case 'google_roadmap':
        // Real Google Maps Roadmap tiles (lyrs=m)
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      case 'google_satellite':
        // Real Google Maps Satellite Hybrid (lyrs=y: satellite + labels)
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'google_terrain':
        // Real Google Maps Terrain (lyrs=p)
        return 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      case 'osm_voyager':
      default:
        return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
  };

  const getSubdomains = (style: MapTileStyle) => {
    return style.startsWith('google') ? ['mt0', 'mt1', 'mt2', 'mt3'] : ['a', 'b', 'c', 'd'];
  };

  const getAttribution = (style: MapTileStyle) => {
    return style.startsWith('google')
      ? 'Map data © Google · Chikkamagaluru STICK Engine'
      : 'Map data © OpenStreetMap contributors, CartoDB';
  };

  // Center and fit the whole of Chikkamagaluru city
  const fitWholeChikkamagaluru = () => {
    setFollowUser(false);
    if (mapInstanceRef.current) {
      const bounds = L.latLngBounds(
        [CKM_CITY_BOUNDS.southWest.lat, CKM_CITY_BOUNDS.southWest.lng],
        [CKM_CITY_BOUNDS.northEast.lat, CKM_CITY_BOUNDS.northEast.lng]
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [CKM_CITY_BOUNDS.center.lat, CKM_CITY_BOUNDS.center.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });

      const initialUrl = getTileUrl(mapStyle);
      const tileLayer = L.tileLayer(initialUrl, {
        maxZoom: 20,
        subdomains: getSubdomains(mapStyle),
        attribution: getAttribution(mapStyle)
      }).addTo(map);

      activeTileLayerRef.current = tileLayer;

      // Attribution
      L.control
        .attribution({ position: 'bottomright', prefix: 'STICK Navigation' })
        .addTo(map);

      mapInstanceRef.current = map;
      poiLayerGroupRef.current = L.layerGroup().addTo(map);

      // Invalidate size to guarantee no blank screen
      setTimeout(() => {
        map.invalidateSize();
        fitWholeChikkamagaluru();
      }, 150);

      setTimeout(() => {
        map.invalidateSize();
      }, 500);

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  // Update Tile Layer when user switches style (Google Road, Google Satellite, OSM)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (activeTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(activeTileLayerRef.current);
    }

    const newUrl = getTileUrl(mapStyle);
    const newTileLayer = L.tileLayer(newUrl, {
      maxZoom: 20,
      subdomains: getSubdomains(mapStyle),
      attribution: getAttribution(mapStyle)
    }).addTo(mapInstanceRef.current);

    activeTileLayerRef.current = newTileLayer;
    mapInstanceRef.current.invalidateSize();
    localStorage.setItem('stick_map_tile_style', mapStyle);
  }, [mapStyle]);

  // Update User Location Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const userIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 38px; height: 38px; background: rgba(56, 189, 248, 0.45); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 24px; height: 24px; background: #0284c7; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
          </div>
          <div style="position: absolute; top: -7px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 10px solid #0284c7; transform: rotate(${heading}deg);"></div>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([currentLocation.lat, currentLocation.lng], { icon: userIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup('<b>Current Position</b><br>Chikkamagaluru, India');
    } else {
      userMarkerRef.current.setLatLng([currentLocation.lat, currentLocation.lng]);
      userMarkerRef.current.setIcon(userIcon);
    }

    if (followUser && !route) {
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 16);
    }
  }, [currentLocation, heading, followUser, route]);

  // Update Destination Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const targetCoords = route?.destinationCoords || (destination ? { lat: destination.lat, lng: destination.lng } : null);

    if (targetCoords) {
      const destIcon = L.divIcon({
        className: 'dest-location-marker',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 28px; height: 28px; background: #ef4444; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.8); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const label = route?.destinationName || destination?.name || 'Destination';

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([targetCoords.lat, targetCoords.lng], { icon: destIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b>${label}</b>`);
      } else {
        destMarkerRef.current.setLatLng([targetCoords.lat, targetCoords.lng]);
        destMarkerRef.current.setIcon(destIcon);
        destMarkerRef.current.setPopupContent(`<b>${label}</b>`);
      }
    } else if (destMarkerRef.current) {
      mapInstanceRef.current.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }
  }, [route, destination]);

  // Update Blue Pedestrian Route Polyline
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (route && route.geometry && route.geometry.length > 0) {
      const latlngs: L.LatLngExpression[] = route.geometry.map(c => [c.lat, c.lng]);

      if (!routePolylineRef.current) {
        routePolylineRef.current = L.polyline(latlngs, {
          color: '#0284c7',
          weight: 6,
          opacity: 0.95,
          lineJoin: 'round',
          dashArray: '8, 8'
        }).addTo(mapInstanceRef.current);
      } else {
        routePolylineRef.current.setLatLngs(latlngs);
      }

      const bounds = L.latLngBounds(latlngs);
      bounds.extend([currentLocation.lat, currentLocation.lng]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
    } else if (routePolylineRef.current) {
      mapInstanceRef.current.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
  }, [route, currentLocation]);

  // Render All Landmarks across the Entire Chikkamagaluru City
  useEffect(() => {
    if (!mapInstanceRef.current || !poiLayerGroupRef.current) return;

    poiLayerGroupRef.current.clearLayers();

    if (showNearbyPOIs && !route) {
      CKM_KNOWN_PLACES.forEach(place => {
        const isHospital = place.category.includes('Hospital');
        const isTransit = place.category.includes('Bus') || place.category.includes('Railway');

        const badgeColor = isHospital ? '#ef4444' : isTransit ? '#f59e0b' : '#38bdf8';

        const poiIcon = L.divIcon({
          className: 'ckm-poi-marker',
          html: `
            <div style="background: rgba(15, 23, 42, 0.92); border: 2px solid ${badgeColor}; border-radius: 8px; padding: 3px 6px; font-size: 11px; font-weight: bold; color: #ffffff; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 5px; backdrop-filter: blur(4px);">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${badgeColor};"></span>
              ${place.name.length > 22 ? place.name.substring(0, 20) + '...' : place.name}
            </div>
          `,
          iconSize: [140, 24],
          iconAnchor: [70, 12]
        });

        const marker = L.marker([place.lat, place.lng], { icon: poiIcon }).bindPopup(`
          <div style="font-family: inherit; min-width: 180px;">
            <b style="font-size: 13px; color: #f8fafc;">${place.name}</b><br>
            <span style="color: ${badgeColor}; font-size: 11px; font-weight: 700;">${place.category}</span><br>
            <span style="color: #cbd5e1; font-size: 11px;">${place.address || 'Chikkamagaluru, Karnataka'}</span>
          </div>
        `);

        poiLayerGroupRef.current?.addLayer(marker);
      });
    }
  }, [showNearbyPOIs, route]);

  const handleSaveApiKey = () => {
    localStorage.setItem('stick_google_maps_api_key', googleApiKey.trim());
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowConfigModal(false);
    }, 1200);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-700/60 shadow-2xl ${className}`}
      style={{ minHeight: '480px', height: '100%', width: '100%' }}
    >
      {/* Map DOM Element */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ minHeight: '480px', height: '100%', width: '100%' }}
      />

      {/* Top Banner: Active Map Status */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs">
        <MapPin className="w-4 h-4 text-sky-400 flex-shrink-0" />
        <span className="font-bold text-white">Chikkamagaluru (CKM)</span>
        <span className="text-[10px] text-sky-300 bg-sky-950 border border-sky-800 px-2 py-0.5 rounded font-medium">
          {mapStyle === 'google_roadmap'
            ? 'Google Maps'
            : mapStyle === 'google_satellite'
            ? 'Google Satellite'
            : mapStyle === 'google_terrain'
            ? 'Google Terrain'
            : 'OpenStreetMap'}
        </span>
      </div>

      {/* Obstacle Alert Overlay Banner */}
      {obstacleDetected && (
        <div className="absolute top-12 left-3 right-3 z-20 flex items-center gap-3 bg-red-600/95 text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-red-300 animate-pulse">
          <AlertTriangle className="w-7 h-7 flex-shrink-0 text-yellow-300" />
          <div className="flex-1">
            <p className="font-bold text-sm tracking-wide">OBSTACLE DETECTED AHEAD</p>
            <p className="text-xs text-red-100">
              {obstacleDistanceCm ? `${obstacleDistanceCm} cm away · Front steering paused` : 'Stop walking · Scan path'}
            </p>
          </div>
        </div>
      )}

      {/* Floating Route Info Overlay */}
      {route && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-900/95 backdrop-blur-md border border-sky-500/40 p-4 rounded-xl shadow-2xl flex items-center justify-between">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Navigation className="w-3.5 h-3.5" />
              <span>{route.isRandomWalk ? 'Safe Pedestrian Loop' : 'Walking Navigation'}</span>
            </div>
            <h4 className="font-bold text-slate-100 text-base truncate">{route.destinationName}</h4>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-300">
              <span className="font-mono text-sky-400 font-bold">{route.distanceMeters} m</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">
                {Math.max(1, Math.round(route.durationSeconds / 60))} min walk
              </span>
            </div>
          </div>

          {onRecalculateRoute && (
            <button
              onClick={onRecalculateRoute}
              aria-label="Recalculate Route"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-sky-900 text-sky-300 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reroute</span>
            </button>
          )}
        </div>
      )}

      {/* Map Control Buttons */}
      {interactive && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          {/* Fit Whole Chikkamagaluru (CKM) City Button */}
          <button
            onClick={fitWholeChikkamagaluru}
            title="View Whole Chikkamagaluru City (North to South)"
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-xl border border-sky-400 text-xs font-bold transition"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Whole CKM</span>
          </button>

          {/* Quick Toggle to Google Map Roadmap */}
          <button
            onClick={() => setMapStyle('google_roadmap')}
            title="Switch to Google Maps"
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border shadow-lg transition ${
              mapStyle === 'google_roadmap'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            Google Map
          </button>

          {/* Quick Toggle to Google Satellite */}
          <button
            onClick={() => setMapStyle('google_satellite')}
            title="Switch to Google Satellite View"
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border shadow-lg transition ${
              mapStyle === 'google_satellite'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            Satellite
          </button>

          {/* Follow User / Center */}
          <button
            onClick={() => {
              setFollowUser(true);
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 16);
              }
            }}
            title="Center on My GPS Location"
            className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition ${
              followUser
                ? 'bg-sky-500 text-white border-sky-400'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-5 h-5" />
          </button>

          {/* Zoom In */}
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            className="p-2.5 bg-slate-900/90 text-slate-300 border border-slate-700 rounded-xl shadow-lg hover:text-white hover:bg-slate-800 transition"
          >
            <ZoomIn className="w-5 h-5" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            className="p-2.5 bg-slate-900/90 text-slate-300 border border-slate-700 rounded-xl shadow-lg hover:text-white hover:bg-slate-800 transition"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          {/* Map Layer / API Key Modal Trigger */}
          <button
            onClick={() => setShowConfigModal(true)}
            title="Map Layers & Google Maps API Key Setup"
            className="p-2.5 bg-slate-900/90 text-yellow-400 border border-yellow-500/50 rounded-xl shadow-lg hover:bg-slate-800 transition"
          >
            <Key className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Map Provider & API Key Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl text-left">
            <h3 className="text-xl font-bold text-slate-100 mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-yellow-400" />
              Google Map & API Key Manager
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              STICK displays real Google Maps layers and pedestrian routes across the entire Chikkamagaluru region.
            </p>

            {/* Layer Selection */}
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Active Map Provider:
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMapStyle('google_roadmap')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  mapStyle === 'google_roadmap'
                    ? 'border-emerald-500 bg-emerald-950/50 text-white font-bold'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs text-emerald-400 font-bold">Google Maps</div>
                <div className="text-[10px] text-slate-400">Roadmap & Streets</div>
              </button>

              <button
                type="button"
                onClick={() => setMapStyle('google_satellite')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  mapStyle === 'google_satellite'
                    ? 'border-emerald-500 bg-emerald-950/50 text-white font-bold'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs text-emerald-400 font-bold">Google Satellite</div>
                <div className="text-[10px] text-slate-400">Hybrid Satellite Imagery</div>
              </button>

              <button
                type="button"
                onClick={() => setMapStyle('google_terrain')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  mapStyle === 'google_terrain'
                    ? 'border-emerald-500 bg-emerald-950/50 text-white font-bold'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs text-emerald-400 font-bold">Google Terrain</div>
                <div className="text-[10px] text-slate-400">Hills & Topography</div>
              </button>

              <button
                type="button"
                onClick={() => setMapStyle('osm_voyager')}
                className={`p-2.5 rounded-xl border text-left transition ${
                  mapStyle === 'osm_voyager'
                    ? 'border-sky-500 bg-sky-950/50 text-white font-bold'
                    : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs text-sky-400 font-bold">OpenStreetMap</div>
                <div className="text-[10px] text-slate-400">High Contrast Carto</div>
              </button>
            </div>

            {/* Google Cloud API Key (Optional) */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Google Cloud API Key (Optional)</span>
                {googleApiKey && <span className="text-[10px] text-emerald-400">Key Configured</span>}
              </label>
              <input
                type="text"
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
                placeholder="AIzaSy... (leave blank to use direct Google Maps tiles)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-yellow-300 placeholder-slate-600 focus:border-yellow-500 outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Notice: Google Maps roadmap and satellite views work immediately above with zero key required!
              </p>
            </div>

            {/* Coverage Summary */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl mb-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold">
                <Info className="w-3.5 h-3.5" />
                <span>Chikkamagaluru Coverage: Complete City</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Center: 13.3161° N, 75.7720° E. Covers District Hospital, KSRTC Bus Stand, Railway Station, Rathnagiri,
                Azad Park, MG Road, Housing Board, and peripheral roads.
              </p>
            </div>

            {saveSuccess && (
              <div className="mb-3 text-xs text-emerald-400 bg-emerald-950/60 p-2 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Settings applied successfully!</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                Apply & Save
              </button>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
