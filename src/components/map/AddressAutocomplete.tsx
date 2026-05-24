import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPinIcon, NavigationIcon, TargetIcon, XIcon } from '@/components/ui/Icons';
import { getMapboxToken } from '@/lib/mapboxToken';



interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: Location) => void;
  placeholder?: string;
  icon?: 'pickup' | 'dropoff';
  className?: string;
}

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  onLocationSelect,
  placeholder = 'Enter address',
  icon = 'pickup',
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions from Mapbox Geocoding API

  const fetchSuggestions = useCallback(async (query: string) => {
    console.log("FETCH RUNNING:", query);
    if (query.length < 3) {
      setSuggestions([]); 
      return;
    }

    const token = getMapboxToken();
    if (!token) {
      // No token available — skip API call silently
      return;
    }

    setIsLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&autocomplete=true&limit=5&types=address,poi,place`;
      const response = await fetch(url);



      const data = await response.json();

      if (data.features) {
        setSuggestions(data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        })));
        setIsOpen(true);
      }
    } catch (error) {
      console.warn('Geocoding error:', error);
    }
    setIsLoading(false);
  }, []);


  // Debounced input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log("Typing:", newValue);
    onChange(newValue);

    if (!newValue) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.place_name);
    onLocationSelect({
      lat: suggestion.center[1],
      lng: suggestion.center[0],
      address: suggestion.place_name,
    });
    setIsOpen(false);
    setSuggestions([]);
  };

  // Get current location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${getMapboxToken()}`
      );

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const address = data.features[0].place_name;
        onChange(address);
        onLocationSelect({
          lat: latitude,
          lng: longitude,
          address,
        });
      }
    } catch (error) {
      console.error('Location error:', error);
      alert('Unable to get your location. Please enter address manually.');
    }
    setIsLocating(false);
  };

  // Clear input
  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        {/* Icon */}
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${
          icon === 'pickup' ? 'text-green-600' : 'text-red-600'
        }`}>
          {icon === 'pickup' ? <MapPinIcon size={20} /> : <NavigationIcon size={20} />}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-20 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
        />

        {/* Action buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XIcon size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isLocating}
            className="p-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-full transition-colors disabled:opacity-50"
            title="Use current location"
          >
            {isLocating ? (
              <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <TargetIcon size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-16 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0"
            >
              <MapPinIcon className="text-gray-400 flex-shrink-0 mt-0.5" size={18} />
              <span className="text-sm text-gray-700 line-clamp-2">
                {suggestion.place_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;

