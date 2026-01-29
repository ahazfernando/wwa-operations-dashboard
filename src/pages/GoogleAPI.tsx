"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { getEmployeeLocation, calculateDistance } from '@/lib/location';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { LoadScript, GoogleMap, Marker, StandaloneSearchBox } from '@react-google-maps/api';

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
  // Optional: if you store the flag here
  allowWorkFromAnywhere?: boolean;
}

const libraries: ("places")[] = ["places"];
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';

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

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);

  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);

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
    } else {
      setMapCenter(DEFAULT_CENTER);
      setMapZoom(DEFAULT_ZOOM);
      setMarkerPosition(null);
    }
  }, [latitude, longitude]);

  const loadLocation = async () => {
    if (!user || !db) return;

    try {
      const locationDoc = await getDoc(doc(db, 'GoogleAPILocations', user.id));
      if (locationDoc.exists()) {
        const data = locationDoc.data() as GoogleAPILocation;
        setLocation({
          id: locationDoc.id,
          userId: data.userId,
          userName: data.userName,
          latitude: data.latitude,
          longitude: data.longitude,
          address: data.address,
          status: data.status,
          createdAt: data.createdAt,
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          approvedByName: data.approvedByName,
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
        description: 'Failed to load work from home location',
        variant: 'destructive',
      });
    }
  };

  const handleGetCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const locationData = await getEmployeeLocation();
      if (locationData.error || !locationData.latitude || !locationData.longitude) {
        toast({
          title: 'Location Error',
          description: locationData.error || 'Failed to get your location',
          variant: 'destructive',
        });
        return;
      }

      setLatitude(locationData.latitude.toString());
      setLongitude(locationData.longitude.toString());
      await reverseGeocode(locationData.latitude, locationData.longitude);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to get location',
        variant: 'destructive',
      });
    } finally {
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!geocoder.current) {
      geocoder.current = new google.maps.Geocoder();
    }

    try {
      const result = await geocoder.current.geocode({ location: { lat, lng } });
      if (result.results[0]) {
        setAddress(result.results[0].formatted_address);
      }
    } catch (e) {
      console.log('Reverse geocoding failed:', e);
      // Fallback to Nominatim
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          setAddress(data.display_name);
        }
      } catch (fallbackError) {
        console.log('Fallback address lookup failed:', fallbackError);
      }
    }
  };

  const handleSaveLocation = async () => {
    if (!user || !db) return;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      toast({
        title: 'Invalid Coordinates',
        description: 'Please enter valid latitude and longitude values',
        variant: 'destructive',
      });
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast({
        title: 'Invalid Coordinates',
        description: 'Latitude: -90 to 90 | Longitude: -180 to 180',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const locationData = {
        userId: user.id,
        userName: user.name,
        latitude: lat,
        longitude: lon,
        address: address || undefined,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        // If you want to allow admins to set this later, you can omit it here
        // allowWorkFromAnywhere: false, // or don't include it
      };

      await setDoc(doc(db, 'GoogleAPILocations', user.id), locationData, { merge: true });

      toast({
        title: 'Location Saved',
        description: 'Your work from home location has been submitted for admin approval.',
      });

      await loadLocation();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save location',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!location) return null;

    switch (location.status) {
      case 'approved':
        return (
          <Alert className="bg-green-500/20 backdrop-blur-md border-green-400/30 shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-900 dark:text-green-100">
              <strong>Approved</strong> -{' '}
              {allowWorkFromAnywhere
                ? 'You can work from anywhere.'
                : 'You can clock in/out within 50m of this location.'}
              {location.approvedByName && (
                <span className="block text-sm mt-1 opacity-90">
                  Approved by {location.approvedByName}
                </span>
              )}
            </AlertDescription>
          </Alert>
        );

      case 'pending':
        return (
          <Alert className="bg-yellow-50 border-yellow-200">
            <Clock className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              <strong>Pending Approval</strong> - Waiting for admin approval.
            </AlertDescription>
          </Alert>
        );

      case 'rejected':
        return (
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Rejected</strong> - Please set a new location.
            </AlertDescription>
          </Alert>
        );

      default:
        return null;
    }
  };

  const onPlacesChanged = () => {
    if (searchBoxRef.current) {
      const places = searchBoxRef.current.getPlaces();
      if (places && places.length > 0) {
        const place = places[0];
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setLatitude(lat.toString());
          setLongitude(lng.toString());
          setMapCenter({ lat, lng });
          setMarkerPosition({ lat, lng });
          setMapZoom(LOCATION_ZOOM);
          setAddress(place.formatted_address || '');
        }
      }
    }
  };

  const onMapClick = async (e: google.maps.MapMouseEvent) => {
    if (location?.status === 'approved') return;
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setLatitude(lat.toString());
      setLongitude(lng.toString());
      setMarkerPosition({ lat, lng });
      setMapCenter({ lat, lng });
      setMapZoom(LOCATION_ZOOM);
      await reverseGeocode(lat, lng);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Work From Home Location</h1>
        <p className="text-muted-foreground mt-2">
          Set your work from home location in Sri Lanka. Once approved, clock in/out only within 50 meters.
        </p>
      </div>

      {location && getStatusBadge()}

      <Card>
        <CardHeader>
          <CardTitle>{user?.name}'s Work from Home Location</CardTitle>
          <CardDescription>
            Choose a spot in Sri Lanka. The map starts focused on the island.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetCurrentLocation}
                disabled={locationLoading || location?.status === 'approved'}
              >
                {locationLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Use Current Location
                  </>
                )}
              </Button>
            </div>

            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g., 6.9271"
                  disabled={location?.status === 'approved'}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g., 79.8612"
                  disabled={location?.status === 'approved'}
                />
              </div>
            </div>
          </div>

          {/* Address input is commented out in your original code */}
          {/* 
          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Galle Road, Colombo"
              disabled={location?.status === 'approved'}
            />
          </div>
          */}

          <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Map of Sri Lanka</Label>
                {latitude && longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
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
                  placeholder="Search any place in Sri Lanka..."
                  className="mb-2"
                  disabled={location?.status === 'approved'}
                />
              </StandaloneSearchBox>

              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '400px' }}
                center={mapCenter}
                zoom={mapZoom}
                onClick={onMapClick}
              >
                {markerPosition && <Marker position={markerPosition} />}
              </GoogleMap>
            </div>
          </LoadScript>

          {location?.status !== 'approved' && (
            <Button
              onClick={handleSaveLocation}
              disabled={loading || !latitude || !longitude}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
            <Alert>
              <AlertDescription>
                Your location is approved. Contact admin to change it.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAPI;