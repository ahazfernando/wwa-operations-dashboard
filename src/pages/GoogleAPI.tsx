"use client";

import { useState, useEffect, useRef } from 'react';
import { useJsApiLoader, GoogleMap, Marker, StandaloneSearchBox } from '@react-google-maps/api';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { getEmployeeLocation } from '@/lib/location'; // assuming calculateDistance not used here
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface GoogleAPILocation {
  id: string;
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  address?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  approvedByName?: string;
  allowWorkFromAnywhere?: boolean;
}

const libraries = ["places"] as const;

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_CENTER = { lat: 7.2905715, lng: 80.6337262 };
const DEFAULT_ZOOM = 10;
const LOCATION_ZOOM = 15;

const GoogleAPI = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<GoogleAPILocation | null>(null);
  const [allowWorkFromAnywhere, setAllowWorkFromAnywhere] = useState(false);

  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);

  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Load Google Maps API once
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
    id: 'google-maps-script-work-from-home',
    region: 'lk',           // Sri Lanka
    language: 'en',
  });

  useEffect(() => {
    if (user) {
      loadLocation();
    }
  }, [user]);

  useEffect(() => {
    if (latitude && longitude) {
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);
      if (!isNaN(latNum) && !isNaN(lngNum)) {
        setMapCenter({ lat: latNum, lng: lngNum });
        setMarkerPosition({ lat: latNum, lng: lngNum });
        setMapZoom(LOCATION_ZOOM);
      }
    }
  }, [latitude, longitude]);

  const loadLocation = async () => {
    if (!user) return;

    try {
      const locationDoc = await getDoc(doc(db, 'GoogleAPILocations', user.id));
      if (locationDoc.exists()) {
        const data = locationDoc.data() as GoogleAPILocation;
        setLocation({
          id: locationDoc.id,
          ...data,
          allowWorkFromAnywhere: data.allowWorkFromAnywhere || false,
        });

        setLatitude(data.latitude.toString());
        setLongitude(data.longitude.toString());
        setAddress(data.address || '');
        setAllowWorkFromAnywhere(data.allowWorkFromAnywhere === true);
      }
    } catch (error: any) {
      console.error('Error loading location:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved location',
        variant: 'destructive',
      });
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const loc = await getEmployeeLocation();
      if (loc.error || !loc.latitude || !loc.longitude) {
        toast({
          title: 'Location Error',
          description: loc.error || 'Could not get current location',
          variant: 'destructive',
        });
        return;
      }

      setLatitude(loc.latitude.toString());
      setLongitude(loc.longitude.toString());
      await reverseGeocode(loc.latitude, loc.longitude);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to get location',
        variant: 'destructive',
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!isLoaded) return;

    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }

    try {
      const response = await geocoderRef.current.geocode({ location: { lat, lng } });
      if (response.results?.[0]) {
        setAddress(response.results[0].formatted_address);
      }
    } catch (err) {
      console.warn('Google geocode failed', err);

      // Fallback to Nominatim (OpenStreetMap)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await res.json();
        if (data.display_name) {
          setAddress(data.display_name);
        }
      } catch (fallbackErr) {
        console.warn('Nominatim fallback failed', fallbackErr);
      }
    }
  };

  const handleSaveLocation = async () => {
    if (!user) return;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      toast({ title: 'Invalid', description: 'Please enter valid coordinates', variant: 'destructive' });
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast({ title: 'Invalid', description: 'Coordinates out of range', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const data = {
        userId: user.id,
        userName: user.name,
        latitude: lat,
        longitude: lon,
        address: address || undefined,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'GoogleAPILocations', user.id), data, { merge: true });

      toast({
        title: 'Submitted',
        description: 'Location sent for admin approval',
      });

      await loadLocation();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onPlacesChanged = () => {
    if (!searchBoxRef.current) return;

    const places = searchBoxRef.current.getPlaces();
    if (places?.[0]?.geometry?.location) {
      const loc = places[0].geometry.location;
      const lat = loc.lat();
      const lng = loc.lng();

      setLatitude(lat.toString());
      setLongitude(lng.toString());
      setAddress(places[0].formatted_address || '');
      setMapCenter({ lat, lng });
      setMarkerPosition({ lat, lng });
      setMapZoom(LOCATION_ZOOM);
    }
  };

  const onMapClick = (e: google.maps.MapMouseEvent) => {
    if (location?.status === 'approved') return;
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setLatitude(lat.toString());
      setLongitude(lng.toString());
      setMarkerPosition({ lat, lng });
      setMapCenter({ lat, lng });
      setMapZoom(LOCATION_ZOOM);
      reverseGeocode(lat, lng);
    }
  };

  const getStatusBadge = () => {
    if (!location) return null;

    if (location.status === 'approved') {
      return (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Approved</strong> —{' '}
            {allowWorkFromAnywhere
              ? 'You can work from anywhere'
              : 'Clock in/out only within 50m of this location'}
            {location.approvedByName && (
              <span className="block text-sm mt-1">
                Approved by {location.approvedByName}
              </span>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    if (location.status === 'pending') {
      return (
        <Alert className="bg-yellow-50 border-yellow-200">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Pending Approval</strong> — Waiting for admin review
          </AlertDescription>
        </Alert>
      );
    }

    if (location.status === 'rejected') {
      return (
        <Alert className="bg-red-50 border-red-200">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Rejected</strong> — Please choose a new location
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  if (loadError) {
    return (
      <div className="p-6 text-red-600">
        Failed to load Google Maps: {loadError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Google Maps...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold">Work From Home Location</h1>
        <p className="text-muted-foreground mt-2">
          Set your approved home location in Sri Lanka. Clock-in/out allowed within 50 meters once approved.
        </p>
      </div>

      {location && getStatusBadge()}

      <Card>
        <CardHeader>
          <CardTitle>{user?.name || 'Your'} Work-from-Home Location</CardTitle>
          <CardDescription>
            Select a location in Sri Lanka. Approved locations cannot be changed without admin help.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={locationLoading || location?.status === 'approved'}
            >
              {locationLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-4 w-4" />
                  Use Current Location
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 6.9271"
                disabled={location?.status === 'approved'}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 79.8612"
                disabled={location?.status === 'approved'}
              />
            </div>
          </div>

          {/* Address display (optional – you can make it editable if needed) */}
          {address && (
            <div className="space-y-2">
              <Label>Detected Address</Label>
              <div className="p-3 bg-muted/40 rounded-md text-sm border">
                {address}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Search in Map</Label>
              {latitude && longitude && (
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in Google Maps →
                </a>
              )}
            </div>

            <StandaloneSearchBox
              onLoad={(ref) => (searchBoxRef.current = ref)}
              onPlacesChanged={onPlacesChanged}
            >
              <Input
                type="text"
                placeholder="Search for a place in Sri Lanka..."
                className="w-full"
                disabled={location?.status === 'approved'}
              />
            </StandaloneSearchBox>

            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '420px' }}
              center={mapCenter}
              zoom={mapZoom}
              onClick={onMapClick}
              options={{
                fullscreenControl: false,
                mapTypeControl: false,
                streetViewControl: false,
              }}
            >
              {markerPosition && <Marker position={markerPosition} />}
            </GoogleMap>
          </div>

          {location?.status !== 'approved' && (
            <Button
              onClick={handleSaveLocation}
              disabled={loading || !latitude.trim() || !longitude.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : location ? (
                'Update Location'
              ) : (
                'Save Location'
              )}
            </Button>
          )}

          {location?.status === 'approved' && (
            <Alert variant="default">
              <AlertDescription className="text-center py-2">
                This location is approved. Contact admin to make changes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAPI;