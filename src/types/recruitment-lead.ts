export type LeadStatus = 
  | 'New' 
  | 'Contacted' 
  | 'Qualified' 
  | 'Meeting Scheduled' 
  | 'Follow-up Required'
  | 'Converted' 
  | 'Lost'
  | 'On Hold';

export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type Platform = 
  | 'Jora' 
  | 'Seek' 
  | 'Indeed' 
  | 'LinkedIn' 
  | 'Facebook' 
  | 'Instagram' 
  | 'Referral' 
  | 'Website' 
  | 'Direct Contact' 
  | 'Other';

export type JobRole = 
  | 'Chef / Cook' 
  | 'Head Chef' 
  | 'Sous Chef' 
  | 'Chef De Partie'
  | 'Commis Chef'
  | 'Kitchen Hand' 
  | 'Waiter / Waitress' 
  | 'Barista' 
  | 'Manager' 
  | 'Other';

export interface ActivityLog {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'status_change' | 'follow_up';
  description: string;
  timestamp: Date;
  userId: string;
  userName: string;
  metadata?: {
    duration?: number; // for calls in minutes
    emailSubject?: string;
    meetingDate?: Date;
    oldStatus?: LeadStatus;
    newStatus?: LeadStatus;
  };
}

export interface FollowUp {
  id: string;
  dueDate: Date;
  type: 'call' | 'email' | 'meeting' | 'other';
  description: string;
  completed: boolean;
  completedAt?: Date;
  createdBy: string;
  createdByName: string;
}

export interface RecruitmentLead {
  id: string;
  leadId: string; // Auto-generated ID like "RL001"
  dateOfRecording: Date;
  platform: Platform;
  link?: string;
  businessName: string;
  jobLocation: string;
  jobRole: JobRole;
  businessOwnerManager: string;
  vacancy: string;
  contactNo: string;
  emailAddress?: string;
  callNotes: string;
  remarks?: string;
  recap?: string;
  tasks?: string;
  isEmployee?: boolean;
  employeeName?: string;
  employeePosition?: string;
  
  // Marketing & Sales Features
  status: LeadStatus;
  priority: LeadPriority;
  leadScore: number; // 0-100 calculated score
  assignedTo?: string; // User ID
  assignedToName?: string;
  tags: string[];
  
  // Activity Tracking
  activityLog: ActivityLog[];
  followUps: FollowUp[];
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  
  // Meeting Information
  meetingScheduled?: Date;
  meetingLocation?: string;
  meetingNotes?: string;
  
  // Conversion Tracking
  convertedAt?: Date;
  convertedBy?: string;
  conversionValue?: number;
  lostReason?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface FirestoreRecruitmentLead {
  id: string;
  leadId: string;
  dateOfRecording: any; // Firestore Timestamp
  platform: Platform;
  link?: string;
  businessName: string;
  jobLocation: string;
  jobRole: JobRole;
  businessOwnerManager: string;
  vacancy: string;
  contactNo: string;
  emailAddress?: string;
  callNotes: string;
  remarks?: string;
  recap?: string;
  tasks?: string;
  isEmployee?: boolean;
  employeeName?: string;
  employeePosition?: string;
  
  // Marketing & Sales Features
  status: LeadStatus;
  priority: LeadPriority;
  leadScore: number;
  assignedTo?: string;
  assignedToName?: string;
  tags: string[];
  
  // Activity Tracking
  activityLog: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: any; // Firestore Timestamp
    userId: string;
    userName: string;
    metadata?: any;
  }>;
  followUps: Array<{
    id: string;
    dueDate: any; // Firestore Timestamp
    type: string;
    description: string;
    completed: boolean;
    completedAt?: any; // Firestore Timestamp
    createdBy: string;
    createdByName: string;
  }>;
  lastContactDate?: any; // Firestore Timestamp
  nextFollowUpDate?: any; // Firestore Timestamp
  
  // Meeting Information
  meetingScheduled?: any; // Firestore Timestamp
  meetingLocation?: string;
  meetingNotes?: string;
  
  // Conversion Tracking
  convertedAt?: any; // Firestore Timestamp
  convertedBy?: string;
  conversionValue?: number;
  lostReason?: string;
  
  // Metadata
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface LeadAnalytics {
  totalLeads: number;
  byStatus: Record<LeadStatus, number>;
  byPlatform: Record<Platform, number>;
  byPriority: Record<LeadPriority, number>;
  conversionRate: number;
  averageLeadScore: number;
  leadsThisMonth: number;
  leadsThisWeek: number;
  upcomingFollowUps: number;
  overdueFollowUps: number;
}

