export type CandidateStatus = 
  | 'New' 
  | 'Reviewing' 
  | 'Shortlisted' 
  | 'Interview Scheduled'
  | 'Rejected' 
  | 'Hired'
  | 'On Hold';

export type CandidatePriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type JobRole = 
  | 'Chef / Cook' 
  | 'Head Chef' 
  | 'Sous Chef' 
  | 'Kitchen Hand' 
  | 'Waiter / Waitress' 
  | 'Barista' 
  | 'Manager' 
  | 'Other'
  | string; // Allow custom job roles

export type ExperienceLevel = 
  | 'Entry Level' 
  | 'Junior (1-3 years)' 
  | 'Mid Level (3-5 years)' 
  | 'Senior (5-10 years)' 
  | 'Expert (10+ years)';

export interface CandidateNote {
  id: string;
  note: string;
  addedBy: string; // User ID
  addedByName: string; // User name for display
  addedAt: Date;
}

export interface CandidateCV {
  id: string;
  candidateId: string; // Auto-generated ID like "CV001"
  candidateName: string;
  email?: string;
  phone?: string;
  jobRole: JobRole | JobRole[];
  experienceLevel?: ExperienceLevel;
  location?: string;
  cvUrl: string; // URL to uploaded CV file
  cvFileName?: string;
  notes?: string; // Legacy notes field (kept for backward compatibility)
  candidateNotes?: CandidateNote[]; // Array of notes with author and timestamp
  status: CandidateStatus;
  priority: CandidatePriority;
  tags: string[];
  assignedTo?: string; // User ID of recruiter
  assignedToName?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface FirestoreCandidateCV {
  id: string;
  candidateId: string;
  candidateName: string;
  email?: string;
  phone?: string;
  jobRole: JobRole | JobRole[];
  experienceLevel?: ExperienceLevel;
  location?: string;
  cvUrl: string;
  cvFileName?: string;
  notes?: string; // Legacy notes field
  candidateNotes?: Array<{
    id: string;
    note: string;
    addedBy: string;
    addedByName: string;
    addedAt: any; // Firestore Timestamp
  }>;
  status: CandidateStatus;
  priority: CandidatePriority;
  tags: string[];
  assignedTo?: string;
  assignedToName?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
  createdByName: string;
  updatedBy?: string;
  updatedByName?: string;
}

export interface CandidateAnalytics {
  totalCandidates: number;
  byStatus: Record<CandidateStatus, number>;
  byJobRole: Record<JobRole, number>;
  byPriority: Record<CandidatePriority, number>;
  byExperienceLevel: Record<ExperienceLevel, number>;
  candidatesThisMonth: number;
  candidatesThisWeek: number;
  shortlistedCount: number;
  hiredCount: number;
}
