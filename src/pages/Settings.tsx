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
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { UserProfileViewDialog } from '@/components/UserProfileViewDialog';
import { CheckCircle2, XCircle } from 'lucide-react';

const Settings = () => {
  const { approveUser, rejectUser, getPendingUsers, getAllUsers, user: currentUser } = useAuth();
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

  useEffect(() => {
    loadPendingUsers();
    loadAllUsers();
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

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View all users, their details, and manage job contracts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedJobRole} onValueChange={setSelectedJobRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by job role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Job Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operationsstaff">Operations Staff</SelectItem>
                <SelectItem value="itteam">IT Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {usersLoading ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-4 pb-2 border-b">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-20" />
                    ))}
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
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
            // Filter users based on search query and job role
            const filteredUsers = allUsers.filter((user) => {
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
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery || selectedJobRole !== 'all' ? 'No users found matching your filters' : 'No users found'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Profile Completed</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Contract</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                      return (
                    <TableRow 
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
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
                    >
                      <TableCell className="font-medium">
                        {userName}
                      </TableCell>
                      <TableCell>{user.employeeId || 'N/A'}</TableCell>
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
                            <SelectTrigger className="w-[140px] [&>span]:text-left [&>span]:m-0">
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
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.approvedByName || user.approvedBy || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.contractUrl ? (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600" />
                              <a
                                href={user.contractUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline flex items-center gap-1"
                              >
                                <Download className="h-3 w-3" />
                                View
                              </a>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">No contract</span>
                            </div>
                          )}
                          <input
                            type="file"
                            ref={(el) => {
                              fileInputRefs.current[user.id] = el;
                            }}
                            accept=".pdf,.doc,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(user.id, file);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRefs.current[user.id]?.click()}
                            disabled={uploading[user.id]}
                          >
                            {uploading[user.id] ? (
                              <Skeleton className="h-4 w-16" />
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-1" />
                                {user.contractUrl ? 'Replace' : 'Upload'}
                              </>
                            )}
                          </Button>
                        </div>
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
    </div>
  );
};

export default Settings;
