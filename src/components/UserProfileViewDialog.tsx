import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, User, Phone, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';

interface UserProfileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

type UploadKey = 'profilePhoto' | 'idFrontPhoto' | 'idBackPhoto' | 'selfiePhoto' | 'passportPhoto' | 'contractDoc' | 'visaNotice';

interface ProfileData {
  fullName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  jobRole?: string;
  workLocation?: string;
  residentialAddress?: string;
  postalCode?: string;
  gender?: string;
  employeeType?: string;
  tfnAbn?: string;
  idNumber?: string;
  residingInAu?: boolean;
  visaType?: string;
  visaSubclass?: string;
  emergency?: {
    fullName?: string;
    relationship?: string;
    phone?: string;
  };
  declaration1?: boolean;
  declaration2?: boolean;
  profilePhoto?: string;
  idFrontPhoto?: string;
  idBackPhoto?: string;
  selfiePhoto?: string;
  passportPhoto?: string;
  contractDoc?: string;
  visaNotice?: string;
  updatedAt?: string;
}

const documentLabels: Record<UploadKey, string> = {
  profilePhoto: 'Profile Photo',
  idFrontPhoto: 'ID Front Photo',
  idBackPhoto: 'ID Back Photo',
  selfiePhoto: 'Selfie Photo',
  passportPhoto: 'Passport Photo',
  contractDoc: 'Contract Document',
  visaNotice: 'Visa Grant Notice',
};

