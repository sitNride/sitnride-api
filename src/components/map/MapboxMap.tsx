import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapboxToken, setMapboxTokenOverride } from '@/lib/mapboxToken';


interface Location {
  lat: number;
  lng: number;
  address?: string;
}





interface MapboxMapProps {
  pickup?: Location | null;
  dropoff?: Location | null;
  driverLocation?: Location | null;
  onPickupChange?: (location: Location) => void;
  onDropoffChange?: (location: Location) => void;
  showRoute?: boolean;
  interactive?: boolean;
  height?: string;
  isDriver?: boolean;
  onNavigate?: () => void;
  onRouteCalculated?: (distance: number, duration: number) => void;
}

interface RouteInfo {
  distance: number;
  duration: number;
  geometry: any;
}



function computeCenter(
  p: Location | null | undefined,
  d: Location | null | undefined
) {
  if (p) return [p.lng, p.lat] as [number, number];
  if (d) return [d.lng, d.lat] as [number, number];
  return [-74.006, 40.7128] as [number, number];
}

function MapboxMap(props: MapboxMapProps) {
  var pickup = props.pickup || null;
  var dropoff = props.dropoff || null;
  var driverLocation = props.driverLocation || null;
  var onPickupChange = props.onPickupChange;
  var onDropoffChange = props.onDropoffChange;
  var showRoute = props.showRoute === true;
  var interactive = props.interactive !== false;
  var height = props.height || '400px';
  var isDriver = props.isDriver === true;
  var onNavigate = props.onNavigate;
  var onRouteCalculated = props.onRouteCalculated;

  var mapContainer = useRef<HTMLDivElement>(null);
  var mapRef = useRef<mapboxgl.Map | null>(null);
  var pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  var dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  var driverMarkerRef = useRef<mapboxgl.Marker | null>(null);

  var [mapLoaded, setMapLoaded] = useState(false);
  var [mapError, setMapError] = useState('');
  var [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  var [tokenInput, setTokenInput] = useState('');
  var [tokenSaveError, setTokenSaveError] = useState('');


  var pickupRef = useRef(pickup);
  var dropoffRef = useRef(dropoff);
  var onPickupChangeRef = useRef(onPickupChange);
  var onDropoffChangeRef = useRef(onDropoffChange);
  var onRouteCalculatedRef = useRef(onRouteCalculated);
  var interactiveRef = useRef(interactive);

  useEffect(function() { pickupRef.current = pickup; }, [pickup]);
  useEffect(function() { dropoffRef.current = dropoff; }, [dropoff]);
  useEffect(function() { onPickupChangeRef.current = onPickupChange; }, [onPickupChange]);
  useEffect(function() { onDropoffChangeRef.current = onDropoffChange; }, [onDropoffChange]);
  useEffect(function() { onRouteCalculatedRef.current = onRouteCalculated; }, [onRouteCalculated]);
  useEffect(function() { interactiveRef.current = interactive; }, [interactive]);

  var reverseGeocode = useCallback(async function(lng: number, lat: number) {
    var token = getMapboxToken();
    if (!token) return lat.toFixed(4) + ', ' + lng.toFixed(4);
    try {
      var resp = await fetch(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' + lng + ',' + lat + '.json?access_token=' + token
      );
      var data = await resp.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].place_name as string;
      }
    } catch (e) {
      /* silent */
    }
    return lat.toFixed(4) + ', ' + lng.toFixed(4);
  }, []);

  var reverseGeocodeRef = useRef(reverseGeocode);
  reverseGeocodeRef.current = reverseGeocode;

  var initMap = useCallback(function(container: HTMLDivElement, center: [number, number]) {
    var token = getMapboxToken();
    if (!token) {
      setMapError('Mapbox access token is missing. Please configure VITE_MAPBOX_ACCESS_TOKEN.');
      return null;
    }

    try {
      var newMap = new mapboxgl.Map({
        container: container,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: 13,
        attributionControl: false,
        accessToken: token,
      });

      newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

      newMap.on('load', function() {
        setMapLoaded(true);
        setMapError('');
        newMap.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [] }
          }
        });
        newMap.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#f97316', 'line-width': 5, 'line-opacity': 0.8 }
        });
      });

      newMap.on('error', function(e: any) {
        var msg = String(e.error?.message || e.message || 'Unknown');
        console.warn('[MapboxMap] error:', msg);
        var low = msg.toLowerCase();
        if (low.includes('access token') || low.includes('unauthorized') || low.includes('forbidden')) {
          setMapError('Map authentication failed. Check your Mapbox token.');
        }
      });


      newMap.on('click', async function(e: mapboxgl.MapMouseEvent) {
        if (!interactiveRef.current) return;
        if (!onPickupChangeRef.current && !onDropoffChangeRef.current) return;

        var ll = e.lngLat;
        var addr = await reverseGeocodeRef.current(ll.lng, ll.lat);
        var loc = { lat: ll.lat, lng: ll.lng, address: addr };

        if (!pickupRef.current && onPickupChangeRef.current) {
          onPickupChangeRef.current(loc);
        } else if (pickupRef.current && !dropoffRef.current && onDropoffChangeRef.current) {
          onDropoffChangeRef.current(loc);
        } else if (pickupRef.current && dropoffRef.current && onDropoffChangeRef.current) {
          onDropoffChangeRef.current(loc);
        }
      });

      return newMap;
    } catch (err: any) {
      setMapError('Failed to create map: ' + String(err?.message || err));
      return null;
    }
  }, []);

  // Initialize map
  useEffect(function() {
    if (typeof window === 'undefined') return;
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    var center = computeCenter(pickup, driverLocation);
    var newMap = initMap(mapContainer.current, center);
    if (newMap) {
      mapRef.current = newMap;
    }

    return function() {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update pickup marker
  useEffect(function() {
    if (!mapLoaded || !mapRef.current) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (pickup) {
      var el = document.createElement('div');
      el.className = 'pickup-marker';
      el.innerHTML = '<div style="width:32px;height:32px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>';

      pickupMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(mapRef.current);

      if (!dropoff) {
        mapRef.current.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14, duration: 1000 });
      }
    }
  }, [pickup, mapLoaded]);

  // Update dropoff marker
  useEffect(function() {
    if (!mapLoaded || !mapRef.current) return;

    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    if (dropoff) {
      var el = document.createElement('div');
      el.className = 'dropoff-marker';
      el.innerHTML = '<div style="width:32px;height:32px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg></div>';

      dropoffMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(mapRef.current);
    }
  }, [dropoff, mapLoaded]);

  // Fit map to show both pickup and dropoff when both are set (even before route)
  useEffect(function() {
    if (!mapLoaded || !mapRef.current) return;
    if (!pickup || !dropoff) return;

    var bounds = new mapboxgl.LngLatBounds(
      [pickup.lng, pickup.lat],
      [dropoff.lng, dropoff.lat]
    );
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 1000 });
  }, [pickup, dropoff, mapLoaded]);

  // Update driver marker
  useEffect(function() {
    if (!mapLoaded || !mapRef.current) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }

    if (driverLocation) {
      var el = document.createElement('div');
      el.className = 'driver-marker';
      el.innerHTML = '<div style="width:40px;height:40px;background:#f97316;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg></div>';

      driverMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(mapRef.current);

      if (isDriver) {
        mapRef.current.flyTo({ center: [driverLocation.lng, driverLocation.lat], zoom: 15, duration: 500 });
      }
    }
  }, [driverLocation, mapLoaded, isDriver]);

  // Fetch and draw route
  useEffect(function() {
    if (!mapLoaded || !mapRef.current) return;

    var start = isDriver && driverLocation ? driverLocation : pickup;
    var end = isDriver ? pickup : dropoff;

    if (!start || !end) {
      // Clear route line if locations are removed
      var source = mapRef.current.getSource('route') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [] }
        });
      }
      setRouteInfo(null);
      return;
    }

    var token = getMapboxToken();
    if (!token) return;

    var cancelled = false;

    var doFetch = async function() {
      try {
        var url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
          start!.lng + ',' + start!.lat + ';' + end!.lng + ',' + end!.lat +
          '?geometries=geojson&overview=full&access_token=' + token;

        var resp = await fetch(url);
        var data = await resp.json();

        if (cancelled) return;

        if (data.routes && data.routes.length > 0) {
          var route = data.routes[0];
          var distMiles = route.distance / 1609.34;
          var durMins = route.duration / 60;

          setRouteInfo({
            distance: distMiles,
            duration: durMins,
            geometry: route.geometry
          });

          if (onRouteCalculatedRef.current) {
            onRouteCalculatedRef.current(distMiles, durMins);
          }

          var routeSource = mapRef.current!.getSource('route') as mapboxgl.GeoJSONSource;
          if (routeSource) {
            routeSource.setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry
            });
          }

          var coords = route.geometry.coordinates;
          var bounds = coords.reduce(
            function(b: mapboxgl.LngLatBounds, coord: [number, number]) { return b.extend(coord); },
            new mapboxgl.LngLatBounds(coords[0], coords[0])
          );

          mapRef.current!.fitBounds(bounds, { padding: 60, duration: 1000 });
        }
      } catch (error) {
        /* silent */
      }
    };

    doFetch();

    return function() { cancelled = true; };
  }, [pickup, dropoff, driverLocation, mapLoaded, isDriver]);

  var handleRetry = function() {
    setMapError('');
    setMapLoaded(false);
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    setTimeout(function() {
      if (!mapContainer.current) return;
      var center = computeCenter(pickup, driverLocation);
      var newMap = initMap(mapContainer.current, center);
      if (newMap) {
        mapRef.current = newMap;
      }
    }, 100);
  };

  var handleSaveToken = function() {
    setTokenSaveError('');
    var raw = (tokenInput || '').trim();
    if (!raw) {
      setTokenSaveError('Please paste a Mapbox public token (starts with "pk.").');
      return;
    }
    if (!raw.startsWith('pk.')) {
      setTokenSaveError('That doesn\u2019t look like a public Mapbox token. It must start with "pk."');
      return;
    }
    var ok = setMapboxTokenOverride(raw);
    if (!ok) {
      setTokenSaveError('Could not save token (storage may be disabled).');
      return;
    }
    setTokenInput('');
    handleRetry();
  };

  // Detect missing-token state so we can show the in-UI recovery prompt.
  var isMissingTokenError = /access token|authentication failed|configure VITE_MAPBOX/i.test(mapError);



  return (
    <div className="relative" style={{ height: height }}>
      <div
        ref={mapContainer}
        style={{ width: '100%', height: height || "400px" }}
        className="rounded-xl overflow-hidden"
      />

      {mapError && (
        <div className="absolute inset-0 bg-gray-50/95 backdrop-blur-sm rounded-xl flex items-center justify-center z-20 overflow-auto">
          <div className="text-center p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-gray-800 font-medium mb-1">Map Loading Issue</p>
            <p className="text-gray-500 text-sm mb-4">{mapError}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              Retry
            </button>

            {isMissingTokenError && (
              <div className="mt-5 pt-5 border-t border-gray-200 text-left">
                <p className="text-xs font-semibold text-gray-700 mb-1">Quick recovery</p>
                <p className="text-xs text-gray-500 mb-2">
                  Paste your public Mapbox token (starts with <code className="font-mono">pk.</code>) to restore the map without a redeploy. Saved locally to this browser.
                </p>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={function(e) { setTokenInput(e.target.value); }}
                  placeholder="pk.eyJ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  autoComplete="off"
                  spellCheck={false}
                />
                {tokenSaveError && (
                  <p className="text-xs text-red-600 mb-2">{tokenSaveError}</p>
                )}
                <button
                  onClick={handleSaveToken}
                  className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-xs font-medium"
                >
                  Save token &amp; reload map
                </button>
                <p className="text-[10px] text-gray-400 mt-2 leading-snug">
                  Tip: you can also run in DevTools:
                  <br />
                  <code className="font-mono">localStorage.setItem('mapbox_token','pk.…'); location.reload();</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}


      {routeInfo && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-500">Distance</p>
              <p className="font-bold text-gray-900">{routeInfo.distance.toFixed(1)} mi</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-bold text-gray-900">{Math.round(routeInfo.duration)} min</p>
            </div>
          </div>
        </div>
      )}

      {isDriver && onNavigate && (
        <button
          onClick={onNavigate}
          className="absolute bottom-4 right-4 bg-orange-500 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-orange-600 transition-colors z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
          <span className="font-medium">Navigate</span>
        </button>
      )}

      {interactive && !pickup && (onPickupChange || onDropoffChange) && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-sm text-gray-600">Click the map to set pickup location</p>
          </div>
        </div>
      )}

      {interactive && pickup && !dropoff && onDropoffChange && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-sm text-gray-600">Click the map to set dropoff location</p>
          </div>
        </div>
      )}

      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      <style>{"\n@keyframes pulse {\n0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.7); }\n70% { box-shadow: 0 0 0 15px rgba(249, 115, 22, 0); }\n100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }\n}\n"}</style>
    </div>
  );
}

export default MapboxMap;
