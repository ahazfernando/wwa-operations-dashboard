"use client";

import { useState, useEffect } from 'react';
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

interface WorkFromHomeLocation {
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
}

const WorkFromHome = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState<WorkFromHomeLocation | null>(null);
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadLocation();
    }
  }, [user]);

  const loadLocation = async () => {
    if (!user || !db) return;

    try {
      const locationDoc = await getDoc(doc(db, 'workFromHomeLocations', user.id));
      if (locationDoc.exists()) {
        const data = locationDoc.data();
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
        });
        setLatitude(data.latitude.toString());
        setLongitude(data.longitude.toString());
        setAddress(data.address || '');
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

      // Try to get address using reverse geocoding (optional)
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}&zoom=18&addressdetails=1`
        );
        const data = await response.json();
        if (data.display_name) {
          setAddress(data.display_name);
        }
      } catch (e) {
        // Address lookup is optional, don't fail if it doesn't work
        console.log('Address lookup failed:', e);
      }
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

    if (lat < -90 || lat > 90) {
      toast({
        title: 'Invalid Latitude',
        description: 'Latitude must be between -90 and 90',
        variant: 'destructive',
      });
      return;
    }

    if (lon < -180 || lon > 180) {
      toast({
        title: 'Invalid Longitude',
        description: 'Longitude must be between -180 and 180',
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
      };

      await setDoc(doc(db, 'workFromHomeLocations', user.id), locationData);

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
              <strong>Approved</strong> - You can clock in/out within 50m of this location.
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
              <strong>Pending Approval</strong> - Waiting for admin approval. You cannot clock in/out until approved.
            </AlertDescription>
          </Alert>
        );
      case 'rejected':
        return (
          <Alert className="bg-red-50 border-red-200">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Rejected</strong> - This location was rejected. Please set a new location.
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Work From Home Location</h1>
        <p className="text-muted-foreground mt-2">
          Set your work from home location. Once approved by an admin, you'll only be able to clock in/out within 50 meters of this location.
        </p>
      </div>

      {location && getStatusBadge()}

      <Card>
        <CardHeader>
          <CardTitle>{user?.name}'s Work from Home Location</CardTitle>
          <CardDescription>
            Set the location where you'll be working from home. This location will be named "{user?.name}'s Work from Home Location".
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
                disabled={locationLoading}
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
                  placeholder="e.g., -37.8136"
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
                  placeholder="e.g., 144.9631"
                  disabled={location?.status === 'approved'}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., 123 Main St, Melbourne, VIC 3000"
              disabled={location?.status === 'approved'}
            />
          </div>

          {latitude && longitude && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Preview Location</Label>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  Open in Google Maps →
                </a>
              </div>
              <div className="w-full h-[400px] rounded-lg overflow-hidden border">
                <iframe
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&output=embed`}
                />
              </div>
            </div>
          )}

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
                Your location is approved. If you need to change it, please contact an admin.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkFromHome;

