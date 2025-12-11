import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/contexts/AuthContext';
import { Check, X, Upload, FileText, Download, Search, History } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, updateDoc, getDoc, collection, query, where, getDocs, Timestamp, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { UserProfileViewDialog } from '@/components/UserProfileViewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, MapPin, Edit, Loader2, Clock, Trash2, MoreVertical, Eye, Grid3x3, List, LayoutGrid, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const Settings = () => {
  const { approveUser, rejectUser, terminateUser, reapproveTerminatedUser, getPendingUsers, getAllUsers, user: currentUser } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [updatingRole, setUpdatingRole] = useState<Record<string, boolean>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobRole, setSelectedJobRole] = useState<string>('all');
  const [pendingLocations, setPendingLocations] = useState<any[]>([]);
  const [allLocations, setAllLocations] = useState<any[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [allLocationsLoading, setAllLocationsLoading] = useState(true);
  const [processingLocation, setProcessingLocation] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<string | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [selectedUserForLocation, setSelectedUserForLocation] = useState<any>(null);
  const [locationLatitude, setLocationLatitude] = useState<string>('');
  const [locationLongitude, setLocationLongitude] = useState<string>('');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [allowWorkFromAnywhere, setAllowWorkFromAnywhere] = useState<boolean>(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const [usersWithTimeEntryLocations, setUsersWithTimeEntryLocations] = useState<Record<string, { hasLocation: boolean; latestLocation?: { lat: number; lng: number } }>>({});
  const [userViewMode, setUserViewMode] = useState<'table' | 'card'>('table');
  const [userProfilePhotos, setUserProfilePhotos] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPendingUsers();
    loadAllUsers();
    loadPendingLocations();
    loadAllLocations();
  }, []);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const users = await getPendingUsers();
      setPendingUsers(users);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pending users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    const role = selectedRoles[userId] || 'itteam';
    try {
      setProcessing(userId);
      await approveUser(userId, role);
      toast({
        title: 'User Approved',
        description: 'User has been approved and can now access the system.',
      });
      await loadPendingUsers();
      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      setProcessing(userId);
      await rejectUser(userId);
      toast({
        title: 'User Rejected',
        description: 'User account has been rejected.',
      });
      await loadPendingUsers();
      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleTerminate = async (userId: string) => {
    try {
      setProcessing(userId);
      await terminateUser(userId);
      toast({
        title: 'User Terminated',
        description: 'User has been moved to Past Employees. They will need approval to log back in.',
      });
      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to terminate user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReapprove = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    const role = user?.role || 'itteam';
    try {
      setProcessing(userId);
      await reapproveTerminatedUser(userId, role as UserRole);
      toast({
        title: 'User Re-approved',
        description: 'User has been re-approved and can now access the system.',
      });
      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to re-approve user',
        variant: 'destructive',
      });
    } finally {
      setProcessing(null);
    }
  };

  const loadPendingLocations = async () => {
    if (!db) return;
    try {
      setLocationsLoading(true);
      const q = query(collection(db, 'workFromHomeLocations'), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      const locations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPendingLocations(locations);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pending locations',
        variant: 'destructive',
      });
    } finally {
      setLocationsLoading(false);
    }
  };

  const loadAllLocations = async () => {
    if (!db) return;
    try {
      setAllLocationsLoading(true);
      const querySnapshot = await getDocs(collection(db, 'workFromHomeLocations'));
      const locations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllLocations(locations);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load all locations',
        variant: 'destructive',
      });
    } finally {
      setAllLocationsLoading(false);
    }
  };

  const handleApproveLocation = async (locationId: string) => {
    if (!db || !currentUser) return;
    try {
      setProcessingLocation(locationId);
      await updateDoc(doc(db, 'workFromHomeLocations', locationId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.id,
        approvedByName: currentUser.name || currentUser.email,
      });
      toast({
        title: 'Location Approved',
        description: 'Work from home location has been approved.',
      });
      await loadPendingLocations();
      await loadAllLocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve location',
        variant: 'destructive',
      });
    } finally {
      setProcessingLocation(null);
    }
  };

  const handleRejectLocation = async (locationId: string) => {
    if (!db) return;
    try {
      setProcessingLocation(locationId);
      await updateDoc(doc(db, 'workFromHomeLocations', locationId), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
      });
      toast({
        title: 'Location Rejected',
        description: 'Work from home location has been rejected.',
      });
      await loadPendingLocations();
      await loadAllLocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject location',
        variant: 'destructive',
      });
    } finally {
      setProcessingLocation(null);
    }
  };

  const handleOpenLocationDialog = (user: any) => {
    setSelectedUserForLocation(user);
    // Check if user already has a location
    const existingLocation = allLocations.find(loc => loc.userId === user.id);
    if (existingLocation) {
      setLocationLatitude(existingLocation.latitude?.toString() || '');
      setLocationLongitude(existingLocation.longitude?.toString() || '');
      setLocationAddress(existingLocation.address || '');
      setAllowWorkFromAnywhere(existingLocation.allowWorkFromAnywhere || false);
    } else {
      setLocationLatitude('');
      setLocationLongitude('');
      setLocationAddress('');
      setAllowWorkFromAnywhere(false);
    }
    setLocationDialogOpen(true);
  };

  const handleSaveUserLocation = async () => {
    if (!db || !currentUser || !selectedUserForLocation) return;

    const lat = parseFloat(locationLatitude);
    const lon = parseFloat(locationLongitude);

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

    setSavingLocation(true);
    try {
      const userName = selectedUserForLocation.name || 
        `${selectedUserForLocation.firstName || ''} ${selectedUserForLocation.lastName || ''}`.trim() || 
        selectedUserForLocation.email;

      const existingLocation = allLocations.find(loc => loc.userId === selectedUserForLocation.id);
      
      const locationData: any = {
        userId: selectedUserForLocation.id,
        userName: userName,
        latitude: lat,
        longitude: lon,
        address: locationAddress || undefined,
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser.id,
        approvedByName: currentUser.name || currentUser.email,
        allowWorkFromAnywhere: allowWorkFromAnywhere,
        createdAt: existingLocation?.createdAt || serverTimestamp(),
      };

      await setDoc(doc(db, 'workFromHomeLocations', selectedUserForLocation.id), locationData);

      toast({
        title: 'Location Saved',
        description: `Work from home location has been ${existingLocation ? 'updated' : 'set'} for ${userName}.`,
      });

      setLocationDialogOpen(false);
      setSelectedUserForLocation(null);
      setLocationLatitude('');
      setLocationLongitude('');
      setLocationAddress('');
      setAllowWorkFromAnywhere(false);
      
      await loadPendingLocations();
      await loadAllLocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save location',
        variant: 'destructive',
      });
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!db || !deleteLocationId) return;

    setDeletingLocation(true);
    try {
      await deleteDoc(doc(db, 'workFromHomeLocations', deleteLocationId));
      
      toast({
        title: 'Location Deleted',
        description: 'Work from home location has been removed.',
      });

      setDeleteLocationId(null);
      await loadPendingLocations();
      await loadAllLocations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete location',
        variant: 'destructive',
      });
    } finally {
      setDeletingLocation(false);
    }
  };

  const checkProfileCompletion = async (userId: string): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      if (!profileDoc.exists()) {
        return false;
      }
      
      const profileData = profileDoc.data();
      
      // Check if essential fields are filled
      const hasEssentialInfo = !!(
        profileData.fullName || profileData.preferredName ||
        profileData.email || profileData.phone
      );
      
      // Check if required documents are uploaded
      const hasRequiredDocs = !!(
        profileData.idFrontPhoto || 
        profileData.idBackPhoto ||
        profileData.selfiePhoto ||
        profileData.passportPhoto
      );
      
      // Profile is considered complete if it has essential info and at least some documents
      return hasEssentialInfo && hasRequiredDocs;
    } catch (error) {
      console.error(`Error checking profile for user ${userId}:`, error);
      return false;
    }
  };

  const loadUserProfilePhotos = async (users: any[]) => {
    if (!db) return;
    
    try {
      const photoPromises = users.map(async (user) => {
        try {
          const profileDoc = await getDoc(doc(db, 'profiles', user.id));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            return { userId: user.id, photo: data.profilePhoto || null };
          }
        } catch (error) {
          console.error(`Error loading profile photo for user ${user.id}:`, error);
        }
        return { userId: user.id, photo: null };
      });
      
      const photoResults = await Promise.all(photoPromises);
      const newPhotos: Record<string, string> = {};
      photoResults.forEach(({ userId, photo }) => {
        if (photo) {
          newPhotos[userId] = photo;
        }
      });
      setUserProfilePhotos(prev => ({ ...prev, ...newPhotos }));
    } catch (error) {
      console.error('Error loading profile photos:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const checkUserTimeEntryLocations = async (userId: string): Promise<{ hasLocation: boolean; latestLocation?: { lat: number; lng: number } }> => {
    if (!db) return { hasLocation: false };
    
    try {
      // Query time entries for this user
      const timeEntriesQuery = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(timeEntriesQuery);
      
      // Find any entry with GPS coordinates (prioritize more recent ones)
      let latestEntry: { lat: number; lng: number; timestamp: Date } | null = null;
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        if (data.clockInLocation?.latitude && data.clockInLocation?.longitude) {
          const entryTimestamp = data.clockIn?.toDate?.() || data.createdAt?.toDate?.() || new Date(0);
          const location = {
            lat: data.clockInLocation.latitude,
            lng: data.clockInLocation.longitude,
            timestamp: entryTimestamp,
          };
          
          // Keep the most recent entry
          if (!latestEntry || entryTimestamp > latestEntry.timestamp) {
            latestEntry = location;
          }
        }
      }
      
      if (latestEntry) {
        return {
          hasLocation: true,
          latestLocation: {
            lat: latestEntry.lat,
            lng: latestEntry.lng,
          },
        };
      }
      
      return { hasLocation: false };
    } catch (error) {
      console.error(`Error checking time entry locations for user ${userId}:`, error);
      return { hasLocation: false };
    }
  };

  const loadAllUsers = async () => {
    try {
      setUsersLoading(true);
      const users = await getAllUsers();
      // Sort by creation date (newest first)
      const sortedUsers = users.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      setAllUsers(sortedUsers);
      
      // Load profile photos for all users
      await loadUserProfilePhotos(sortedUsers);
      
      // Load profile completion status for all users in parallel
      const statusMap: Record<string, boolean> = {};
      const loadingMap: Record<string, boolean> = {};
      
      // Initialize loading states
      sortedUsers.forEach(user => {
        loadingMap[user.id] = true;
      });
      setLoadingProfileStatus(loadingMap);
      
      // Check all profiles in parallel
      const profileChecks = sortedUsers.map(async (user) => {
        const isComplete = await checkProfileCompletion(user.id);
        return { userId: user.id, isComplete };
      });
      
      const results = await Promise.all(profileChecks);
      
      // Update status map
      results.forEach(({ userId, isComplete }) => {
        statusMap[userId] = isComplete;
        loadingMap[userId] = false;
      });
      
      setProfileCompletionStatus(statusMap);
      setLoadingProfileStatus(loadingMap);

      // Check time entry locations for all users in parallel
      const locationChecks = sortedUsers.map(async (user) => {
        const locationInfo = await checkUserTimeEntryLocations(user.id);
        return { userId: user.id, ...locationInfo };
      });
      
      const locationResults = await Promise.all(locationChecks);
      const locationMap: Record<string, { hasLocation: boolean; latestLocation?: { lat: number; lng: number } }> = {};
      locationResults.forEach(({ userId, hasLocation, latestLocation }) => {
        locationMap[userId] = { hasLocation, latestLocation };
      });
      
      setUsersWithTimeEntryLocations(locationMap);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!db) {
      toast({
        title: 'Error',
        description: 'Firebase is not initialized. Please check your environment variables.',
        variant: 'destructive',
      });
      return;
    }

    // Prevent changing own role to non-admin
    if (userId === currentUser?.id && newRole !== 'admin') {
      toast({
        title: 'Error',
        description: 'You cannot change your own role from admin.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingRole(prev => ({ ...prev, [userId]: true }));
      
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        roleUpdatedAt: new Date(),
        roleUpdatedBy: currentUser?.id || null,
        roleUpdatedByName: currentUser?.name || currentUser?.email || 'Admin',
      });

      toast({
        title: 'Role Updated',
        description: `User role has been changed to ${getRoleDisplayName(newRole)}.`,
      });

      // Reload users to reflect changes
      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user role',
        variant: 'destructive',
      });
    } finally {
      setUpdatingRole(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleFileUpload = async (userId: string, file: File) => {
    if (!file) return;

    if (!storage || !db) {
      toast({
        title: 'Error',
        description: 'Firebase is not initialized. Please check your environment variables.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type (PDF, DOC, DOCX)
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or Word document',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading({ ...uploading, [userId]: true });
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, `contracts/${userId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update user document in Firestore
      await updateDoc(doc(db, 'users', userId), {
        contractUrl: downloadURL,
        contractFileName: file.name,
        contractUploadedAt: new Date(),
        contractUploadedBy: currentUser?.id || null,
      });

      toast({
        title: 'Contract uploaded',
        description: 'Job contract has been uploaded successfully.',
      });

      await loadAllUsers();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload contract',
        variant: 'destructive',
      });
    } finally {
      setUploading({ ...uploading, [userId]: false });
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: 'Admin',
      operationsstaff: 'Operations Staff',
      itteam: 'IT Team',
    };
    return roleMap[role] || role;
  };

  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('none');
  const [itTeamUsers, setItTeamUsers] = useState<any[]>([]);
  const [loadingItUsers, setLoadingItUsers] = useState(true);
  const [grantingPermission, setGrantingPermission] = useState(false);
  const [viewingProfileUserId, setViewingProfileUserId] = useState<string | null>(null);
  const [viewingProfileUserName, setViewingProfileUserName] = useState<string>('');
  const [profileCompletionStatus, setProfileCompletionStatus] = useState<Record<string, boolean>>({});
  const [loadingProfileStatus, setLoadingProfileStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadItTeamUsers();
  }, []);

  const loadItTeamUsers = async () => {
    try {
      setLoadingItUsers(true);
      const users = await getAllUsers();
      // Filter for approved IT team members
      const itUsers = users.filter(
        (user) => user.role === 'itteam' && user.status === 'approved'
      );
      setItTeamUsers(itUsers);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load IT team users',
        variant: 'destructive',
      });
    } finally {
      setLoadingItUsers(false);
    }
  };

  const handleGrantPermission = async () => {
    if (!db) {
      toast({
        title: 'Error',
        description: 'Firebase is not initialized. Please check your environment variables.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select an IT team member',
        variant: 'destructive',
      });
      return;
    }

    if (selectedPermission === 'none') {
      toast({
        title: 'Error',
        description: 'Please select a permission level',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGrantingPermission(true);
      
      // Update user permissions in Firestore
      const permissions: any = {};
      if (selectedPermission === 'read' || selectedPermission === 'crud') {
        permissions.leadTracking = selectedPermission;
      } else {
        permissions.leadTracking = null;
      }

      await updateDoc(doc(db, 'users', selectedUser), {
        permissions: selectedPermission === 'none' ? {} : permissions,
        permissionsUpdatedAt: new Date(),
        permissionsUpdatedBy: currentUser?.id || null,
      });

      toast({
        title: 'Permission Granted',
        description: `IT team member now has ${selectedPermission === 'crud' ? 'full' : selectedPermission === 'read' ? 'read-only' : 'no'} access to Lead Tracking.`,
      });

      // Reset form
      setSelectedUser('');
      setSelectedPermission('none');
      
      // Reload users to reflect changes
      await loadAllUsers();
      await loadItTeamUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant permission',
        variant: 'destructive',
      });
    } finally {
      setGrantingPermission(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">System configuration and permissions</p>
      </div>

      <Card className="border-border/50 transition-smooth overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="bg-gradient-to-br from-card to-card/50 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                User Management
              </CardTitle>
              <CardDescription className="mt-1.5">
                View all users, their details, and manage job contracts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <div className="absolute inset-0 bg-primary/5 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary z-10" />
              <Input
                type="text"
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base border-2 border-primary/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 bg-background/80 backdrop-blur-sm relative z-10"
              />
            </div>
            <div className="flex gap-3">
              <Select value={selectedJobRole} onValueChange={setSelectedJobRole}>
                <SelectTrigger className="w-[200px] h-12 border-2 border-primary/20 hover:border-primary/50 transition-all duration-300 bg-background/80 backdrop-blur-sm">
                  <SelectValue placeholder="Filter by job role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Job Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operationsstaff">Operations Staff</SelectItem>
                  <SelectItem value="itteam">IT Team</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center border-2 border-primary/20 rounded-lg overflow-hidden bg-background/80 backdrop-blur-sm">
                <Button
                  variant={userViewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setUserViewMode('table')}
                  className={`h-12 px-4 rounded-none border-0 transition-all duration-300 ${
                    userViewMode === 'table'
                      ? 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 shadow-lg'
                      : 'hover:bg-primary/10'
                  }`}
                >
                  <List className="h-4 w-4 mr-2" />
                  Table
                </Button>
                <Button
                  variant={userViewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setUserViewMode('card')}
                  className={`h-12 px-4 rounded-none border-0 transition-all duration-300 ${
                    userViewMode === 'card'
                      ? 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 shadow-lg'
                      : 'hover:bg-primary/10'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Cards
                </Button>
              </div>
            </div>
          </div>
          {usersLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-6 gap-4 pb-2 border-b">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 py-2">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (() => {
            // Filter users based on search query and job role, excluding terminated users
            const filteredUsers = allUsers.filter((user) => {
              // Exclude terminated users from main table
              if (user.status === 'terminated') {
                return false;
              }
              
              // Search filter
              if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const userName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '').toLowerCase();
                const userEmail = (user.email || '').toLowerCase();
                const employeeId = (user.employeeId || '').toLowerCase();
                
                if (!userName.includes(query) && !userEmail.includes(query) && !employeeId.includes(query)) {
                  return false;
                }
              }
              
              // Job role filter
              if (selectedJobRole !== 'all') {
                if (user.role !== selectedJobRole) {
                  return false;
                }
              }
              
              return true;
            });

            return filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
                  <Users className="h-8 w-8 text-primary opacity-60" />
                </div>
                <p className="font-medium mb-1">No users found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || selectedJobRole !== 'all' ? 'Try adjusting your filters' : 'No users in the system'}
                </p>
              </div>
            ) : userViewMode === 'table' ? (
              <div className="overflow-x-auto">
                <Table className="border-separate border-spacing-0">
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b-2 border-primary/20">
                      <TableHead className="font-bold text-foreground">Name</TableHead>
                      <TableHead className="font-bold text-foreground">Employee ID</TableHead>
                      <TableHead className="font-bold text-foreground">Job Role</TableHead>
                      <TableHead className="font-bold text-foreground">Status</TableHead>
                      <TableHead className="font-bold text-foreground">Profile Completed</TableHead>
                      <TableHead className="font-bold text-foreground">Registered</TableHead>
                      <TableHead className="font-bold text-foreground">Approved By</TableHead>
                      <TableHead className="font-bold text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user, index) => {
                      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                      return (
                    <TableRow 
                      key={user.id}
                      className="group cursor-pointer hover:bg-gradient-to-r hover:from-primary/5 hover:via-primary/5 hover:to-transparent transition-all duration-300 border-b border-border/50"
                      onClick={(e) => {
                        // Don't open profile if clicking on interactive elements
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('select') ||
                          target.closest('a') ||
                          target.closest('input') ||
                          target.closest('[role="combobox"]')
                        ) {
                          return;
                        }
                        setViewingProfileUserId(user.id);
                        setViewingProfileUserName(userName);
                      }}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell className="font-semibold group-hover:text-primary transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 rounded-full ring-2 ring-primary/20">
                            <AvatarImage src={userProfilePhotos[user.id] || undefined} alt={userName} />
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold">
                              {getInitials(userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {user.employeeId || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {updatingRole[user.id] ? (
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-[140px]" />
                          </div>
                        ) : (
                          <Select
                            value={user.role || 'itteam'}
                            onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                            disabled={updatingRole[user.id]}
                          >
                            <SelectTrigger className="w-[140px] [&>span]:text-left [&>span]:m-0 border-2 border-primary/20 hover:border-primary/50 transition-all">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="operationsstaff">Operations Staff</SelectItem>
                              <SelectItem value="itteam">IT Team</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.status === 'approved'
                              ? 'default'
                              : user.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="font-semibold shadow-sm"
                        >
                          {user.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {loadingProfileStatus[user.id] ? (
                          <Skeleton className="h-5 w-20" />
                        ) : (
                          <div className="flex items-center gap-2">
                            {profileCompletionStatus[user.id] ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                  Completed
                                </Badge>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                <Badge variant="secondary">
                                  Incomplete
                                </Badge>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        {user.approvedByName || user.approvedBy || 'N/A'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-2 shadow-xl">
                            <DropdownMenuItem
                              onClick={() => {
                                setViewingProfileUserId(user.id);
                                setViewingProfileUserName(userName);
                              }}
                              className="cursor-pointer"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            {user.status === 'approved' && (
                              <DropdownMenuItem
                                onClick={() => handleTerminate(user.id)}
                                disabled={processing === user.id}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                {processing === user.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Terminating...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Terminate
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              // Card View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map((user, index) => {
                  const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                  return (
                    <Card
                      key={user.id}
                      className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-smooth hover:scale-[1.02] cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (
                          target.closest('button') ||
                          target.closest('select') ||
                          target.closest('[role="combobox"]')
                        ) {
                          return;
                        }
                        setViewingProfileUserId(user.id);
                        setViewingProfileUserName(userName);
                      }}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full blur-lg" />
                              <Avatar className="h-16 w-16 rounded-full ring-2 ring-primary/20 relative">
                                <AvatarImage src={userProfilePhotos[user.id] || undefined} alt={userName} />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-lg">
                                  {getInitials(userName)}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">
                                {userName}
                              </h3>
                              <p className="text-sm text-muted-foreground truncate">
                                {user.employeeId || 'No ID'}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-2 shadow-xl">
                              <DropdownMenuItem
                                onClick={() => {
                                  setViewingProfileUserId(user.id);
                                  setViewingProfileUserName(userName);
                                }}
                                className="cursor-pointer"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              {user.status === 'approved' && (
                                <DropdownMenuItem
                                  onClick={() => handleTerminate(user.id)}
                                  disabled={processing === user.id}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  {processing === user.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Terminating...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Terminate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Job Role</span>
                            {updatingRole[user.id] ? (
                              <Skeleton className="h-8 w-[120px]" />
                            ) : (
                              <div onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={user.role || 'itteam'}
                                  onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                                  disabled={updatingRole[user.id]}
                                >
                                  <SelectTrigger className="w-[120px] h-8 text-sm border-2 border-primary/20 hover:border-primary/50 transition-all">
                                    <SelectValue />
                                  </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="operationsstaff">Operations Staff</SelectItem>
                                  <SelectItem value="itteam">IT Team</SelectItem>
                                </SelectContent>
                              </Select>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Status</span>
                            <Badge
                              variant={
                                user.status === 'approved'
                                  ? 'default'
                                  : user.status === 'pending'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                              className="font-semibold shadow-sm"
                            >
                              {user.status || 'pending'}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Profile</span>
                            {loadingProfileStatus[user.id] ? (
                              <Skeleton className="h-5 w-20" />
                            ) : (
                              <div className="flex items-center gap-2">
                                {profileCompletionStatus[user.id] ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
                                      Completed
                                    </Badge>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-muted-foreground" />
                                    <Badge variant="secondary" className="text-xs">
                                      Incomplete
                                    </Badge>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="pt-3 border-t border-border/50 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Registered</span>
                              <span className="font-medium">{formatDate(user.createdAt)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Approved By</span>
                              <span className="font-medium truncate ml-2">{user.approvedByName || user.approvedBy || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Past Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Past Employees</CardTitle>
          <CardDescription>
            Terminated employees. They require approval to log back into the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-7 gap-4 py-2">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (() => {
            const terminatedUsers = allUsers.filter((user) => user.status === 'terminated');
            
            // Apply search filter to terminated users
            const filteredTerminatedUsers = terminatedUsers.filter((user) => {
              if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const userName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '').toLowerCase();
                const userEmail = (user.email || '').toLowerCase();
                const employeeId = (user.employeeId || '').toLowerCase();
                
                if (!userName.includes(query) && !userEmail.includes(query) && !employeeId.includes(query)) {
                  return false;
                }
              }
              return true;
            });

            return filteredTerminatedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No terminated employees found
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>Terminated By</TableHead>
                      <TableHead>Terminated Date</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTerminatedUsers.map((user) => {
                      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {userName}
                          </TableCell>
                          <TableCell>{user.employeeId || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {user.role === 'admin' ? 'Admin' : user.role === 'operationsstaff' ? 'Operations Staff' : 'IT Team'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.terminatedByName || user.terminatedBy || 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {user.terminatedAt ? formatDate(user.terminatedAt) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleReapprove(user.id)}
                              disabled={processing === user.id}
                            >
                              {processing === user.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Re-approving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Re-approve
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending User Approvals</CardTitle>
          <CardDescription>
            Review and approve or reject user account requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-4 pb-2 border-b">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-5 gap-4 py-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : pendingUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pending user approvals
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((pendingUser) => (
                  <TableRow key={pendingUser.id}>
                    <TableCell className="font-medium">
                      {pendingUser.name || `${pendingUser.firstName} ${pendingUser.lastName}`}
                    </TableCell>
                    <TableCell>{pendingUser.email}</TableCell>
                    <TableCell>{pendingUser.employeeId || 'N/A'}</TableCell>
                    <TableCell>
                      <Select
                        value={selectedRoles[pendingUser.id] || 'itteam'}
                        onValueChange={(value) => {
                          setSelectedRoles({
                            ...selectedRoles,
                            [pendingUser.id]: value as UserRole,
                          });
                        }}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="operationsstaff">Operations Staff</SelectItem>
                          <SelectItem value="itteam">IT Team</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(pendingUser.id)}
                          disabled={processing === pendingUser.id}
                        >
                          {processing === pendingUser.id ? (
                            <Skeleton className="h-4 w-16" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(pendingUser.id)}
                          disabled={processing === pendingUser.id}
                        >
                          {processing === pendingUser.id ? (
                            <Skeleton className="h-4 w-16" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Work From Home Locations</CardTitle>
          <CardDescription>
            View and manage all user work from home locations. You can set or update locations for any user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allLocationsLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-7 gap-4 py-2">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {allLocations.length} location{allLocations.length !== 1 ? 's' : ''} found
                </p>
              </div>
              {allLocations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No work from home locations found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location Restriction</TableHead>
                        <TableHead>Coordinates</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allLocations.map((location) => {
                        const user = allUsers.find(u => u.id === location.userId);
                        const userName = user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : (location.userName || 'Unknown User');
                        return (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">
                              {userName}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  location.status === 'approved'
                                    ? 'default'
                                    : location.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                              >
                                {location.status || 'pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {location.status === 'approved' ? (
                                location.allowWorkFromAnywhere ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                    Can work from anywhere
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                    Restricted to 50m radius
                                  </Badge>
                                )
                              ) : (
                                <span className="text-sm text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>Lat: {location.latitude?.toFixed(6)}</div>
                                <div>Lng: {location.longitude?.toFixed(6)}</div>
                                <a
                                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-xs flex items-center gap-1 mt-1"
                                >
                                  <MapPin className="h-3 w-3" />
                                  View on Map
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              {location.address || (
                                <span className="text-muted-foreground text-sm">No address provided</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {location.approvedByName || 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {user && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenLocationDialog(user)}
                                    disabled={editingLocation === location.id}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    {location.status === 'approved' ? 'Update' : 'Set'}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteLocationId(location.id)}
                                  disabled={deletingLocation}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  To set a work from home location for a user who doesn't have one, select them from the User Management table above and use the "Set Location" action.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {allUsers
                    .filter(user => !allLocations.find(loc => loc.userId === user.id))
                    .slice(0, 10)
                    .map((user) => {
                      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                      return (
                        <Button
                          key={user.id}
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenLocationDialog(user)}
                        >
                          <MapPin className="h-4 w-4 mr-1" />
                          Set Location for {userName}
                        </Button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Work From Home Location Approvals</CardTitle>
          <CardDescription>
            Review and approve or reject work from home location requests. Once approved, users can only clock in/out within 50 meters of their approved location.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locationsLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-4 pb-2 border-b">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-5 gap-4 py-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Skeleton key={j} className="h-8 w-full" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : pendingLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pending work from home location approvals
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Location Name</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLocations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">
                      {location.userName || 'Unknown User'}
                    </TableCell>
                    <TableCell>
                      {location.userName}'s Work from Home Location
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Lat: {location.latitude?.toFixed(6)}</div>
                        <div>Lng: {location.longitude?.toFixed(6)}</div>
                        <a
                          href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs flex items-center gap-1 mt-1"
                        >
                          <MapPin className="h-3 w-3" />
                          View on Map
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      {location.address || (
                        <span className="text-muted-foreground text-sm">No address provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApproveLocation(location.id)}
                          disabled={processingLocation === location.id}
                        >
                          {processingLocation === location.id ? (
                            <Skeleton className="h-4 w-16" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectLocation(location.id)}
                          disabled={processingLocation === location.id}
                        >
                          {processingLocation === location.id ? (
                            <Skeleton className="h-4 w-16" />
                          ) : (
                            <>
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IT Team Permissions</CardTitle>
          <CardDescription>
            Grant special access to IT team members for Lead Tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingItUsers ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : itTeamUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No approved IT team members found
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="user">Select IT User</Label>
                <Select 
                  value={selectedUser} 
                  onValueChange={(value) => {
                    setSelectedUser(value);
                    // Set the permission dropdown to the user's current permission
                    const user = itTeamUsers.find(u => u.id === value);
                    setSelectedPermission(user?.permissions?.leadTracking || 'none');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose IT team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {itTeamUsers.map((user) => {
                      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                      const currentPermission = user.permissions?.leadTracking || 'none';
                      return (
                        <SelectItem key={user.id} value={user.id}>
                          {userName} {currentPermission !== 'none' && `(${currentPermission === 'crud' ? 'Full Access' : 'Read Only'})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="permission">Permission Level</Label>
                <Select 
                  value={selectedPermission} 
                  onValueChange={setSelectedPermission}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select permission level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Access</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                    <SelectItem value="crud">Editor Access</SelectItem>
                  </SelectContent>
                </Select>
                {selectedUser && (
                  <p className="text-xs text-muted-foreground">
                    Current: {(() => {
                      const user = itTeamUsers.find(u => u.id === selectedUser);
                      const current = user?.permissions?.leadTracking || 'none';
                      return current === 'crud' ? 'Full CRUD Access' : current === 'read' ? 'Read Only' : 'No Access';
                    })()}
                  </p>
                )}
              </div>

              <Button 
                onClick={handleGrantPermission} 
                disabled={!selectedUser || grantingPermission}
              >
                {grantingPermission ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  'Grant Permission'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>View and manage user roles in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-accent rounded-md">
              <strong>Admin:</strong> Full access to all modules including settings
            </div>
            <div className="p-3 bg-accent rounded-md">
              <strong>Operations Team:</strong> Full CRUD access to Lead Tracking and employee management
            </div>
            <div className="p-3 bg-accent rounded-md">
              <strong>IT Team:</strong> Denied by default, requires admin approval for specific access
            </div>
            <div className="p-3 bg-accent rounded-md">
              <strong>Employee:</strong> Access to Clock In/Out and personal information only
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Management</CardTitle>
          <CardDescription>View and manage task history</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push('/task-history')} variant="outline">
            <History className="h-4 w-4 mr-2" />
            View Task History
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>General system settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input id="company" defaultValue="We Will Australia" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select defaultValue="aest">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aest">AEST (Sydney)</SelectItem>
                <SelectItem value="acst">ACST (Adelaide)</SelectItem>
                <SelectItem value="awst">AWST (Perth)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* User Profile View Dialog */}
      {viewingProfileUserId && (
        <UserProfileViewDialog
          open={!!viewingProfileUserId}
          onOpenChange={(open) => {
            if (!open) {
              setViewingProfileUserId(null);
              setViewingProfileUserName('');
            }
          }}
          userId={viewingProfileUserId}
          userName={viewingProfileUserName}
        />
      )}

      {/* Set/Update Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUserForLocation ? (
                <>
                  {allLocations.find(loc => loc.userId === selectedUserForLocation.id)
                    ? 'Update' : 'Set'} Work From Home Location
                </>
              ) : 'Set Work From Home Location'}
            </DialogTitle>
            <DialogDescription>
              {selectedUserForLocation && (
                <>
                  Set or update the work from home location for{' '}
                  <strong>
                    {selectedUserForLocation.name || 
                      `${selectedUserForLocation.firstName || ''} ${selectedUserForLocation.lastName || ''}`.trim() || 
                      selectedUserForLocation.email}
                  </strong>
                  . By default, users can only clock in/out within 50 meters of this location. You can enable "Allow work from any location" to override this restriction.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <div className="space-y-2 flex-1">
                <Label htmlFor="location-latitude">Latitude</Label>
                <Input
                  id="location-latitude"
                  type="number"
                  step="any"
                  value={locationLatitude}
                  onChange={(e) => setLocationLatitude(e.target.value)}
                  placeholder="e.g., -37.8136"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="location-longitude">Longitude</Label>
                <Input
                  id="location-longitude"
                  type="number"
                  step="any"
                  value={locationLongitude}
                  onChange={(e) => setLocationLongitude(e.target.value)}
                  placeholder="e.g., 144.9631"
                />
              </div>
            </div>
            <div className="flex items-start justify-between p-4 border-2 rounded-lg bg-accent/50 gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="allow-anywhere" className="text-base font-semibold cursor-pointer">
                    Allow work from any location
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, this user can clock in/out from anywhere, not just their preferred work from home location. When disabled, they must be within 50 meters of the approved location.
                </p>
              </div>
              <Switch
                id="allow-anywhere"
                checked={allowWorkFromAnywhere}
                onCheckedChange={setAllowWorkFromAnywhere}
                className="mt-1 flex-shrink-0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-address">Address (Optional)</Label>
              <Textarea
                id="location-address"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="e.g., 123 Main St, Melbourne, VIC 3000"
                rows={2}
              />
            </div>
            {locationLatitude && locationLongitude && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Preview Location</Label>
                  <a
                    href={`https://www.google.com/maps?q=${locationLatitude},${locationLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    Open in Google Maps →
                  </a>
                </div>
                <div className="w-full h-[300px] rounded-lg overflow-hidden border">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${locationLatitude},${locationLongitude}&hl=en&z=15&output=embed`}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLocationDialogOpen(false);
                setSelectedUserForLocation(null);
                setLocationLatitude('');
                setLocationLongitude('');
                setLocationAddress('');
                setAllowWorkFromAnywhere(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUserLocation}
              disabled={savingLocation || !locationLatitude || !locationLongitude}
            >
              {savingLocation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Location'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation Dialog */}
      <AlertDialog open={!!deleteLocationId} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work From Home Location</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const locationToDelete = allLocations.find(loc => loc.id === deleteLocationId);
                const user = locationToDelete ? allUsers.find(u => u.id === locationToDelete.userId) : null;
                const userName = user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email) : (locationToDelete?.userName || 'Unknown User');
                return `Are you sure you want to delete the work from home location for ${userName}? This action cannot be undone. The user will need to set a new location if they want to work from home.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLocation}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              disabled={deletingLocation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLocation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Location'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
