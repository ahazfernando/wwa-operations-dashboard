"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  X, 
  Download, 
  Eye,
  FileText,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  User,
  Users,
  Calendar,
  MoreVertical,
  Upload,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  UserCheck,
  Bell,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DragDropFileUpload } from '@/components/DragDropFileUpload';
import { uploadFileToCloudinary } from '@/lib/cloudinary';
import { 
  CandidateCV, 
  CandidateStatus, 
  CandidatePriority, 
  JobRole,
  ExperienceLevel
} from '@/types/candidate-cv';
import {
  getAllCandidateCVs,
  createCandidateCV,
  updateCandidateCV,
  deleteCandidateCV,
  getCandidateCVsAnalytics,
  subscribeToCandidateCVs,
  addCandidateNote,
  deleteCandidateNote
} from '@/lib/candidate-cvs';
import { CandidateAnalytics } from '@/types/candidate-cv';

const STATUSES: CandidateStatus[] = ['New', 'Reviewing', 'Shortlisted', 'Interview Scheduled', 'Rejected', 'Hired', 'On Hold'];
const PRIORITIES: CandidatePriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const JOB_ROLES: JobRole[] = ['Chef / Cook', 'Head Chef', 'Sous Chef', 'Chef De Partie', 'Commis Chef', 'Kitchen Hand', 'Waiter / Waitress', 'Barista', 'Manager', 'Other'];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ['Entry Level', 'Junior (1-3 years)', 'Mid Level (3-5 years)', 'Senior (5-10 years)', 'Expert (10+ years)'];

const STATUS_COLORS: Record<CandidateStatus, string> = {
  'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'Reviewing': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  'Shortlisted': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  'Interview Scheduled': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'Rejected': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  'Hired': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  'On Hold': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
};

const PRIORITY_COLORS: Record<CandidatePriority, string> = {
  'Low': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
  'Medium': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'High': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'Urgent': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
};

