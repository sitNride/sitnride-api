import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getMapboxToken } from '@/lib/mapboxToken';

// Set Mapbox access token globally using the centralized resolver
if (typeof window !== "undefined") {
  const token = getMapboxToken();
  if (token) {
    mapboxgl.accessToken = token;
  }
}

createRoot(document.getElementById("root")!).render(<App />);