export const UserProfileViewDialog: React.FC<UserProfileViewDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
}) => {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (open && userId) {
      loadProfileData();
    } else {
      setProfileData(null);
      setLoading(true);
    }
  }, [open, userId]);

  const loadProfileData = async () => {
    if (!db) {
      console.error('Firebase is not initialized');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const profileDoc = await getDoc(doc(db, 'profiles', userId));
      
      if (profileDoc.exists()) {
        setProfileData(profileDoc.data() as ProfileData);
      } else {
        setProfileData(null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDocument = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return format(date, 'MMMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  const displayName = profileData?.fullName || profileData?.preferredName || userName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">User Profile: {displayName}</DialogTitle>
          <DialogDescription>
            View user profile details, documents, emergency contacts, and consent information
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ) : !profileData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No profile data found for this user.</p>
            <p className="text-sm mt-2">The user may not have completed their profile yet.</p>
          </div>
        ) : (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="guardians" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Guardians
              </TabsTrigger>
              <TabsTrigger value="consent" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Consent
              </TabsTrigger>
            </TabsList>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {profileData.profilePhoto ? (
                      <img
                        src={profileData.profilePhoto}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-border"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                        <User className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-xl">
                        {displayName}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {profileData.jobRole || 'No role specified'}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                      <p className="text-sm">{profileData.fullName || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Preferred Name</p>
                      <p className="text-sm">{profileData.preferredName || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                      <p className="text-sm">{profileData.email || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                      <p className="text-sm">{profileData.phone || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                      <p className="text-sm">{formatDate(profileData.dob) || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Job Role/Title</p>
                      <p className="text-sm">{profileData.jobRole || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Work Location</p>
                      <p className="text-sm">{profileData.workLocation || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Gender</p>
                      <p className="text-sm">{profileData.gender || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Employee Type</p>
                      <p className="text-sm">{profileData.employeeType || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Residential Address</p>
                      <p className="text-sm">{profileData.residentialAddress || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Postal Code</p>
                      <p className="text-sm">{profileData.postalCode || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">TFN/ABN</p>
                      <p className="text-sm">{profileData.tfnAbn || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">ID Number</p>
                      <p className="text-sm">{profileData.idNumber || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Residing in Australia</p>
                      <div className="text-sm">
                        {profileData.residingInAu ? (
                          <Badge variant="default">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </div>
                    </div>
                    {profileData.residingInAu && (
                      <>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Visa Type</p>
                          <p className="text-sm">{profileData.visaType || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">Visa Subclass</p>
                          <p className="text-sm">{profileData.visaSubclass || 'N/A'}</p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Document Uploads</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Sri Lankan NIC number / Driver License number or Australian Driver License Number</Label>
                    <p className="text-sm">{profileData.idNumber || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Front ID Photo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">
                        Front photo of your Sri Lankan NIC / Driver license or Australian driver license
                      </label>
                      {profileData.idFrontPhoto ? (
                        <div className="relative">
                          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={profileData.idFrontPhoto}
                                    alt="ID Front"
                                    className="h-16 w-16 object-cover rounded border border-border"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">Saved Document</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                      Saved
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(profileData.idFrontPhoto, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const filename = `ID-Front-${displayName}-${Date.now()}.jpg`;
                                handleDownloadDocument(profileData.idFrontPhoto!, filename);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">No document uploaded</p>
                              <p className="text-xs text-muted-foreground">
                                JPEG, PNG, JPG - Up to 50MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Back ID Photo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">
                        Back photo of your Sri Lankan NIC / driver license or Australian driver license
                      </label>
                      {profileData.idBackPhoto ? (
                        <div className="relative">
                          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={profileData.idBackPhoto}
                                    alt="ID Back"
                                    className="h-16 w-16 object-cover rounded border border-border"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">Saved Document</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                      Saved
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(profileData.idBackPhoto, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const filename = `ID-Back-${displayName}-${Date.now()}.jpg`;
                                handleDownloadDocument(profileData.idBackPhoto!, filename);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">No document uploaded</p>
                              <p className="text-xs text-muted-foreground">
                                JPEG, PNG, JPG - Up to 50MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selfie Photo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">
                        Clear photo of yourself with a white background to use as the company ID
                      </label>
                      {profileData.selfiePhoto ? (
                        <div className="relative">
                          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={profileData.selfiePhoto}
                                    alt="Selfie"
                                    className="h-16 w-16 object-cover rounded border border-border"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">Saved Document</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                      Saved
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(profileData.selfiePhoto, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const filename = `Selfie-${displayName}-${Date.now()}.jpg`;
                                handleDownloadDocument(profileData.selfiePhoto!, filename);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">No document uploaded</p>
                              <p className="text-xs text-muted-foreground">
                                JPEG, PNG, JPG - Up to 50MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Passport Photo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium leading-none">
                        A photo of your passport detail page
                      </label>
                      {profileData.passportPhoto ? (
                        <div className="relative">
                          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img
                                    src={profileData.passportPhoto}
                                    alt="Passport"
                                    className="h-16 w-16 object-cover rounded border border-border"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">Saved Document</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                      Saved
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(profileData.passportPhoto, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const filename = `Passport-${displayName}-${Date.now()}.jpg`;
                                handleDownloadDocument(profileData.passportPhoto!, filename);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">No document uploaded</p>
                              <p className="text-xs text-muted-foreground">
                                JPEG, PNG, JPG - Up to 50MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contract Document - Full Width */}
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-sm font-medium leading-none">
                        Contract Document (As PDF)
                      </label>
                      {profileData.contractDoc ? (
                        <div className="relative">
                          <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="h-16 w-16 flex items-center justify-center bg-background rounded border border-border">
                                    <FileText className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">Saved Document</p>
                                  <p className="text-xs text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                      Saved
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(profileData.contractDoc, '_blank')}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const filename = `Contract-${displayName}-${Date.now()}.pdf`;
                                handleDownloadDocument(profileData.contractDoc!, filename);
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                          <div className="flex flex-col items-center gap-3">
                            <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">No document uploaded</p>
                              <p className="text-xs text-muted-foreground">
                                PDF - Up to 50MB
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Visa Section */}
                  {profileData.residingInAu && (
                    <div className="ml-4 sm:ml-6 space-y-4 p-4 border-l-2 border-accent">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Visa Type</Label>
                        <p className="text-sm">{profileData.visaType || 'N/A'}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Visa Subclass</Label>
                        <p className="text-sm">{profileData.visaSubclass || 'N/A'}</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">
                          A copy of your visa grant notice (Image)
                        </label>
                        {profileData.visaNotice ? (
                          <div className="relative">
                            <div className="border-2 border-border rounded-lg p-4 bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="relative">
                                    <img
                                      src={profileData.visaNotice}
                                      alt="Visa Notice"
                                      className="h-16 w-16 object-cover rounded border border-border"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">Saved Document</p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                                        Saved
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(profileData.visaNotice, '_blank')}
                              >
                                View
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const filename = `Visa-Notice-${displayName}-${Date.now()}.jpg`;
                                  handleDownloadDocument(profileData.visaNotice!, filename);
                                }}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed rounded-lg p-8 text-center border-muted-foreground/25">
                            <div className="flex flex-col items-center gap-3">
                              <div className="rounded-full border-2 border-muted-foreground/50 p-3">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-medium">No document uploaded</p>
                                <p className="text-xs text-muted-foreground">
                                  JPEG, PNG, JPG - Up to 50MB
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Guardians Tab (Emergency Contact) */}
            <TabsContent value="guardians" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Emergency Contact Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {profileData.emergency ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <p className="text-sm">{profileData.emergency.fullName || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Relationship</p>
                        <p className="text-sm">{profileData.emergency.relationship || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Contact Number</p>
                        <p className="text-sm">{profileData.emergency.phone || 'N/A'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No emergency contact information provided.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Consent Tab (Declaration) */}
            <TabsContent value="consent" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Declaration and Consent</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Declaration 1</p>
                    <p className="text-sm text-muted-foreground">
                      I declare that the information I have provided is accurate and true to the best of my knowledge.
                    </p>
                    <div className="mt-2">
                      {profileData.declaration1 ? (
                        <Badge variant="default">Accepted</Badge>
                      ) : (
                        <Badge variant="secondary">Not Accepted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Declaration 2</p>
                    <p className="text-sm text-muted-foreground">
                      I consent to WE WILL AUSTRALIA storing and using my information for internal purposes.
                    </p>
                    <div className="mt-2">
                      {profileData.declaration2 ? (
                        <Badge variant="default">Accepted</Badge>
                      ) : (
                        <Badge variant="secondary">Not Accepted</Badge>
                      )}
                    </div>
                  </div>
                  {profileData.updatedAt && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        Last updated: {formatDate(profileData.updatedAt)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

