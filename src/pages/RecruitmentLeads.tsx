"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  X, 
  Download, 
  BarChart3, 
  Calendar as CalendarIcon,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Eye,
  FileText,
  Tag,
  Globe,
  Briefcase,
  UserPlus,
  ExternalLink,
  MessageSquare,
  Clipboard,
  CheckSquare,
  Star,
  Flag
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { type DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { 
  RecruitmentLead, 
  LeadStatus, 
  LeadPriority, 
  Platform, 
  JobRole,
  ActivityLog,
  FollowUp
} from '@/types/recruitment-lead';
import {
  getAllRecruitmentLeads,
  createRecruitmentLead,
  updateRecruitmentLead,
  deleteRecruitmentLead,
  addActivityLog,
  addFollowUp,
  completeFollowUp,
  getRecruitmentLeadsAnalytics,
  subscribeToRecruitmentLeads
} from '@/lib/recruitment-leads';
import { LeadAnalytics } from '@/types/recruitment-lead';
import { createNotification } from '@/lib/notifications';

const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Meeting Scheduled', 'Follow-up Required', 'Converted', 'Lost', 'On Hold'];
const KANBAN_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Meeting Scheduled'];
const PRIORITIES: LeadPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const PLATFORMS: Platform[] = ['Jora', 'Seek', 'Indeed', 'LinkedIn', 'Facebook', 'Instagram', 'Referral', 'Website', 'Direct Contact', 'Other'];
const JOB_ROLES: JobRole[] = ['Chef / Cook', 'Head Chef', 'Sous Chef', 'Chef De Partie', 'Commis Chef', 'Kitchen Hand', 'Waiter / Waitress', 'Barista', 'Manager', 'Other'];

const STATUS_COLORS: Record<LeadStatus, string> = {
  'New': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'Contacted': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  'Qualified': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  'Meeting Scheduled': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'Follow-up Required': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
  'Converted': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  'Lost': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  'On Hold': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
};

const PRIORITY_COLORS: Record<LeadPriority, string> = {
  'Low': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
  'Medium': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  'High': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  'Urgent': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
};

// Draggable Lead Card Component
function DraggableLeadCard({ 
  lead, 
  onView, 
  onEdit, 
  onDelete, 
  canEdit 
}: { 
  lead: RecruitmentLead; 
  onView: (lead: RecruitmentLead) => void;
  onEdit: (lead: RecruitmentLead) => void;
  onDelete: (leadId: string) => void;
  canEdit: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: 'lead',
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <Card 
        className="hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50 group" 
        onClick={() => onView(lead)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{lead.businessName}</p>
                <p className="text-xs text-primary font-medium mt-0.5">{lead.leadId}</p>
              </div>
              <Badge className={`${PRIORITY_COLORS[lead.priority]} font-medium ml-2`}>{lead.priority}</Badge>
            </div>
            <div className="text-xs space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{lead.jobLocation}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{lead.jobRole}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{lead.businessOwnerManager}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t">
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-40">
                    <DropdownMenuItem onClick={() => onView(lead)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(lead)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(lead.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Droppable Column Component
function DroppableLeadColumn({
  id,
  status,
  title,
  leadCount,
  children,
  isOver,
  leadIds = [],
}: {
  id: string;
  status: LeadStatus;
  title: string;
  leadCount: number;
  children: React.ReactNode;
  isOver?: boolean;
  leadIds?: string[];
}) {
  const { setNodeRef, isOver: isOverColumn } = useDroppable({
    id,
    data: {
      type: 'column',
      status,
    },
  });

  const isActive = isOver || isOverColumn;

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-0 ${isActive ? 'ring-2 ring-primary ring-offset-2 rounded-lg' : ''}`}
    >
      <div className={`mb-3 flex items-center justify-between p-3 rounded-lg bg-muted/30 border-2 ${isActive ? 'border-primary' : ''}`}>
        <h3 className="font-semibold text-sm uppercase tracking-wide truncate">{title}</h3>
        <Badge variant="secondary" className="font-semibold flex-shrink-0 ml-2">{leadCount}</Badge>
      </div>
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {leadCount === 0 && !isActive ? (
          <div className="text-center text-sm text-muted-foreground py-12 border-2 border-dashed rounded-lg bg-muted/20">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No leads</p>
          </div>
        ) : (
          <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
            <div className={isActive && leadCount === 0 ? 'min-h-[100px]' : ''}>
              {children}
              {isActive && leadCount === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed border-primary rounded-lg">
                  <p>Drop lead here</p>
                </div>
              )}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

const RecruitmentLeads = () => {
  const { user, getAllUsers } = useAuth();
  const [leads, setLeads] = useState<RecruitmentLead[]>([]);
  const [analytics, setAnalytics] = useState<LeadAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<RecruitmentLead | null>(null);
  const [editingLead, setEditingLead] = useState<RecruitmentLead | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '' as LeadStatus | '',
    platform: '' as Platform | '',
    priority: '' as LeadPriority | '',
    assignedTo: '',
  });
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [formData, setFormData] = useState<Partial<RecruitmentLead>>({});
  const [isEmployeeChecked, setIsEmployeeChecked] = useState(false);
  const [activeLead, setActiveLead] = useState<RecruitmentLead | null>(null);
  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(null);
  const [ownerManagerType, setOwnerManagerType] = useState<'Manager' | 'Owner'>('Manager');
  const [remarks, setRemarks] = useState<string[]>(['']);
  const [tasks, setTasks] = useState<string[]>(['']);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [assignedEmployee, setAssignedEmployee] = useState<string>('');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    })
  );

  const canEdit = user?.role === 'admin' || user?.role === 'operationsstaff' || 
                  (user?.role === 'itteam' && user.permissions?.leadTracking === 'crud');
  const canView = canEdit || (user?.role === 'itteam' && user.permissions?.leadTracking === 'read');

  // Helper function to clean filters (remove empty strings)
  const cleanFilters = (includeSearch = false) => {
    const cleaned: {
      status?: LeadStatus;
      platform?: string;
      priority?: string;
      assignedTo?: string;
      search?: string;
    } = {};
    
    // Type guards: check if values are valid (not empty string)
    const isValidStatus = (status: LeadStatus | ''): status is LeadStatus => {
      return status !== '';
    };
    
    const isValidPlatform = (platform: Platform | ''): platform is Platform => {
      return platform !== '';
    };
    
    const isValidPriority = (priority: LeadPriority | ''): priority is LeadPriority => {
      return priority !== '';
    };
    
    if (isValidStatus(filters.status)) {
      cleaned.status = filters.status;
    }
    if (isValidPlatform(filters.platform)) {
      cleaned.platform = filters.platform;
    }
    if (isValidPriority(filters.priority)) {
      cleaned.priority = filters.priority;
    }
    if (filters.assignedTo && filters.assignedTo !== '') {
      cleaned.assignedTo = filters.assignedTo;
    }
    if (includeSearch && searchQuery && searchQuery !== '') {
      cleaned.search = searchQuery;
    }
    
    return cleaned;
  };

  // Load leads
  useEffect(() => {
    if (!canView) return;

    const loadLeads = async () => {
      try {
        setLoading(true);
        const fetchedLeads = await getAllRecruitmentLeads(cleanFilters(true));
        setLeads(fetchedLeads);
        
        const analyticsData = await getRecruitmentLeadsAnalytics();
        setAnalytics(analyticsData);
      } catch (error) {
        console.error('Error loading leads:', error);
        toast({
          title: 'Error',
          description: 'Failed to load recruitment leads',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadLeads();
  }, [filters, canView, searchQuery]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!canView || !user) return;

    const unsubscribe = subscribeToRecruitmentLeads((updatedLeads) => {
      setLeads(updatedLeads);
    }, cleanFilters(false));

    return () => unsubscribe();
  }, [filters, canView, user]);

  // Load users for employee assignment
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
              You don't have permission to access Recruitment Leads. Please contact an administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    try {
      const nativeFormData = new FormData(e.currentTarget);
      
      // Helper function to get string value or undefined if empty
      const getStringOrUndefined = (value: FormDataEntryValue | null): string | undefined => {
        const str = value as string;
        return str && str.trim() ? str.trim() : undefined;
      };
      
      const leadData: any = {
        dateOfRecording: new Date(nativeFormData.get('dateOfRecording') as string),
        platform: (formData.platform || nativeFormData.get('platform')) as Platform,
        businessName: nativeFormData.get('businessName') as string,
        jobLocation: nativeFormData.get('jobLocation') as string,
        jobRole: (formData.jobRole || nativeFormData.get('jobRole')) as JobRole,
        businessOwnerManager: `${ownerManagerType}: ${nativeFormData.get('businessOwnerManager') as string}`,
        vacancy: nativeFormData.get('vacancy') as string,
        contactNo: nativeFormData.get('contactNo') as string,
        callNotes: nativeFormData.get('callNotes') as string,
        status: (formData.status || 'New') as LeadStatus,
        priority: (formData.priority || 'Medium') as LeadPriority,
        createdBy: user.id,
        createdByName: user.name || 'Unknown',
      };
      
      // Only include optional fields if they have values
      const link = getStringOrUndefined(nativeFormData.get('link'));
      if (link) leadData.link = link;
      
      const emailAddress = getStringOrUndefined(nativeFormData.get('emailAddress'));
      if (emailAddress) leadData.emailAddress = emailAddress;
      
      const recap = getStringOrUndefined(nativeFormData.get('recap'));
      if (recap) leadData.recap = recap;
      
      // Handle tasks array
      const tasksArray = tasks.filter(t => t.trim() !== '');
      if (tasksArray.length > 0) {
        leadData.tasks = tasksArray.join('\n---\n');
      }
      
      // Handle remarks array
      const remarksArray = remarks.filter(r => r.trim() !== '');
      if (remarksArray.length > 0) {
        leadData.remarks = remarksArray.join('\n---\n');
      }
      
      // Handle meeting date
      if (meetingDate) {
        leadData.meetingScheduled = meetingDate;
      }
      
      // Employee fields - use state instead of FormData for checkbox
      const isEmployee = isEmployeeChecked || editingLead?.isEmployee || false;
      leadData.isEmployee = isEmployee;
      if (isEmployee) {
        const employeeName = getStringOrUndefined(nativeFormData.get('employeeName'));
        if (employeeName) leadData.employeeName = employeeName;
        
        const employeePosition = getStringOrUndefined(nativeFormData.get('employeePosition'));
        if (employeePosition) leadData.employeePosition = employeePosition;
      }
      
      // Override with assigned employee if set
      if (assignedEmployee) {
        const selectedUser = allUsers.find(u => u.id === assignedEmployee);
        if (selectedUser) {
          leadData.assignedTo = selectedUser.id;
          leadData.assignedToName = selectedUser.name || `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email;
        }
      } else if (formData.assignedTo) {
        leadData.assignedTo = formData.assignedTo;
        leadData.assignedToName = formData.assignedToName;
      }
      if (formData.tags && formData.tags.length > 0) leadData.tags = formData.tags;

      let leadId: string;
      if (editingLead) {
        // Filter out undefined values before updating
        const updateData: any = {
          updatedBy: user.id,
          updatedByName: user.name || 'Unknown',
        };
        
        Object.keys(leadData).forEach(key => {
          const value = leadData[key];
          if (value !== undefined && value !== null && value !== '') {
            updateData[key] = value;
          }
        });
        
        await updateRecruitmentLead(editingLead.id, updateData);
        leadId = editingLead.id;
        toast({
          title: 'Success',
          description: 'Lead updated successfully',
        });
      } else {
        leadId = await createRecruitmentLead(leadData);
        toast({
          title: 'Success',
          description: 'Lead created successfully',
        });
      }

      // Send notification if employee is assigned (new assignment or changed assignment)
      const currentAssignedEmployee = assignedEmployee || formData.assignedTo;
      const previousAssignedEmployee = editingLead?.assignedTo;
      
      if (currentAssignedEmployee && currentAssignedEmployee !== previousAssignedEmployee) {
        const selectedUser = allUsers.find(u => u.id === currentAssignedEmployee);
        if (selectedUser) {
          try {
            const leadTitle = leadData.businessName || 'a recruitment lead';
            await createNotification({
              userId: selectedUser.id,
              type: 'lead_assigned',
              title: 'New Lead Assignment',
              message: `You have been assigned to lead: ${leadTitle} (${leadData.jobRole || 'N/A'})`,
              relatedId: leadId,
              relatedType: 'lead',
              createdBy: user.id,
              createdByName: user.name || 'Unknown',
            });
            toast({
              title: 'Employee Assigned',
              description: `${selectedUser.name || selectedUser.email} has been notified about this lead assignment.`,
            });
          } catch (error) {
            console.error('Error creating notification:', error);
            // Don't fail the whole operation if notification fails
          }
        }
      }

      setOpen(false);
      setEditingLead(null);
      setFormData({});
      setIsEmployeeChecked(false);
      setOwnerManagerType('Manager');
      setRemarks(['']);
      setTasks(['']);
      setMeetingDate(undefined);
      setAssignedEmployee('');
      setEmployeeSearchQuery('');
      
      // Refresh analytics
      const analyticsData = await getRecruitmentLeadsAnalytics();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to save lead',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (lead: RecruitmentLead) => {
    setEditingLead(lead);
    setFormData({
      platform: lead.platform,
      jobRole: lead.jobRole,
      status: lead.status,
      priority: lead.priority,
      assignedTo: lead.assignedTo,
      assignedToName: lead.assignedToName,
      tags: lead.tags,
    });
    setIsEmployeeChecked(lead.isEmployee || false);
    
    // Parse businessOwnerManager to extract type and name
    const ownerManagerValue = lead.businessOwnerManager || '';
    if (ownerManagerValue.startsWith('Owner:')) {
      setOwnerManagerType('Owner');
    } else if (ownerManagerValue.startsWith('Manager:')) {
      setOwnerManagerType('Manager');
    } else {
      setOwnerManagerType('Manager');
    }
    
    // Parse remarks array
    if (lead.remarks) {
      const remarksArray = lead.remarks.split('\n---\n').filter(r => r.trim() !== '');
      setRemarks(remarksArray.length > 0 ? remarksArray : ['']);
    } else {
      setRemarks(['']);
    }
    
    // Parse tasks array
    if (lead.tasks) {
      const tasksArray = lead.tasks.split('\n---\n').filter(t => t.trim() !== '');
      setTasks(tasksArray.length > 0 ? tasksArray : ['']);
    } else {
      setTasks(['']);
    }
    
    // Set meeting date
    setMeetingDate(lead.meetingScheduled);
    
    // Set assigned employee
    setAssignedEmployee(lead.assignedTo || '');
    
    setOpen(true);
  };

  const handleDelete = async (leadId: string) => {
    try {
      await deleteRecruitmentLead(leadId);
      toast({
        title: 'Success',
        description: 'Lead deleted successfully',
      });
      setDeleteConfirm(null);
      
      // Refresh analytics
      const analyticsData = await getRecruitmentLeadsAnalytics();
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete lead',
        variant: 'destructive',
      });
    }
  };

  const handleView = (lead: RecruitmentLead) => {
    setSelectedLead(lead);
    setViewDialogOpen(true);
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus, previousStatus?: LeadStatus) => {
    if (!user) return;
    
    try {
      await updateRecruitmentLead(leadId, {
        status: newStatus,
        updatedBy: user.id,
        updatedByName: user.name || 'Unknown',
      });
      
      // Add activity log with previous status and timestamp
      const statusChangeDescription = previousStatus 
        ? `Status changed from ${previousStatus} to ${newStatus}`
        : `Status changed to ${newStatus}`;
      
      await addActivityLog(leadId, {
        type: 'status_change',
        description: statusChangeDescription,
        userId: user.id,
        userName: user.name || 'Unknown',
        metadata: {
          oldStatus: previousStatus,
          newStatus,
        },
      });
      
      toast({
        title: 'Success',
        description: 'Status updated',
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleAddFollowUp = async (leadId: string, followUpData: Omit<FollowUp, 'id' | 'completed'>) => {
    try {
      await addFollowUp(leadId, followUpData);
      toast({
        title: 'Success',
        description: 'Follow-up added',
      });
    } catch (error) {
      console.error('Error adding follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to add follow-up',
        variant: 'destructive',
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = leads.find(l => l.id === active.id);
    if (lead) {
      setActiveLead(lead);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && over.data.current?.type === 'column') {
      setDraggedOverColumn(over.id as string);
    } else {
      setDraggedOverColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    setDraggedOverColumn(null);

    if (!over) return;

    const leadId = active.id as string;
    const lead = leads.find(l => l.id === leadId);
    
    if (!lead) return;

    // Check if dropped on a column
    if (over.data.current?.type === 'column') {
      const newStatus = over.data.current.status as LeadStatus;
      
      // If status hasn't changed, do nothing
      if (lead.status === newStatus) return;

      try {
        await handleStatusChange(leadId, newStatus, lead.status);
      } catch (error) {
        console.error('Error updating lead status:', error);
        toast({
          title: 'Error',
          description: 'Failed to update lead status',
          variant: 'destructive',
        });
      }
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery || 
      lead.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.businessOwnerManager.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.jobLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contactNo.includes(searchQuery) ||
      lead.emailAddress?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilters = 
      (!filters.status || lead.status === filters.status) &&
      (!filters.platform || lead.platform === filters.platform) &&
      (!filters.priority || lead.priority === filters.priority) &&
      (!filters.assignedTo || lead.assignedTo === filters.assignedTo);

    // Date range filter
    const matchesDateRange = !dateRange || !dateRange.from || (() => {
      const leadDate = new Date(lead.dateOfRecording);
      leadDate.setHours(0, 0, 0, 0);
      const fromDate = new Date(dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        return leadDate >= fromDate && leadDate <= toDate;
      }
      return leadDate.getTime() === fromDate.getTime();
    })();

    return matchesSearch && matchesFilters && matchesDateRange;
  });

  // Sort leads based on sortOrder
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    // Use createdAt if available, otherwise use dateOfRecording
    const dateA = a.createdAt?.getTime() || new Date(a.dateOfRecording).getTime();
    const dateB = b.createdAt?.getTime() || new Date(b.dateOfRecording).getTime();
    
    if (sortOrder === 'latest') {
      return dateB - dateA; // Latest first (descending)
    } else {
      return dateA - dateB; // Oldest first (ascending)
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = sortedLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, dateRange, sortOrder]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      status: '' as LeadStatus | '',
      platform: '' as Platform | '',
      priority: '' as LeadPriority | '',
      assignedTo: '',
    });
    setDateRange(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery !== '' || Object.values(filters).some(value => value !== '') || dateRange !== undefined;

  const exportToCSV = () => {
    const headers = [
      'Lead ID', 'Date', 'Platform', 'Business Name', 'Job Location', 'Job Role',
      'Business Owner/Manager', 'Vacancy', 'Contact No', 'Email', 'Status', 'Priority'
    ];
    
    const rows = filteredLeads.map(lead => [
      lead.leadId,
      format(lead.dateOfRecording, 'yyyy-MM-dd'),
      lead.platform,
      lead.businessName,
      lead.jobLocation,
      lead.jobRole,
      lead.businessOwnerManager,
      lead.vacancy,
      lead.contactNo,
      lead.emailAddress || '',
      lead.status,
      lead.priority,
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recruitment-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Success',
      description: 'Leads exported to CSV',
    });
  };

  // Group leads by status for Kanban view (only 4 columns)
  const leadsByStatus = KANBAN_STATUSES.reduce((acc, status) => {
    acc[status] = filteredLeads.filter(lead => lead.status === status);
    return acc;
  }, {} as Record<LeadStatus, RecruitmentLead[]>);

  return (
    <div className="space-y-8 relative">
      {/* Decorative background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-2xl animate-pulse" />
                <div className="relative p-3 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 backdrop-blur-sm">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-semibold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
                  Recruitment Leads
                </h1>
                <p className="text-muted-foreground text-sm mt-1.5 ml-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Manage and track recruitment opportunities
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {canEdit && (
              <>
                <Button 
                  variant="outline" 
                  onClick={exportToCSV} 
                  className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 hover:border-primary/50 bg-background/80 backdrop-blur-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Dialog open={open} onOpenChange={(open) => {
                  setOpen(open);
                  if (!open) {
                    setEditingLead(null);
                    setFormData({});
                    setIsEmployeeChecked(false);
                    setOwnerManagerType('Manager');
                    setRemarks(['']);
                    setTasks(['']);
                    setMeetingDate(undefined);
                    setAssignedEmployee('');
                    setEmployeeSearchQuery('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setEditingLead(null);
                        setFormData({});
                        setIsEmployeeChecked(false);
                        setOwnerManagerType('Manager');
                        setRemarks(['']);
                        setTasks(['']);
                        setMeetingDate(undefined);
                        setAssignedEmployee('');
                        setEmployeeSearchQuery('');
                      }} 
                      className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary via-primary to-blue-600 hover:from-primary/90 hover:via-primary/90 hover:to-blue-500 text-white font-semibold"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-hide">
                  <DialogHeader>
                    <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
                    <DialogDescription>
                      {editingLead ? 'Update lead information' : 'Enter recruitment lead details'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateOfRecording">Date of Recording *</Label>
                        <Input 
                          id="dateOfRecording" 
                          name="dateOfRecording" 
                          type="date" 
                          defaultValue={editingLead ? format(editingLead.dateOfRecording, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')} 
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="platform">Platform *</Label>
                        <Select 
                          value={formData.platform || editingLead?.platform || ''} 
                          onValueChange={(value) => setFormData({ ...formData, platform: value as Platform })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORMS.map((platform) => (
                              <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="link">Link</Label>
                        <Input id="link" name="link" type="url" placeholder="https://..." defaultValue={editingLead?.link || ''} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input id="businessName" name="businessName" placeholder="Business name" defaultValue={editingLead?.businessName || ''} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobLocation">Job Location *</Label>
                        <Input id="jobLocation" name="jobLocation" placeholder="Location" defaultValue={editingLead?.jobLocation || ''} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobRole">Job Role *</Label>
                        <Select 
                          value={formData.jobRole || editingLead?.jobRole || ''} 
                          onValueChange={(value) => setFormData({ ...formData, jobRole: value as JobRole })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select job role" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="businessOwnerManager">Business Owner / Manager *</Label>
                        <div className="flex gap-2">
                          <Select 
                            value={ownerManagerType} 
                            onValueChange={(value) => setOwnerManagerType(value as 'Manager' | 'Owner')}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Manager">Manager</SelectItem>
                              <SelectItem value="Owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            id="businessOwnerManager" 
                            name="businessOwnerManager" 
                            placeholder="Name" 
                            defaultValue={
                              editingLead?.businessOwnerManager 
                                ? editingLead.businessOwnerManager.replace(/^(Manager|Owner):\s*/, '')
                                : ''
                            } 
                            className="flex-1"
                            required 
                          />
                        </div>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <div className="flex items-center space-x-2 p-4 border-2 rounded-lg">
                          <Checkbox 
                            id="isEmployee" 
                            checked={isEmployeeChecked || editingLead?.isEmployee || false}
                            onCheckedChange={(checked) => setIsEmployeeChecked(checked === true)}
                          />
                          <Label htmlFor="isEmployee" className="text-sm font-medium cursor-pointer">
                            Employee
                          </Label>
                        </div>
                        {(isEmployeeChecked || editingLead?.isEmployee) && (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="space-y-2">
                              <Label htmlFor="employeeName">Employee Name *</Label>
                              <Input 
                                id="employeeName" 
                                name="employeeName" 
                                placeholder="Employee name" 
                                defaultValue={editingLead?.employeeName || ''} 
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="employeePosition">Employee Position *</Label>
                              <Input 
                                id="employeePosition" 
                                name="employeePosition" 
                                placeholder="Employee position" 
                                defaultValue={editingLead?.employeePosition || ''} 
                                required
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vacancy">Vacancy *</Label>
                        <Input id="vacancy" name="vacancy" placeholder="e.g., Chef" defaultValue={editingLead?.vacancy || ''} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactNo">Contact No. *</Label>
                        <Input id="contactNo" name="contactNo" placeholder="Phone number" defaultValue={editingLead?.contactNo || ''} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="emailAddress">Email Address</Label>
                        <Input id="emailAddress" name="emailAddress" type="email" placeholder="email@example.com" defaultValue={editingLead?.emailAddress || ''} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select 
                          value={formData.status || editingLead?.status || 'New'} 
                          onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select 
                          value={formData.priority || editingLead?.priority || 'Medium'} 
                          onValueChange={(value) => setFormData({ ...formData, priority: value as LeadPriority })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((priority) => (
                              <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meetingDate">Meeting Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {meetingDate ? format(meetingDate, 'PPP') : 'Select meeting date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={meetingDate}
                              onSelect={setMeetingDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="assignedEmployee">Assign Employee</Label>
                        <Popover open={employeeDropdownOpen} onOpenChange={setEmployeeDropdownOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={employeeDropdownOpen}
                              className="w-full justify-between"
                            >
                              {assignedEmployee
                                ? allUsers.find((u) => u.id === assignedEmployee)?.name || 
                                  allUsers.find((u) => u.id === assignedEmployee)?.email ||
                                  'Select employee...'
                                : 'Select employee...'}
                              <User className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput 
                                placeholder="Search employees..." 
                                value={employeeSearchQuery}
                                onValueChange={setEmployeeSearchQuery}
                              />
                              <CommandList>
                                <CommandEmpty>No employees found.</CommandEmpty>
                                <CommandGroup>
                                  {allUsers
                                    .filter((user) => {
                                      if (!employeeSearchQuery.trim()) return true;
                                      const query = employeeSearchQuery.toLowerCase();
                                      const userName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '').toLowerCase();
                                      const userEmail = (user.email || '').toLowerCase();
                                      return userName.includes(query) || userEmail.includes(query);
                                    })
                                    .map((user) => (
                                      <CommandItem
                                        key={user.id}
                                        value={user.id}
                                        onSelect={() => {
                                          setAssignedEmployee(user.id === assignedEmployee ? '' : user.id);
                                          setEmployeeDropdownOpen(false);
                                          setEmployeeSearchQuery('');
                                        }}
                                      >
                                        {user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="callNotes">Call Notes *</Label>
                        <Textarea 
                          id="callNotes" 
                          name="callNotes" 
                          placeholder="Enter call notes and conversation details..." 
                          defaultValue={editingLead?.callNotes || ''} 
                          rows={6}
                          required 
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="recap">Recap</Label>
                        <Textarea 
                          id="recap" 
                          name="recap" 
                          placeholder="Enter recap details..." 
                          defaultValue={editingLead?.recap || ''} 
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <div className="flex flex-nowrap items-center justify-between gap-2 w-full">
                          <Label htmlFor="tasks" className="text-sm font-medium whitespace-nowrap m-0">Tasks</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTasks([...tasks, ''])}
                            className="whitespace-nowrap ml-auto"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Task
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {tasks.map((task, index) => (
                            <div key={index} className="flex gap-2">
                              <Textarea 
                                placeholder="Enter task..." 
                                value={task}
                                onChange={(e) => {
                                  const newTasks = [...tasks];
                                  newTasks[index] = e.target.value;
                                  setTasks(newTasks);
                                }}
                                rows={2}
                                className="flex-1"
                              />
                              {tasks.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setTasks(tasks.filter((_, i) => i !== index))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <div className="flex flex-nowrap items-center justify-between gap-2 w-full">
                          <Label htmlFor="remarks" className="text-sm font-medium whitespace-nowrap m-0">Remarks</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRemarks([...remarks, ''])}
                            className="whitespace-nowrap ml-auto"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Remark
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {remarks.map((remark, index) => (
                            <div key={index} className="flex gap-2">
                              <Textarea 
                                placeholder="Enter remark..." 
                                value={remark}
                                onChange={(e) => {
                                  const newRemarks = [...remarks];
                                  newRemarks[index] = e.target.value;
                                  setRemarks(newRemarks);
                                }}
                                rows={2}
                                className="flex-1"
                              />
                              {remarks.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setRemarks(remarks.filter((_, i) => i !== index))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button type="submit" className="w-full">{editingLead ? 'Update Lead' : 'Add Lead'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Leads</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                {analytics.totalLeads}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="font-semibold">{analytics.leadsThisMonth}</span> this month
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversion Rate</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                {analytics.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="font-semibold">{analytics.byStatus.Converted || 0}</span> converted
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Lead Score</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                {analytics.averageLeadScore.toFixed(0)}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                <span className="font-semibold text-green-500">Out of 100</span>
              </p>
            </CardContent>
          </Card>
          <Card className="group relative overflow-hidden border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-transparent hover:border-blue-500/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Follow-ups</CardTitle>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-xl" />
                <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 group-hover:scale-110 transition-transform duration-300">
                  <CalendarIcon className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
                {analytics.upcomingFollowUps}
              </div>
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                {analytics.overdueFollowUps > 0 ? (
                  <>
                    <AlertCircle className="h-3.5 w-3.5 text-destructive animate-pulse" />
                    <span className="font-semibold text-destructive">{analytics.overdueFollowUps} overdue</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span className="font-semibold">All on track</span>
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="border-2 border-primary/10 shadow-xl bg-gradient-to-br from-card via-card to-card/50 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-500 to-purple-500" />
        <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Lead List
              </CardTitle>
              <CardDescription className="mt-1.5 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary" />
                Search and filter recruitment leads
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters} 
                className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 space-y-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary z-10" />
              <Input
                placeholder="Search by lead ID, business name, contact, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base shadow-lg border-2 border-primary/20 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300 bg-background/80 backdrop-blur-sm relative z-10"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-range" className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Date Range
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-11 justify-start text-left font-normal border-2 border-primary/20 shadow-md hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/80 backdrop-blur-sm",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Filter by date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                    {dateRange && (
                      <div className="p-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setDateRange(undefined)}
                        >
                          Clear date filter
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-status" className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Status
                </Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' as LeadStatus | '' : value as LeadStatus })}
                >
                  <SelectTrigger id="filter-status" className="h-11 border-2 border-primary/20 shadow-md hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/80 backdrop-blur-sm">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-platform" className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Platform
                </Label>
                <Select
                  value={filters.platform || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, platform: value === 'all' ? '' as Platform | '' : value as Platform })}
                >
                  <SelectTrigger id="filter-platform" className="h-11 border-2 border-primary/20 shadow-md hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/80 backdrop-blur-sm">
                    <SelectValue placeholder="All Platforms" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    <SelectItem value="all">All Platforms</SelectItem>
                    {PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-priority" className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Priority
                </Label>
                <Select
                  value={filters.priority || 'all'}
                  onValueChange={(value) => setFilters({ ...filters, priority: value === 'all' ? '' as LeadPriority | '' : value as LeadPriority })}
                >
                  <SelectTrigger id="filter-priority" className="h-11 border-2 border-primary/20 shadow-md hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/80 backdrop-blur-sm">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Sort Order
                </Label>
                <Select value={sortOrder} onValueChange={(value: 'latest' | 'oldest') => setSortOrder(value)}>
                  <SelectTrigger className="h-11 border-2 border-primary/20 shadow-md hover:border-primary/50 hover:shadow-lg transition-all duration-300 bg-background/80 backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-2 shadow-xl">
                    <SelectItem value="latest">Latest to First</SelectItem>
                    <SelectItem value="oldest">Oldest to First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  View Mode
                </Label>
                <div className="flex gap-2 p-1.5 bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 rounded-xl border border-primary/20 shadow-md">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className={`flex-1 font-semibold transition-all duration-300 ${
                      viewMode === 'table' 
                        ? 'shadow-lg bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500' 
                        : 'hover:bg-primary/10'
                    }`}
                  >
                    Table
                  </Button>
                  <Button
                    variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('kanban')}
                    className={`flex-1 font-semibold transition-all duration-300 ${
                      viewMode === 'kanban' 
                        ? 'shadow-lg bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500' 
                        : 'hover:bg-primary/10'
                    }`}
                  >
                    Kanban
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border-2 border-primary/10 shadow-lg bg-gradient-to-br from-card/50 to-card backdrop-blur-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:from-primary/15 hover:via-primary/10 border-b-2 border-primary/20">
                    <TableHead className="font-bold text-sm text-foreground">Lead ID</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Date</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Platform</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Business Name</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Location</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Job Role</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Contact</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Status</TableHead>
                    <TableHead className="font-bold text-sm text-foreground">Priority</TableHead>
                    {canEdit && <TableHead className="font-bold text-sm text-foreground">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative">
                            <div className="h-12 w-12 border-4 border-primary/20 rounded-full" />
                            <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                          </div>
                          <span className="text-muted-foreground font-medium">Loading leads...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 10 : 9} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 rounded-full bg-muted/50">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                          <span className="text-foreground font-semibold text-lg">No leads found</span>
                          <span className="text-sm text-muted-foreground">Try adjusting your filters</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLeads.map((lead, index) => (
                      <TableRow 
                        key={lead.id} 
                        className="group hover:bg-gradient-to-r hover:from-primary/5 hover:via-primary/5 hover:to-transparent transition-all duration-300 cursor-pointer border-b border-primary/5 hover:border-primary/20 hover:shadow-md"
                        onClick={() => handleView(lead)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="font-bold text-primary group-hover:text-primary/80 transition-colors">
                          {lead.leadId}
                        </TableCell>
                        <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                          {format(lead.dateOfRecording, 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-semibold border-2 group-hover:border-primary/50 transition-colors">
                            {lead.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold group-hover:text-primary transition-colors">
                          {lead.businessName}
                        </TableCell>
                        <TableCell className="text-muted-foreground group-hover:text-foreground transition-colors">
                          {lead.jobLocation}
                        </TableCell>
                        <TableCell className="group-hover:text-foreground transition-colors">
                          {lead.jobRole}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {lead.contactNo && (
                              <div className="flex items-center gap-2 text-sm group-hover:text-foreground transition-colors">
                                <Phone className="h-3.5 w-3.5 text-primary" />
                                <span>{lead.contactNo}</span>
                              </div>
                            )}
                            {lead.emailAddress && (
                              <div className="flex items-center gap-2 text-sm group-hover:text-foreground transition-colors">
                                <Mail className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate max-w-[150px]">{lead.emailAddress}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLORS[lead.status]} font-semibold shadow-sm`}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${PRIORITY_COLORS[lead.priority]} font-semibold shadow-sm`}>
                            {lead.priority}
                          </Badge>
                        </TableCell>
                        {canEdit && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-all">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 border-2 shadow-xl">
                                <DropdownMenuItem onClick={() => handleView(lead)} className="cursor-pointer">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(lead)} className="cursor-pointer">
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => setDeleteConfirm(lead.id)}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-primary/20">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, sortedLeads.length)} of {sortedLeads.length} leads
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="border-2 border-primary/20 hover:border-primary/50 transition-all"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 10) {
                          pageNum = i + 1;
                        } else if (currentPage <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 4) {
                          pageNum = totalPages - 9 + i;
                        } else {
                          pageNum = currentPage - 4 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-[2.5rem] border-2 transition-all ${
                              currentPage === pageNum
                                ? 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 border-primary shadow-lg'
                                : 'border-primary/20 hover:border-primary/50'
                            }`}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="border-2 border-primary/20 hover:border-primary/50 transition-all"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="w-full pb-4">
                <div className="flex gap-4 w-full">
                  {KANBAN_STATUSES.map((status) => {
                    const columnLeads = leadsByStatus[status] || [];
                    const leadIds = columnLeads.map(lead => lead.id);
                    return (
                      <DroppableLeadColumn
                        key={status}
                        id={status}
                        status={status}
                        title={status}
                        leadCount={columnLeads.length}
                        isOver={draggedOverColumn === status}
                        leadIds={leadIds}
                      >
                        {columnLeads.map((lead) => (
                          <DraggableLeadCard
                            key={lead.id}
                            lead={lead}
                            onView={handleView}
                            onEdit={handleEdit}
                            onDelete={setDeleteConfirm}
                            canEdit={canEdit}
                          />
                        ))}
                      </DroppableLeadColumn>
                    );
                  })}
                </div>
              </div>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* View Lead Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0 gap-0">
          {selectedLead && (
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
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <DialogTitle className="text-2xl font-bold mb-1.5 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                            {selectedLead.businessName}
                          </DialogTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono font-semibold text-xs px-2.5 py-1 bg-background/80 border-primary/30">
                              {selectedLead.leadId}
                            </Badge>
                            <Badge className={`${STATUS_COLORS[selectedLead.status]} font-semibold shadow-sm`}>
                              {selectedLead.status}
                            </Badge>
                            <Badge className={`${PRIORITY_COLORS[selectedLead.priority]} font-semibold shadow-sm`}>
                              {selectedLead.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{format(selectedLead.dateOfRecording, 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-4 w-4" />
                          <span>{selectedLead.platform}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-semibold text-foreground">Lead Score: {selectedLead.leadScore}/100</span>
                        </div>
                      </div>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setViewDialogOpen(false);
                            handleEdit(selectedLead);
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

              <div className="overflow-y-auto max-h-[calc(95vh-180px)] px-6 py-4">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
                    <TabsTrigger value="details" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Activity
                      {selectedLead.activityLog.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                          {selectedLead.activityLog.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="followups" className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4" />
                      Follow-ups
                      {selectedLead.followUps.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                          {selectedLead.followUps.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6 mt-0">
                    {/* Key Information Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            Business Information
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Business Name</Label>
                            <p className="text-sm font-semibold">{selectedLead.businessName}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              Location
                            </Label>
                            <p className="text-sm">{selectedLead.jobLocation}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              Owner / Manager
                            </Label>
                            <p className="text-sm font-medium">{selectedLead.businessOwnerManager}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50 hover:shadow-lg transition-all">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" />
                            Job Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Job Role</Label>
                            <p className="text-sm font-semibold">{selectedLead.jobRole}</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <UserPlus className="h-3.5 w-3.5" />
                              Vacancy
                            </Label>
                            <p className="text-sm">{selectedLead.vacancy}</p>
                          </div>
                          {selectedLead.isEmployee && (
                            <div className="pt-2 border-t space-y-2">
                              {selectedLead.employeeName && (
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Employee Name</Label>
                                  <p className="text-sm font-medium">{selectedLead.employeeName}</p>
                                </div>
                              )}
                              {selectedLead.employeePosition && (
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Position</Label>
                                  <p className="text-sm font-medium">{selectedLead.employeePosition}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Contact Information */}
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Phone className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs text-muted-foreground">Phone</Label>
                              <p className="text-sm font-medium">{selectedLead.contactNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Mail className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs text-muted-foreground">Email</Label>
                              <p className="text-sm font-medium truncate">{selectedLead.emailAddress || 'Not provided'}</p>
                            </div>
                          </div>
                          {selectedLead.link && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 md:col-span-2">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <ExternalLink className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <Label className="text-xs text-muted-foreground">Source Link</Label>
                                <a 
                                  href={selectedLead.link} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
                                >
                                  <span className="truncate">{selectedLead.link}</span>
                                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Call Notes - Enhanced */}
                    <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          Call Notes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                            {selectedLead.callNotes}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recap Section */}
                    {selectedLead.recap && (
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <Clipboard className="h-4 w-4 text-primary" />
                            Recap
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {selectedLead.recap}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Tasks Section */}
                    {selectedLead.tasks && (
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <CheckSquare className="h-4 w-4 text-primary" />
                            Tasks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {selectedLead.tasks}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Remarks Section */}
                    {selectedLead.remarks && (
                      <Card className="border-2 border-primary/10 bg-gradient-to-br from-card to-card/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Remarks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                              {selectedLead.remarks}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Action Buttons */}
                    {canEdit && (
                      <div className="flex items-center justify-between gap-4 pt-4 border-t">
                        <Button 
                          onClick={() => {
                            setViewDialogOpen(false);
                            handleEdit(selectedLead);
                          }}
                          className="shadow-md hover:shadow-lg transition-all"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Lead
                        </Button>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">Update Status:</Label>
                          <Select
                            value={selectedLead.status}
                            onValueChange={(value) => handleStatusChange(selectedLead.id, value as LeadStatus, selectedLead.status)}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="activity" className="space-y-4 mt-0">
                    {selectedLead.activityLog.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                          <Clock className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No activity recorded</p>
                        <p className="text-xs text-muted-foreground mt-1">Activity will appear here as you interact with this lead</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedLead.activityLog
                          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                          .map((activity, index) => (
                            <div key={activity.id} className="relative">
                              {index < selectedLead.activityLog.length - 1 && (
                                <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
                              )}
                              <Card className="border-2 border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
                                <CardContent className="p-4">
                                  <div className="flex gap-4">
                                    <div className="flex-shrink-0">
                                      <div className={`p-2.5 rounded-lg ${
                                        activity.type === 'call' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                        activity.type === 'email' ? 'bg-green-100 dark:bg-green-900/30' :
                                        activity.type === 'meeting' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                        activity.type === 'status_change' ? 'bg-orange-100 dark:bg-orange-900/30' :
                                        activity.type === 'follow_up' ? 'bg-pink-100 dark:bg-pink-900/30' :
                                        'bg-gray-100 dark:bg-gray-900/30'
                                      }`}>
                                        {activity.type === 'call' && <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                                        {activity.type === 'email' && <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />}
                                        {activity.type === 'meeting' && <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
                                        {activity.type === 'note' && <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                                        {activity.type === 'status_change' && <CheckCircle2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
                                        {activity.type === 'follow_up' && <Clock className="h-5 w-5 text-pink-600 dark:text-pink-400" />}
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold mb-1">{activity.description}</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <User className="h-3.5 w-3.5" />
                                        <span>{activity.userName}</span>
                                        <span>•</span>
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>{format(activity.timestamp, 'MMM dd, yyyy HH:mm')}</span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="followups" className="space-y-4 mt-0">
                    {selectedLead.followUps.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                          <CheckSquare className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No follow-ups scheduled</p>
                        <p className="text-xs text-muted-foreground mt-1">Add follow-ups to track important tasks</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedLead.followUps
                          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                          .map((followUp) => {
                            const isOverdue = !followUp.completed && followUp.dueDate < new Date();
                            const isUpcoming = !followUp.completed && followUp.dueDate >= new Date() && followUp.dueDate <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                            
                            return (
                              <Card 
                                key={followUp.id} 
                                className={`border-2 transition-all hover:shadow-md ${
                                  isOverdue ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20' :
                                  isUpcoming ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20' :
                                  followUp.completed ? 'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20' :
                                  'border-border/50'
                                }`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-2">
                                        <CheckSquare className={`h-4 w-4 ${
                                          followUp.completed ? 'text-green-600 dark:text-green-400' :
                                          isOverdue ? 'text-red-600 dark:text-red-400' :
                                          'text-muted-foreground'
                                        }`} />
                                        <p className="text-sm font-semibold">{followUp.description}</p>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground ml-6">
                                        <div className="flex items-center gap-1.5">
                                          <CalendarIcon className="h-3.5 w-3.5" />
                                          <span>Due: {format(followUp.dueDate, 'MMM dd, yyyy')}</span>
                                        </div>
                                        <span>•</span>
                                        <span className="capitalize">{followUp.type}</span>
                                        {followUp.createdByName && (
                                          <>
                                            <span>•</span>
                                            <span>Created by {followUp.createdByName}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                      {followUp.completed ? (
                                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 font-semibold">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Completed
                                        </Badge>
                                      ) : isOverdue ? (
                                        <Badge variant="destructive" className="font-semibold">
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          Overdue
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="font-semibold">
                                          Pending
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
              This action cannot be undone. This will permanently delete the lead.
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

export default RecruitmentLeads;