const CandidateCVs = () => {
  const { user, getAllUsers } = useAuth();
  const [candidates, setCandidates] = useState<CandidateCV[]>([]);
  const [analytics, setAnalytics] = useState<CandidateAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateCV | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<CandidateCV | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '' as CandidateStatus | '',
    jobRole: '' as JobRole | '',
    priority: '' as CandidatePriority | '',
    experienceLevel: '' as ExperienceLevel | '',
    assignedTo: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvPreview, setCvPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [assignedRecruiter, setAssignedRecruiter] = useState<string>('');
  const [jobRoleOpen, setJobRoleOpen] = useState(false);
  const [jobRoleSearch, setJobRoleSearch] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    candidateName: '',
    email: '',
    phone: '',
    jobRole: [] as JobRole[],
    experienceLevel: '' as ExperienceLevel | '',
    location: '',
    notes: '',
    status: 'New' as CandidateStatus,
    priority: 'Medium' as CandidatePriority,
    tags: [] as string[],
  });

  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'all' | 'assigned'>(isAdmin ? 'all' : 'assigned');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Load candidates
  useEffect(() => {
    if (!user) return;

    const loadCandidates = async () => {
      try {
        setLoading(true);
        let fetchedCandidates = await getAllCandidateCVs(cleanFilters(true));
        
        // Filter by assigned resumes if on assigned tab and user is not admin
        if (activeTab === 'assigned' && user) {
          fetchedCandidates = fetchedCandidates.filter(
            candidate => candidate.assignedTo === user.id
          );
        }
        
        setCandidates(fetchedCandidates);
        
        // Only load analytics for admins
        if (isAdmin) {
          const analyticsData = await getCandidateCVsAnalytics();
          setAnalytics(analyticsData);
        }
      } catch (error) {
        console.error('Error loading candidates:', error);
        toast({
          title: 'Error',
          description: 'Failed to load candidate CVs',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadCandidates();
  }, [filters, isAdmin, searchQuery, activeTab, user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToCandidateCVs((updatedCandidates) => {
      // Filter by assigned resumes if on assigned tab and user is not admin
      let filtered = updatedCandidates;
      if (activeTab === 'assigned') {
        filtered = updatedCandidates.filter(
          candidate => candidate.assignedTo === user.id
        );
      }
      setCandidates(filtered);
    }, cleanFilters(false));

    return () => unsubscribe();
  }, [filters, isAdmin, user, activeTab]);

  // Load users for recruiter assignment
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getAllUsers();
        const approvedUsers = users.filter((u: any) => u.status === 'approved');
        setAllUsers(approvedUsers);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    if (user) {
      loadUsers();
    }
  }, [user, getAllUsers]);

  // Helper function to clean filters
  const cleanFilters = (includeSearch = false) => {
    const cleaned: {
      status?: CandidateStatus;
      jobRole?: JobRole;
      priority?: CandidatePriority;
      experienceLevel?: ExperienceLevel;
      assignedTo?: string;
      search?: string;
    } = {};
    
    if (filters.status !== '') {
      cleaned.status = filters.status;
    }
    if (filters.jobRole !== '') {
      cleaned.jobRole = filters.jobRole;
    }
    if (filters.priority !== '') {
      cleaned.priority = filters.priority;
    }
    if (filters.experienceLevel !== '') {
      cleaned.experienceLevel = filters.experienceLevel;
    }
    if (filters.assignedTo && filters.assignedTo !== '') {
      cleaned.assignedTo = filters.assignedTo;
    }
    if (includeSearch && searchQuery && searchQuery !== '') {
      cleaned.search = searchQuery;
    }
    
    return cleaned;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      candidateName: '',
      email: '',
      phone: '',
      jobRole: [] as JobRole[],
      experienceLevel: '' as ExperienceLevel | '',
      location: '',
      notes: '',
      status: 'New' as CandidateStatus,
      priority: 'Medium' as CandidatePriority,
      tags: [],
    });
    setCvFile(null);
    setCvPreview(null);
    setAssignedRecruiter('');
    setEditingCandidate(null);
    setJobRoleOpen(false);
    setJobRoleSearch('');
  };

  // Handle CV upload
  const handleCvUpload = async (file: File | null) => {
    if (!file) {
      setCvFile(null);
      setCvPreview(null);
      return;
    }

    // Validate file type
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

    setCvFile(file);
    setCvPreview(URL.createObjectURL(file));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !isAdmin) return;

    // Validate required fields
    if (!formData.candidateName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Candidate name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.jobRole || formData.jobRole.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Job role is required',
        variant: 'destructive',
      });
      return;
    }

    // Check if CV is uploaded (for new candidates) or exists (for editing)
    if (!editingCandidate && !cvFile) {
      toast({
        title: 'Validation Error',
        description: 'Please upload a CV file',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      let cvUrl = editingCandidate?.cvUrl || '';
      let cvFileName = editingCandidate?.cvFileName || '';

      // Upload CV if it's a new file
      if (cvFile) {
        const uploadResult = await uploadFileToCloudinary(cvFile, 'candidate-cvs');
        cvUrl = uploadResult.url;
        cvFileName = cvFile.name;
      }

      const candidateData: any = {
        candidateName: formData.candidateName.trim(),
        jobRole: Array.isArray(formData.jobRole) ? formData.jobRole : [formData.jobRole].filter(Boolean),
        cvUrl,
        cvFileName,
        status: formData.status,
        priority: formData.priority,
        tags: formData.tags,
        createdBy: user.id,
        createdByName: user.name || 'Unknown',
      };

      // Add optional fields
      if (formData.email.trim()) candidateData.email = formData.email.trim();
      if (formData.phone.trim()) candidateData.phone = formData.phone.trim();
      if (formData.experienceLevel) {
        candidateData.experienceLevel = formData.experienceLevel;
      }
      if (formData.location.trim()) candidateData.location = formData.location.trim();
      if (formData.notes.trim()) candidateData.notes = formData.notes.trim();

      // Handle recruiter assignment
      if (assignedRecruiter) {
        const selectedUser = allUsers.find(u => u.id === assignedRecruiter);
        if (selectedUser) {
          candidateData.assignedTo = selectedUser.id;
          candidateData.assignedToName = selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email;
        }
      }

      if (editingCandidate) {
        candidateData.updatedBy = user.id;
        candidateData.updatedByName = user.name || 'Unknown';
        await updateCandidateCV(editingCandidate.id, candidateData);
        toast({
          title: 'Success',
          description: 'Candidate CV updated successfully',
        });
      } else {
        await createCandidateCV(candidateData);
        toast({
          title: 'Success',
          description: 'Candidate CV created successfully',
        });
      }

      setOpen(false);
      resetForm();

      // Refresh analytics
      const analyticsData = await getCandidateCVsAnalytics();
      setAnalytics(analyticsData);
    } catch (error: any) {
      console.error('Error saving candidate CV:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save candidate CV',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle edit
  const handleEdit = (candidate: CandidateCV) => {
    setEditingCandidate(candidate);
    setFormData({
      candidateName: candidate.candidateName,
      email: candidate.email || '',
      phone: candidate.phone || '',
      jobRole: Array.isArray(candidate.jobRole) ? candidate.jobRole : candidate.jobRole ? [candidate.jobRole] : [],
      experienceLevel: candidate.experienceLevel || ('' as ExperienceLevel | ''),
      location: candidate.location || '',
      notes: candidate.notes || '',
      status: candidate.status,
      priority: candidate.priority,
      tags: candidate.tags || [],
    });
    setCvPreview(candidate.cvUrl);
    setAssignedRecruiter(candidate.assignedTo || '');
    setJobRoleSearch('');
    setOpen(true);
  };

  // Handle view
  const handleView = (candidate: CandidateCV) => {
    setSelectedCandidate(candidate);
    setViewDialogOpen(true);
  };

  // Handle CV download
  const handleDownloadCV = async (cvUrl: string, fileName: string) => {
    try {
      // First, try using the API route to proxy the download
      const apiUrl = `/api/download-cv?url=${encodeURIComponent(cvUrl)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        // If API route fails with 401, try direct download as fallback
        if (response.status === 401) {
          console.warn('API route returned 401, trying direct download...');
          // Try direct download - open in new tab and let browser handle it
          const link = document.createElement('a');
          link.href = cvUrl;
          link.download = fileName || 'CV.pdf';
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast({
            title: 'Download Started',
            description: 'CV download initiated. If it doesn\'t start, the file may require authentication.',
          });
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to download CV: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName || 'CV.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: 'Success',
        description: 'CV downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading CV:', error);
      // As a last resort, try direct download
      try {
        const link = document.createElement('a');
        link.href = cvUrl;
        link.download = fileName || 'CV.pdf';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: 'Download Attempted',
          description: 'Tried to download CV directly. If it doesn\'t work, the file may be private.',
        });
      } catch (fallbackError) {
        toast({
          title: 'Download Failed',
          description: error.message || 'Failed to download CV. The file may be private or require authentication.',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle CV view in new tab
  const handleViewCV = async (cvUrl: string) => {
    try {
      // Use API route to proxy the file with 'view' mode for inline display
      const apiUrl = `/api/download-cv?url=${encodeURIComponent(cvUrl)}&mode=view`;
      
      // Open in new tab - browser will display PDF inline
      window.open(apiUrl, '_blank');
    } catch (error: any) {
      console.error('Error viewing CV:', error);
      toast({
        title: 'View Failed',
        description: error.message || 'Failed to open CV. Please try downloading instead.',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async (candidateId: string) => {
    try {
      await deleteCandidateCV(candidateId);
      toast({
        title: 'Success',
        description: 'Candidate CV deleted successfully',
      });
      setDeleteConfirm(null);

      // Refresh analytics
      const analyticsData = await getCandidateCVsAnalytics();
      setAnalytics(analyticsData);
    } catch (error: any) {
      console.error('Error deleting candidate CV:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete candidate CV',
        variant: 'destructive',
      });
    }
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '' as CandidateStatus | '',
      jobRole: '' as JobRole | '',
      priority: '' as CandidatePriority | '',
      experienceLevel: '' as ExperienceLevel | '',
      assignedTo: '',
    });
    setSearchQuery('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '') || searchQuery !== '';

  // Handle adding a note
  const handleAddNote = async () => {
    if (!selectedCandidate || !user || !newNote.trim()) return;

    try {
      setAddingNote(true);
      await addCandidateNote(
        selectedCandidate.id,
        newNote.trim(),
        user.id,
        user.name || 'Unknown'
      );
      setNewNote('');
      toast({
        title: 'Success',
        description: 'Note added successfully',
      });
      
      // Refresh the selected candidate
      const updated = await getAllCandidateCVs();
      const updatedCandidate = updated.find(c => c.id === selectedCandidate.id);
      if (updatedCandidate) {
        setSelectedCandidate(updatedCandidate);
      }
    } catch (error: any) {
      console.error('Error adding note:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add note',
        variant: 'destructive',
      });
    } finally {
      setAddingNote(false);
    }
  };

  // Handle deleting a note
  const handleDeleteNote = async (noteId: string) => {
    if (!selectedCandidate || !user) return;

    try {
      await deleteCandidateNote(selectedCandidate.id, noteId);
      toast({
        title: 'Success',
        description: 'Note deleted successfully',
      });
      
      // Refresh the selected candidate
      const updated = await getAllCandidateCVs();
      const updatedCandidate = updated.find(c => c.id === selectedCandidate.id);
      if (updatedCandidate) {
        setSelectedCandidate(updatedCandidate);
      }
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidate CVs</h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin 
              ? 'Manage potential employee CVs for recruitment'
              : 'View your assigned candidate CVs'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Candidate
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'assigned')}>
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="all">
              All Resumes
            </TabsTrigger>
          )}
          <TabsTrigger value="assigned">
            Assigned Resumes
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Analytics Cards - Only show for admins */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading && !analytics ? (
            // Skeleton for analytics cards
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-5 rounded-xl" />
                </CardHeader>
                <CardContent className="relative z-10">
                  <Skeleton className="h-10 w-16 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          ) : analytics ? (
            <>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Candidates</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {analytics.totalCandidates}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">{analytics.candidatesThisMonth}</span> this month
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Shortlisted</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {analytics.shortlistedCount}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">Ready for review</span>
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hired</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {analytics.hiredCount}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">Successfully placed</span>
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">This Week</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {analytics.candidatesThisWeek}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">New candidates</span>
              </p>
            </CardContent>
          </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Filters - Only show for admins */}
      {isAdmin && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        {loading && showFilters ? (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        ) : showFilters && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search candidates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' as CandidateStatus | '' : value as CandidateStatus })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Job Role</Label>
                <Select
                  value={filters.jobRole || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, jobRole: value === 'all' ? '' as JobRole | '' : value as JobRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {JOB_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, priority: value === 'all' ? '' as CandidatePriority | '' : value as CandidatePriority })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All priorities</SelectItem>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Experience Level</Label>
                <Select
                  value={filters.experienceLevel || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, experienceLevel: value === 'all' ? '' as ExperienceLevel | '' : value as ExperienceLevel })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      )}

      {/* Candidates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Candidates ({candidates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Job Role</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-40" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-8 w-8 rounded-md ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No candidates found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Candidate Name</TableHead>
                    <TableHead>Job Role</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <TableRow key={candidate.id}>
                      <TableCell className="font-medium">{candidate.candidateId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{candidate.candidateName}</div>
                          {candidate.email && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {candidate.email}
                            </div>
                          )}
                          {candidate.phone && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {candidate.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(candidate.jobRole) ? (
                          <div className="flex flex-wrap gap-1">
                            {candidate.jobRole.map((role, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline">{candidate.jobRole}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{candidate.experienceLevel || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[candidate.status]}>
                          {candidate.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={PRIORITY_COLORS[candidate.priority]}>
                          {candidate.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {candidate.assignedToName || 'Unassigned'}
                      </TableCell>
                      <TableCell>
                        {format(candidate.createdAt, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(candidate)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem onClick={() => handleEdit(candidate)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDownloadCV(
                                candidate.cvUrl,
                                candidate.cvFileName || `${candidate.candidateName}_CV.pdf`
                              )}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download CV
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm(candidate.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto scrollbar-hide">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl">
                  {editingCandidate ? 'Edit Candidate CV' : 'Add New Candidate CV'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {editingCandidate 
                    ? 'Update candidate information and CV'
                    : 'Upload a candidate CV and fill in their details'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            {/* CV Upload Section - Enhanced */}
            <Card className="border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      CV File
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload the candidate's resume or CV document
                    </p>
                  </div>
                </div>
                <DragDropFileUpload
                  label=""
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  maxSize={10}
                  fileTypes="PDF, DOC, DOCX"
                  value={cvFile}
                  preview={cvPreview}
                  onChange={handleCvUpload}
                  disabled={uploading}
                />
              </CardContent>
            </Card>

            {/* Basic Information Section */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <User className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Essential details about the candidate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="candidateName" className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Candidate Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="candidateName"
                      value={formData.candidateName}
                      onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobRole" className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      Job Role <span className="text-destructive">*</span>
                    </Label>
                    {formData.jobRole.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.jobRole.map((role) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {role}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  jobRole: formData.jobRole.filter(r => r !== role)
                                });
                              }}
                              className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Popover open={jobRoleOpen} onOpenChange={setJobRoleOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={jobRoleOpen}
                          className="h-11 w-full justify-between font-normal"
                        >
                          {formData.jobRole.length > 0 
                            ? formData.jobRole.length === 1 
                              ? formData.jobRole[0]
                              : `${formData.jobRole.length} roles selected`
                            : "Select job role(s)..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search job roles or type a custom role..." 
                            value={jobRoleSearch}
                            onValueChange={setJobRoleSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              <div className="py-2">
                                <Button
                                  variant="ghost"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    if (jobRoleSearch.trim()) {
                                      const customRole = jobRoleSearch.trim() as JobRole;
                                      const currentRoles = formData.jobRole || [];
                                      if (!currentRoles.includes(customRole)) {
                                        setFormData({ ...formData, jobRole: [...currentRoles, customRole] });
                                      }
                                      setJobRoleOpen(false);
                                      setJobRoleSearch('');
                                    }
                                  }}
                                >
                                  Use "{jobRoleSearch}" as job role
                                </Button>
                              </div>
                            </CommandEmpty>
                            <CommandGroup>
                              {JOB_ROLES.filter((role) =>
                                role.toLowerCase().includes(jobRoleSearch.toLowerCase())
                              ).map((role) => (
                                <CommandItem
                                  key={role}
                                  value={role}
                                  onSelect={() => {
                                    const currentRoles = formData.jobRole || [];
                                    const isSelected = currentRoles.includes(role);
                                    const newRoles = isSelected
                                      ? currentRoles.filter(r => r !== role)
                                      : [...currentRoles, role];
                                    setFormData({ ...formData, jobRole: newRoles });
                                    setJobRoleSearch('');
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.jobRole?.includes(role) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {role}
                                </CommandItem>
                              ))}
                              {jobRoleSearch.trim() && 
                               !JOB_ROLES.some(role => role.toLowerCase() === jobRoleSearch.toLowerCase().trim()) && (
                                <CommandItem
                                  value={jobRoleSearch.trim()}
                                  onSelect={() => {
                                    const customRole = jobRoleSearch.trim() as JobRole;
                                    const currentRoles = formData.jobRole || [];
                                    if (!currentRoles.includes(customRole)) {
                                      setFormData({ ...formData, jobRole: [...currentRoles, customRole] });
                                    }
                                    setJobRoleOpen(false);
                                    setJobRoleSearch('');
                                  }}
                                  className="bg-muted/50"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add "{jobRoleSearch.trim()}"
                                </CommandItem>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john.doe@example.com"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Phone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experienceLevel" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Experience Level
                    </Label>
                    <Select
                      value={formData.experienceLevel || undefined}
                      onValueChange={(value) => setFormData({ ...formData, experienceLevel: value as ExperienceLevel })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Location
                    </Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="City, State"
                      className="h-11"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status & Assignment Section */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <CheckCircle2 className="h-5 w-5 text-purple-500" />
                    </div>
                    <CardTitle className="text-lg">Status & Priority</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value as CandidateStatus })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${
                                status === 'New' ? 'bg-blue-500' :
                                status === 'Reviewing' ? 'bg-yellow-500' :
                                status === 'Shortlisted' ? 'bg-purple-500' :
                                status === 'Interview Scheduled' ? 'bg-orange-500' :
                                status === 'Hired' ? 'bg-green-500' :
                                status === 'Rejected' ? 'bg-red-500' :
                                'bg-gray-500'
                              }`} />
                              {status}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value as CandidatePriority })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${
                                priority === 'Urgent' ? 'bg-red-500' :
                                priority === 'High' ? 'bg-orange-500' :
                                priority === 'Medium' ? 'bg-blue-500' :
                                'bg-gray-500'
                              }`} />
                              {priority}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Users className="h-5 w-5 text-green-500" />
                    </div>
                    <CardTitle className="text-lg">Assignment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="assignedRecruiter">Assign to Recruiter</Label>
                    <Select
                      value={assignedRecruiter || 'unassigned'}
                      onValueChange={(value) => setAssignedRecruiter(value === 'unassigned' ? '' : value)}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select recruiter (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                            Unassigned
                          </div>
                        </SelectItem>
                        {allUsers.map((user) => {
                          const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                          return (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span>{userName}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes Section */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <FileText className="h-5 w-5 text-amber-500" />
                  </div>
                  <CardTitle className="text-lg">Additional Notes</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Any additional information about the candidate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes, observations, or special considerations about this candidate..."
                  rows={4}
                  className="resize-none"
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setOpen(false); resetForm(); }}
                disabled={uploading}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={uploading}
                className="min-w-[150px] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
              >
                {uploading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    {editingCandidate ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    {editingCandidate ? (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Update Candidate
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Candidate
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 gap-0">
          {selectedCandidate && (
            <>
              {/* Enhanced Header with Gradient */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-blue-500/10 border-b border-primary/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
                <div className="relative p-6 pb-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl" />
                          <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30">
                            <UserCheck className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <DialogTitle className="text-2xl font-bold mb-1.5 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                            {selectedCandidate.candidateName}
                          </DialogTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono font-semibold text-xs px-2.5 py-1 bg-background/80 border-primary/30">
                              {selectedCandidate.candidateId}
                            </Badge>
                            <Badge className={`${STATUS_COLORS[selectedCandidate.status]} font-semibold shadow-sm`}>
                              {selectedCandidate.status}
                            </Badge>
                            <Badge className={`${PRIORITY_COLORS[selectedCandidate.priority]} font-semibold shadow-sm`}>
                              {selectedCandidate.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Briefcase className="h-4 w-4" />
                          {Array.isArray(selectedCandidate.jobRole) ? (
                            <div className="flex flex-wrap gap-1">
                              {selectedCandidate.jobRole.map((role, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span>{selectedCandidate.jobRole}</span>
                          )}
                        </div>
                        {selectedCandidate.experienceLevel && (
                          <div className="flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4" />
                            <span>{selectedCandidate.experienceLevel}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          <span>{format(selectedCandidate.createdAt, 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setViewDialogOpen(false);
                            handleEdit(selectedCandidate);
                          }}
                          className="shadow-sm hover:shadow-md transition-all"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(95vh-180px)] px-6 py-4 scrollbar-hide">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger value="cv" className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      CV Document
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 mt-0">
                    {/* Key Information Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Personal Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Full Name</Label>
                            <p className="text-sm font-semibold">{selectedCandidate.candidateName}</p>
                          </div>
                          {selectedCandidate.email && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5" />
                                Email
                              </Label>
                              <p className="text-sm font-medium">{selectedCandidate.email}</p>
                            </div>
                          )}
                          {selectedCandidate.phone && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5" />
                                Phone
                              </Label>
                              <p className="text-sm font-medium">{selectedCandidate.phone}</p>
                            </div>
                          )}
                          {selectedCandidate.location && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Location
                              </Label>
                              <p className="text-sm">{selectedCandidate.location}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            Professional Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Job Role</Label>
                            {Array.isArray(selectedCandidate.jobRole) ? (
                              <div className="flex flex-wrap gap-1">
                                {selectedCandidate.jobRole.map((role, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {role}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">{selectedCandidate.jobRole}</p>
                            )}
                          </div>
                          {selectedCandidate.experienceLevel && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <BarChart3 className="h-3.5 w-3.5" />
                                Experience Level
                              </Label>
                              <p className="text-sm">{selectedCandidate.experienceLevel}</p>
                            </div>
                          )}
                          <div className="pt-4 border-t space-y-4">
                            <div className="flex flex-col gap-2">
                              <Label className="text-xs text-muted-foreground">Status</Label>
                              <div>
                                <Badge className={`${STATUS_COLORS[selectedCandidate.status]} font-semibold`}>
                                  {selectedCandidate.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label className="text-xs text-muted-foreground">Priority</Label>
                              <div>
                                <Badge className={`${PRIORITY_COLORS[selectedCandidate.priority]} font-semibold`}>
                                  {selectedCandidate.priority}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Contact & Assignment Information */}
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Assignment & Metadata
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs text-muted-foreground">Assigned To</Label>
                              <p className="text-sm font-medium">{selectedCandidate.assignedToName || 'Unassigned'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Calendar className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs text-muted-foreground">Created</Label>
                              <p className="text-sm font-medium">{format(selectedCandidate.createdAt, 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                          </div>
                          {selectedCandidate.updatedAt && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Clock className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs text-muted-foreground">Last Updated</Label>
                                <p className="text-sm font-medium">{format(selectedCandidate.updatedAt, 'MMM dd, yyyy HH:mm')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Legacy Notes Section */}
                    {selectedCandidate.notes && (
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Additional Notes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {selectedCandidate.notes}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="notes" className="space-y-6 mt-0">
                    {/* Add Note Section */}
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          Add Note
                        </CardTitle>
                        <CardDescription>
                          Add a note about this candidate. The note will be visible to all team members.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Textarea
                          placeholder="Enter your note here..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={4}
                          className="resize-none"
                        />
                        <Button
                          onClick={handleAddNote}
                          disabled={!newNote.trim() || addingNote}
                          className="w-full sm:w-auto"
                        >
                          {addingNote ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Add Note
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Notes List */}
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Bell className="h-4 w-4 text-primary" />
                          Notes History
                        </CardTitle>
                        <CardDescription>
                          {selectedCandidate.candidateNotes && selectedCandidate.candidateNotes.length > 0
                            ? `${selectedCandidate.candidateNotes.length} note${selectedCandidate.candidateNotes.length !== 1 ? 's' : ''}`
                            : 'No notes yet'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {selectedCandidate.candidateNotes && selectedCandidate.candidateNotes.length > 0 ? (
                          <div className="space-y-4">
                            {selectedCandidate.candidateNotes
                              .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
                              .map((note) => (
                                <div
                                  key={note.id}
                                  className="p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-semibold">{note.addedByName}</span>
                                        <span className="text-xs text-muted-foreground">
                                          • {format(note.addedAt, 'MMM dd, yyyy HH:mm')}
                                        </span>
                                      </div>
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                                        {note.note}
                                      </p>
                                    </div>
                                    {(isAdmin || note.addedBy === user?.id) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteNote(note.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                            <p className="text-sm text-muted-foreground">No notes have been added yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Add a note above to get started</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="cv" className="space-y-6 mt-0">
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          CV Document
                        </CardTitle>
                        <CardDescription>
                          Download or view the candidate's CV file
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {selectedCandidate.cvUrl ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
                              <div className="p-3 rounded-lg bg-primary/10">
                                <FileText className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs text-muted-foreground">CV File</Label>
                                <p className="text-sm font-medium truncate">
                                  {selectedCandidate.cvFileName || 'CV Document'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              <Button
                                onClick={() => handleDownloadCV(
                                  selectedCandidate.cvUrl,
                                  selectedCandidate.cvFileName || `${selectedCandidate.candidateName}_CV.pdf`
                                )}
                                className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-sm hover:shadow-md transition-all"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download CV
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleViewCV(selectedCandidate.cvUrl)}
                                className="shadow-sm hover:shadow-md transition-all"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View in New Tab
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                            <p className="text-sm text-muted-foreground">No CV file available</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                {isAdmin && (
                  <div className="flex items-center justify-between gap-4 pt-4 border-t mt-6">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewDialogOpen(false);
                        handleEdit(selectedCandidate);
                      }}
                      className="shadow-sm hover:shadow-md transition-all"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Candidate
                    </Button>
                    <div className="flex gap-2">
                      {selectedCandidate.cvUrl && (
                        <Button
                          variant="outline"
                          onClick={() => handleDownloadCV(
                            selectedCandidate.cvUrl,
                            selectedCandidate.cvFileName || `${selectedCandidate.candidateName}_CV.pdf`
                          )}
                          className="shadow-sm hover:shadow-md transition-all"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download CV
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the candidate CV.
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

export default CandidateCVs;
