import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, EyeOff, Edit, Trash2, AlertCircle, Filter, X, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Lead {
  id: string;
  leadID: string;
  area: string;
  typeOfBusiness: string;
  businessName: string;
  businessContactNumber: string;
  businessEmail: string;
  websiteAvailability: 'Available' | 'Not available';
  websiteLink: string;
  websiteRemarks: string;
  facebook: string;
  facebookLink: string;
  facebookRemarks: string;
  instagram: string;
  instagramLink: string;
  instagramRemarks: string;
  serviceTypeWeTargetFor: string;
  overallRemarks: string;
  workDate: string;
  checkedBy: string;
  emailStatus: string;
  specialNotes: string;
  createdAt: string;
}

const BUSINESS_TYPES = [
  'Hotels/ Restaurants/ Cafes',
  'Pre-Schools/ Kindergartens/ Day Care Centers',
  'Small Clinics/Pharmacies',
  'Small Boutiques / Clothing Stores',
  'Commercial Businesses'
];

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: '1',
      leadID: 'LD001',
      area: 'Sydney',
      typeOfBusiness: 'Hotels/ Restaurants/ Cafes',
      businessName: 'John Builder',
      businessContactNumber: '+61 400 123 456',
      businessEmail: 'john@example.com',
      websiteAvailability: 'Available',
      websiteLink: 'https://johnbuilder.com',
      websiteRemarks: 'Professional website',
      facebook: 'Yes',
      facebookLink: 'https://facebook.com/johnbuilder',
      facebookRemarks: 'Active page',
      instagram: 'Yes',
      instagramLink: 'https://instagram.com/johnbuilder',
      instagramRemarks: 'Regular posts',
      serviceTypeWeTargetFor: 'Construction',
      overallRemarks: 'Good potential client',
      workDate: '2025-01-15',
      checkedBy: 'Admin',
      emailStatus: 'Sent',
      specialNotes: 'Follow up required',
      createdAt: '2025-01-09'
    },
    {
      id: '2',
      leadID: 'LD002',
      area: 'Melbourne',
      typeOfBusiness: 'Small Clinics/Pharmacies',
      businessName: 'Sarah Contractor',
      businessContactNumber: '+61 400 234 567',
      businessEmail: 'sarah@example.com',
      websiteAvailability: 'Not available',
      websiteLink: '',
      websiteRemarks: 'No website yet',
      facebook: 'No',
      facebookLink: '',
      facebookRemarks: '',
      instagram: 'Yes',
      instagramLink: 'https://instagram.com/sarahcontractor',
      instagramRemarks: 'New account',
      serviceTypeWeTargetFor: 'Healthcare',
      overallRemarks: 'Interested in services',
      workDate: '2025-01-20',
      checkedBy: 'Operations Staff',
      emailStatus: 'Pending',
      specialNotes: '',
      createdAt: '2025-01-08'
    },
    {
      id: '3',
      leadID: 'LD003',
      area: 'Brisbane',
      typeOfBusiness: 'Commercial Businesses',
      businessName: 'Mike Developer',
      businessContactNumber: '+61 400 345 678',
      businessEmail: 'mike@example.com',
      websiteAvailability: 'Available',
      websiteLink: 'https://mikedeveloper.com',
      websiteRemarks: 'Modern design',
      facebook: 'Yes',
      facebookLink: 'https://facebook.com/mikedeveloper',
      facebookRemarks: 'Engaged audience',
      instagram: 'No',
      instagramLink: '',
      instagramRemarks: '',
      serviceTypeWeTargetFor: 'IT Services',
      overallRemarks: 'Qualified lead',
      workDate: '2025-01-25',
      checkedBy: 'Admin',
      emailStatus: 'Replied',
      specialNotes: 'High priority',
      createdAt: '2025-01-07'
    },
  ]);

  const [open, setOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    leadID: '',
    area: '',
    typeOfBusiness: '',
    businessName: '',
    websiteAvailability: '',
    emailStatus: '',
    checkedBy: '',
  });

  const canEdit = user?.role === 'admin' || user?.role === 'operationsstaff' || 
                  (user?.role === 'itteam' && user.permissions?.leadTracking === 'crud');
  const canView = canEdit || (user?.role === 'itteam' && user.permissions?.leadTracking === 'read');

  if (user?.role === 'itteam' && !user.permissions?.leadTracking) {
    return (
      <div className="space-y-6">
        <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              You don't have permission to access Lead Tracking. Please contact an administrator to request access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nativeFormData = new FormData(e.currentTarget);
    
    const leadData: Omit<Lead, 'id' | 'createdAt'> = {
      leadID: nativeFormData.get('leadID') as string || formData.leadID || '',
      area: nativeFormData.get('area') as string || formData.area || '',
      typeOfBusiness: formData.typeOfBusiness || '',
      businessName: nativeFormData.get('businessName') as string || formData.businessName || '',
      businessContactNumber: nativeFormData.get('businessContactNumber') as string || formData.businessContactNumber || '',
      businessEmail: nativeFormData.get('businessEmail') as string || formData.businessEmail || '',
      websiteAvailability: (formData.websiteAvailability as 'Available' | 'Not available') || 'Not available',
      websiteLink: nativeFormData.get('websiteLink') as string || formData.websiteLink || '',
      websiteRemarks: nativeFormData.get('websiteRemarks') as string || formData.websiteRemarks || '',
      facebook: formData.facebook || '',
      facebookLink: nativeFormData.get('facebookLink') as string || formData.facebookLink || '',
      facebookRemarks: nativeFormData.get('facebookRemarks') as string || formData.facebookRemarks || '',
      instagram: formData.instagram || '',
      instagramLink: nativeFormData.get('instagramLink') as string || formData.instagramLink || '',
      instagramRemarks: nativeFormData.get('instagramRemarks') as string || formData.instagramRemarks || '',
      serviceTypeWeTargetFor: nativeFormData.get('serviceTypeWeTargetFor') as string || formData.serviceTypeWeTargetFor || '',
      overallRemarks: nativeFormData.get('overallRemarks') as string || formData.overallRemarks || '',
      workDate: nativeFormData.get('workDate') as string || formData.workDate || '',
      checkedBy: nativeFormData.get('checkedBy') as string || formData.checkedBy || '',
      emailStatus: nativeFormData.get('emailStatus') as string || formData.emailStatus || '',
      specialNotes: nativeFormData.get('specialNotes') as string || formData.specialNotes || '',
    };

    if (editingLead) {
      // Update existing lead
      setLeads(leads.map(lead => 
        lead.id === editingLead.id 
          ? { ...lead, ...leadData }
          : lead
      ));
      toast({
        title: 'Lead Updated',
        description: 'Lead has been updated successfully.',
      });
      setEditingLead(null);
    } else {
      // Add new lead
      const newLead: Lead = {
        ...leadData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split('T')[0],
      };
      setLeads([...leads, newLead]);
    toast({
      title: 'Lead Added',
      description: 'New lead has been added successfully.',
    });
    setOpen(false);
    }
    setFormData({});
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      typeOfBusiness: lead.typeOfBusiness,
      websiteAvailability: lead.websiteAvailability,
      facebook: lead.facebook,
      instagram: lead.instagram,
    });
    setOpen(true);
  };

  const handleDelete = (leadId: string) => {
    setLeads(leads.filter(lead => lead.id !== leadId));
    setDeleteConfirm(null);
    toast({
      title: 'Lead Deleted',
      description: 'Lead has been deleted successfully.',
    });
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingLead(null);
    setFormData({});
  };

  const filteredLeads = leads.filter(lead => {
    // Search across multiple fields
    const matchesSearch = !searchQuery || 
      lead.leadID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.typeOfBusiness.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.businessContactNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.businessEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.serviceTypeWeTargetFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.checkedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.emailStatus.toLowerCase().includes(searchQuery.toLowerCase());

    // Apply specific filters
    const matchesFilters = 
      (!filters.leadID || lead.leadID.toLowerCase().includes(filters.leadID.toLowerCase())) &&
      (!filters.area || lead.area.toLowerCase().includes(filters.area.toLowerCase())) &&
      (!filters.typeOfBusiness || lead.typeOfBusiness === filters.typeOfBusiness) &&
      (!filters.businessName || lead.businessName.toLowerCase().includes(filters.businessName.toLowerCase())) &&
      (!filters.websiteAvailability || lead.websiteAvailability === filters.websiteAvailability) &&
      (!filters.emailStatus || lead.emailStatus.toLowerCase().includes(filters.emailStatus.toLowerCase())) &&
      (!filters.checkedBy || lead.checkedBy.toLowerCase().includes(filters.checkedBy.toLowerCase()));

    return matchesSearch && matchesFilters;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      leadID: '',
      area: '',
      typeOfBusiness: '',
      businessName: '',
      websiteAvailability: '',
      emailStatus: '',
      checkedBy: '',
    });
  };

  const hasActiveFilters = searchQuery !== '' || Object.values(filters).some(value => value !== '');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Lead Tracking</h1>
          <p className="text-muted-foreground mt-1">Manage potential client leads</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingLead(null);
                setFormData({});
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
                <DialogDescription>{editingLead ? 'Update lead information' : 'Enter potential client information'}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leadID">Lead ID *</Label>
                    <Input id="leadID" name="leadID" placeholder="LD001" defaultValue={editingLead?.leadID || ''} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Area *</Label>
                    <Input id="area" name="area" placeholder="Sydney" defaultValue={editingLead?.area || ''} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="typeOfBusiness">Type of Business *</Label>
                    <Select 
                      name="typeOfBusiness" 
                      value={formData.typeOfBusiness || editingLead?.typeOfBusiness || ''} 
                      onValueChange={(value) => setFormData({ ...formData, typeOfBusiness: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input id="businessName" name="businessName" placeholder="Business name" defaultValue={editingLead?.businessName || ''} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessContactNumber">Business Contact Number</Label>
                    <Input id="businessContactNumber" name="businessContactNumber" placeholder="+61 400 123 456" type="tel" defaultValue={editingLead?.businessContactNumber || ''} />
                  </div>
                <div className="space-y-2">
                    <Label htmlFor="businessEmail">Business Email</Label>
                    <Input id="businessEmail" name="businessEmail" type="email" placeholder="email@example.com" defaultValue={editingLead?.businessEmail || ''} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="websiteAvailability">Website Availability</Label>
                    <Select 
                      name="websiteAvailability" 
                      value={formData.websiteAvailability || editingLead?.websiteAvailability || ''}
                      onValueChange={(value) => setFormData({ ...formData, websiteAvailability: value as 'Available' | 'Not available' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select availability" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Available">Available</SelectItem>
                        <SelectItem value="Not available">Not available</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="websiteLink">Website Link</Label>
                    <Input id="websiteLink" name="websiteLink" type="url" placeholder="https://example.com" defaultValue={editingLead?.websiteLink || ''} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="websiteRemarks">Website Remarks</Label>
                    <Textarea id="websiteRemarks" name="websiteRemarks" placeholder="Enter remarks about the website" defaultValue={editingLead?.websiteRemarks || ''} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Select 
                      name="facebook" 
                      value={formData.facebook || editingLead?.facebook || ''}
                      onValueChange={(value) => setFormData({ ...formData, facebook: value })}
                    >
                    <SelectTrigger>
                        <SelectValue placeholder="Yes/No" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="facebookLink">Facebook Link</Label>
                    <Input id="facebookLink" name="facebookLink" type="url" placeholder="https://facebook.com/..." defaultValue={editingLead?.facebookLink || ''} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="facebookRemarks">Facebook Remarks</Label>
                    <Textarea id="facebookRemarks" name="facebookRemarks" placeholder="Enter remarks about Facebook" defaultValue={editingLead?.facebookRemarks || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Select 
                      name="instagram" 
                      value={formData.instagram || editingLead?.instagram || ''}
                      onValueChange={(value) => setFormData({ ...formData, instagram: value })}
                    >
                    <SelectTrigger>
                        <SelectValue placeholder="Yes/No" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagramLink">Instagram Link</Label>
                    <Input id="instagramLink" name="instagramLink" type="url" placeholder="https://instagram.com/..." defaultValue={editingLead?.instagramLink || ''} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="instagramRemarks">Instagram Remarks</Label>
                    <Textarea id="instagramRemarks" name="instagramRemarks" placeholder="Enter remarks about Instagram" defaultValue={editingLead?.instagramRemarks || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceTypeWeTargetFor">Service Type We Target For</Label>
                    <Input id="serviceTypeWeTargetFor" name="serviceTypeWeTargetFor" placeholder="e.g., Construction, Healthcare" defaultValue={editingLead?.serviceTypeWeTargetFor || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workDate">Work Date</Label>
                    <Input id="workDate" name="workDate" type="date" defaultValue={editingLead?.workDate || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkedBy">Checked By</Label>
                    <Input id="checkedBy" name="checkedBy" placeholder="Admin" defaultValue={editingLead?.checkedBy || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailStatus">Email Status</Label>
                    <Input id="emailStatus" name="emailStatus" placeholder="Sent, Pending, Replied" defaultValue={editingLead?.emailStatus || ''} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="overallRemarks">Overall Remarks</Label>
                    <Textarea id="overallRemarks" name="overallRemarks" placeholder="Enter overall remarks" defaultValue={editingLead?.overallRemarks || ''} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="specialNotes">Special Notes</Label>
                    <Textarea id="specialNotes" name="specialNotes" placeholder="Enter any special notes" defaultValue={editingLead?.specialNotes || ''} />
                  </div>
                </div>
                <Button type="submit" className="w-full">{editingLead ? 'Update Lead' : 'Add Lead'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {user?.role === 'itteam' && user.permissions?.leadTracking === 'read' && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-800 dark:text-yellow-200">Read-Only Access</CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              You have read-only permission. Contact an admin for edit access.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{leads.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">With Website</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold">{leads.filter(l => l.websiteAvailability === 'Available').length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Without Website</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-gray-600" />
              <span className="text-2xl font-bold">{leads.filter(l => l.websiteAvailability === 'Not available').length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lead List</CardTitle>
          <CardDescription>All potential client leads with required fields</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by ID, name, area, email, contact, service type, checked by, or email status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters Section */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters</span>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-leadID" className="text-xs">Lead ID</Label>
                <Input
                  id="filter-leadID"
                  placeholder="Filter by Lead ID"
                  value={filters.leadID}
                  onChange={(e) => setFilters({ ...filters, leadID: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-area" className="text-xs">Area</Label>
                <Input
                  id="filter-area"
                  placeholder="Filter by Area"
                  value={filters.area}
                  onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-typeOfBusiness" className="text-xs">Type of Business</Label>
                <Select
                  value={filters.typeOfBusiness || undefined}
                  onValueChange={(value) => setFilters({ ...filters, typeOfBusiness: value === 'all' ? '' : value })}
                >
                  <SelectTrigger id="filter-typeOfBusiness">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-businessName" className="text-xs">Business Name</Label>
                <Input
                  id="filter-businessName"
                  placeholder="Filter by Business Name"
                  value={filters.businessName}
                  onChange={(e) => setFilters({ ...filters, businessName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-websiteAvailability" className="text-xs">Website Availability</Label>
                <Select
                  value={filters.websiteAvailability || undefined}
                  onValueChange={(value) => setFilters({ ...filters, websiteAvailability: value === 'all' ? '' : value })}
                >
                  <SelectTrigger id="filter-websiteAvailability">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Not available">Not available</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-emailStatus" className="text-xs">Email Status</Label>
                <Input
                  id="filter-emailStatus"
                  placeholder="Filter by Email Status"
                  value={filters.emailStatus}
                  onChange={(e) => setFilters({ ...filters, emailStatus: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-checkedBy" className="text-xs">Checked By</Label>
                <Input
                  id="filter-checkedBy"
                  placeholder="Filter by Checked By"
                  value={filters.checkedBy}
                  onChange={(e) => setFilters({ ...filters, checkedBy: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Type of Business</TableHead>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Business Contact Number</TableHead>
                  <TableHead>Business Email</TableHead>
                  <TableHead>Website Availability</TableHead>
                  <TableHead>Website Link</TableHead>
                  <TableHead>Website Remarks</TableHead>
                  <TableHead>Facebook</TableHead>
                  <TableHead>Facebook Link</TableHead>
                  <TableHead>Facebook Remarks</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Instagram Link</TableHead>
                  <TableHead>Instagram Remarks</TableHead>
                  <TableHead>Service Type We Target For</TableHead>
                  <TableHead>Overall Remarks</TableHead>
                  <TableHead>Work Date</TableHead>
                  <TableHead>Checked by</TableHead>
                  <TableHead>Email Status</TableHead>
                  <TableHead>Special Notes</TableHead>
                {canEdit && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 22 : 21} className="text-center py-8 text-muted-foreground">
                      No leads found matching the filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.leadID}</TableCell>
                      <TableCell>{lead.area}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{lead.typeOfBusiness}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{lead.businessName}</TableCell>
                      <TableCell>{lead.businessContactNumber}</TableCell>
                      <TableCell>{lead.businessEmail}</TableCell>
                  <TableCell>
                        <Badge
                          variant={lead.websiteAvailability === 'Available' ? 'default' : 'secondary'}
                          className={lead.websiteAvailability === 'Available' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : ''}
                        >
                          {lead.websiteAvailability}
                        </Badge>
                  </TableCell>
                  <TableCell>
                        {lead.websiteLink ? (
                          <a href={lead.websiteLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                            {lead.websiteLink.length > 30 ? `${lead.websiteLink.substring(0, 30)}...` : lead.websiteLink}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.websiteRemarks || '-'}</TableCell>
                      <TableCell>{lead.facebook}</TableCell>
                      <TableCell>
                        {lead.facebookLink ? (
                          <a href={lead.facebookLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                            {lead.facebookLink.length > 30 ? `${lead.facebookLink.substring(0, 30)}...` : lead.facebookLink}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.facebookRemarks || '-'}</TableCell>
                      <TableCell>{lead.instagram}</TableCell>
                      <TableCell>
                        {lead.instagramLink ? (
                          <a href={lead.instagramLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                            {lead.instagramLink.length > 30 ? `${lead.instagramLink.substring(0, 30)}...` : lead.instagramLink}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.instagramRemarks || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.serviceTypeWeTargetFor || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.overallRemarks || '-'}</TableCell>
                      <TableCell>{lead.workDate}</TableCell>
                      <TableCell>{lead.checkedBy}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{lead.emailStatus}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{lead.specialNotes || '-'}</TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(lead)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(lead.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Leads;
