import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  Timestamp, 
  deleteDoc,
  onSnapshot,
  limit,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  RecruitmentLead, 
  FirestoreRecruitmentLead, 
  LeadStatus,
  LeadPriority,
  Platform,
  JobRole,
  ActivityLog,
  FollowUp,
  LeadAnalytics
} from '@/types/recruitment-lead';

/**
 * Convert Firestore recruitment lead to app RecruitmentLead
 */
export function convertFirestoreRecruitmentLead(docData: any, docId: string): RecruitmentLead {
  // Convert activity log
  const activityLog: ActivityLog[] = (docData.activityLog || []).map((log: any) => ({
    id: log.id,
    type: log.type,
    description: log.description,
    timestamp: log.timestamp?.toDate() || new Date(),
    userId: log.userId,
    userName: log.userName,
    metadata: log.metadata ? {
      ...log.metadata,
      meetingDate: log.metadata.meetingDate?.toDate(),
    } : undefined,
  }));

  // Convert follow-ups
  const followUps: FollowUp[] = (docData.followUps || []).map((fu: any) => ({
    id: fu.id,
    dueDate: fu.dueDate?.toDate() || new Date(),
    type: fu.type,
    description: fu.description,
    completed: fu.completed || false,
    completedAt: fu.completedAt?.toDate(),
    createdBy: fu.createdBy,
    createdByName: fu.createdByName,
  }));

  return {
    id: docId,
    leadId: docData.leadId || '',
    dateOfRecording: docData.dateOfRecording?.toDate() || new Date(),
    platform: docData.platform || 'Other',
    link: docData.link,
    businessName: docData.businessName || '',
    jobLocation: docData.jobLocation || '',
    jobRole: docData.jobRole || 'Other',
    businessOwnerManager: docData.businessOwnerManager || '',
    vacancy: docData.vacancy || '',
    contactNo: docData.contactNo || '',
    emailAddress: docData.emailAddress,
    callNotes: docData.callNotes || '',
    remarks: docData.remarks,
    recap: docData.recap,
    tasks: docData.tasks,
    isEmployee: docData.isEmployee || false,
    employeeName: docData.employeeName,
    employeePosition: docData.employeePosition,
    status: docData.status || 'New',
    priority: docData.priority || 'Medium',
    leadScore: docData.leadScore || 0,
    assignedTo: docData.assignedTo,
    assignedToName: docData.assignedToName,
    tags: docData.tags || [],
    activityLog,
    followUps,
    lastContactDate: docData.lastContactDate?.toDate(),
    nextFollowUpDate: docData.nextFollowUpDate?.toDate(),
    meetingScheduled: docData.meetingScheduled?.toDate(),
    meetingLocation: docData.meetingLocation,
    meetingNotes: docData.meetingNotes,
    convertedAt: docData.convertedAt?.toDate(),
    convertedBy: docData.convertedBy,
    conversionValue: docData.conversionValue,
    lostReason: docData.lostReason,
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    createdBy: docData.createdBy || '',
    createdByName: docData.createdByName || '',
    updatedBy: docData.updatedBy,
    updatedByName: docData.updatedByName,
  };
}

/**
 * Calculate lead score based on various factors
 */
export function calculateLeadScore(lead: Partial<RecruitmentLead>): number {
  let score = 0;
  
  // Priority weight (0-30 points)
  const priorityScores = { Urgent: 30, High: 20, Medium: 10, Low: 5 };
  score += priorityScores[lead.priority || 'Medium'];
  
  // Status weight (0-25 points)
  const statusScores = { 
    'Meeting Scheduled': 25, 
    'Qualified': 20, 
    'Contacted': 15, 
    'Follow-up Required': 10,
    'New': 5,
    'On Hold': 0,
    'Converted': 0,
    'Lost': 0
  };
  score += statusScores[lead.status || 'New'];
  
  // Contact information completeness (0-15 points)
  if (lead.emailAddress) score += 5;
  if (lead.contactNo) score += 5;
  if (lead.link) score += 5;
  
  // Activity level (0-15 points)
  const activityCount = lead.activityLog?.length || 0;
  score += Math.min(activityCount * 2, 15);
  
  // Follow-ups scheduled (0-10 points)
  const activeFollowUps = lead.followUps?.filter(fu => !fu.completed).length || 0;
  score += Math.min(activeFollowUps * 3, 10);
  
  // Meeting scheduled (0-5 points)
  if (lead.meetingScheduled) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Generate next lead ID
 */
async function generateLeadId(): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const q = query(
      collection(db, 'recruitmentLeads'),
      orderBy('leadId', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return 'RL001';
    }
    
    const lastLead = snapshot.docs[0].data();
    const lastId = lastLead.leadId || 'RL000';
    const lastNumber = parseInt(lastId.replace('RL', '')) || 0;
    const nextNumber = lastNumber + 1;
    return `RL${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating lead ID:', error);
    // Fallback to timestamp-based ID
    return `RL${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Create a new recruitment lead
 */
export async function createRecruitmentLead(leadData: {
  dateOfRecording: Date;
  platform: string;
  link?: string;
  businessName: string;
  jobLocation: string;
  jobRole: string;
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
  status?: LeadStatus;
  priority?: string;
  assignedTo?: string;
  assignedToName?: string;
  tags?: string[];
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  
  try {
    const now = Timestamp.now();
    const leadId = await generateLeadId();
    
    // Build the lead object, only including fields that are not undefined
    const newLead: any = {
      leadId,
      dateOfRecording: Timestamp.fromDate(leadData.dateOfRecording),
      platform: leadData.platform as any,
      businessName: leadData.businessName,
      jobLocation: leadData.jobLocation,
      jobRole: leadData.jobRole as any,
      businessOwnerManager: leadData.businessOwnerManager,
      vacancy: leadData.vacancy,
      contactNo: leadData.contactNo,
      callNotes: leadData.callNotes,
      status: leadData.status || 'New',
      priority: (leadData.priority || 'Medium') as any,
      leadScore: 0, // Will be calculated
      tags: leadData.tags || [],
      activityLog: [],
      followUps: [],
      createdAt: now,
      updatedAt: now,
      createdBy: leadData.createdBy,
      createdByName: leadData.createdByName,
    };
    
    // Only include optional fields if they are defined
    if (leadData.link !== undefined && leadData.link !== null && leadData.link !== '') {
      newLead.link = leadData.link;
    }
    if (leadData.emailAddress !== undefined && leadData.emailAddress !== null && leadData.emailAddress !== '') {
      newLead.emailAddress = leadData.emailAddress;
    }
    if (leadData.remarks !== undefined && leadData.remarks !== null && leadData.remarks !== '') {
      newLead.remarks = leadData.remarks;
    }
    if (leadData.assignedTo !== undefined && leadData.assignedTo !== null && leadData.assignedTo !== '') {
      newLead.assignedTo = leadData.assignedTo;
    }
    if (leadData.assignedToName !== undefined && leadData.assignedToName !== null && leadData.assignedToName !== '') {
      newLead.assignedToName = leadData.assignedToName;
    }
    
    // Calculate initial lead score
    const tempLead = convertFirestoreRecruitmentLead(newLead, 'temp');
    newLead.leadScore = calculateLeadScore(tempLead);
    
    const docRef = await addDoc(collection(db, 'recruitmentLeads'), newLead);
    return docRef.id;
  } catch (error) {
    console.error('Error creating recruitment lead:', error);
    throw error;
  }
}

/**
 * Update a recruitment lead
 */
export async function updateRecruitmentLead(
  leadId: string,
  updates: Partial<{
    dateOfRecording: Date;
    platform: Platform;
    link: string;
    businessName: string;
    jobLocation: string;
    jobRole: JobRole;
    businessOwnerManager: string;
    vacancy: string;
    contactNo: string;
    emailAddress: string;
    callNotes: string;
    remarks: string;
    recap: string;
    tasks: string;
    isEmployee: boolean;
    employeeName: string;
    employeePosition: string;
    status: LeadStatus;
    priority: LeadPriority;
    assignedTo: string;
    assignedToName: string;
    tags: string[];
    meetingScheduled: Date;
    meetingLocation: string;
    meetingNotes: string;
    convertedAt: Date;
    convertedBy: string;
    conversionValue: number;
    lostReason: string;
    updatedBy: string;
    updatedByName: string;
  }>
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const leadRef = doc(db, 'recruitmentLeads', leadId);
    const leadDoc = await getDoc(leadRef);
    
    if (!leadDoc.exists()) {
      throw new Error('Lead not found');
    }
    
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };
    
    // Convert dates to Firestore timestamps
    if (updates.dateOfRecording) {
      updateData.dateOfRecording = Timestamp.fromDate(updates.dateOfRecording);
    }
    if (updates.meetingScheduled) {
      updateData.meetingScheduled = Timestamp.fromDate(updates.meetingScheduled);
    }
    if (updates.convertedAt) {
      updateData.convertedAt = Timestamp.fromDate(updates.convertedAt);
    }
    
    // Copy other fields, filtering out undefined values
    Object.keys(updates).forEach(key => {
      if (key !== 'dateOfRecording' && key !== 'meetingScheduled' && key !== 'convertedAt') {
        const value = updates[key as keyof typeof updates];
        // Only include the field if it's not undefined, null, or empty string
        if (value !== undefined && value !== null && value !== '') {
          updateData[key] = value;
        }
      }
    });
    
    await updateDoc(leadRef, updateData);
    
    // Recalculate lead score if relevant fields changed
    const currentLead = convertFirestoreRecruitmentLead(leadDoc.data(), leadId);
    const updatedLead = { ...currentLead, ...updates };
    const newScore = calculateLeadScore(updatedLead);
    await updateDoc(leadRef, { leadScore: newScore });
  } catch (error) {
    console.error('Error updating recruitment lead:', error);
    throw error;
  }
}

/**
 * Add activity log entry
 */
export async function addActivityLog(
  leadId: string,
  activity: Omit<ActivityLog, 'id' | 'timestamp'>
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const leadRef = doc(db, 'recruitmentLeads', leadId);
    const leadDoc = await getDoc(leadRef);
    
    if (!leadDoc.exists()) {
      throw new Error('Lead not found');
    }
    
    const currentData = leadDoc.data();
    const activityLog = currentData.activityLog || [];
    
    const newActivity = {
      id: Date.now().toString(),
      ...activity,
      timestamp: Timestamp.now(),
      metadata: activity.metadata ? {
        ...activity.metadata,
        meetingDate: activity.metadata.meetingDate 
          ? Timestamp.fromDate(activity.metadata.meetingDate)
          : undefined,
      } : undefined,
    };
    
    await updateDoc(leadRef, {
      activityLog: [...activityLog, newActivity],
      lastContactDate: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error adding activity log:', error);
    throw error;
  }
}

/**
 * Add follow-up
 */
export async function addFollowUp(
  leadId: string,
  followUp: Omit<FollowUp, 'id' | 'completed'>
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const leadRef = doc(db, 'recruitmentLeads', leadId);
    const leadDoc = await getDoc(leadRef);
    
    if (!leadDoc.exists()) {
      throw new Error('Lead not found');
    }
    
    const currentData = leadDoc.data();
    const followUps = currentData.followUps || [];
    
    const newFollowUp = {
      id: Date.now().toString(),
      ...followUp,
      dueDate: Timestamp.fromDate(followUp.dueDate),
      completed: false,
    };
    
    // Update next follow-up date if this is the earliest
    const allFollowUps = [...followUps, newFollowUp];
    const incompleteFollowUps = allFollowUps
      .filter(fu => !fu.completed)
      .map(fu => fu.dueDate?.toDate?.() || new Date(fu.dueDate))
      .sort((a, b) => a.getTime() - b.getTime());
    
    await updateDoc(leadRef, {
      followUps: allFollowUps,
      nextFollowUpDate: incompleteFollowUps.length > 0 
        ? Timestamp.fromDate(incompleteFollowUps[0])
        : null,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error adding follow-up:', error);
    throw error;
  }
}

/**
 * Complete follow-up
 */
export async function completeFollowUp(
  leadId: string,
  followUpId: string
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const leadRef = doc(db, 'recruitmentLeads', leadId);
    const leadDoc = await getDoc(leadRef);
    
    if (!leadDoc.exists()) {
      throw new Error('Lead not found');
    }
    
    const currentData = leadDoc.data();
    const followUps = (currentData.followUps || []).map((fu: any) => 
      fu.id === followUpId
        ? { ...fu, completed: true, completedAt: Timestamp.now() }
        : fu
    );
    
    // Recalculate next follow-up date
    const incompleteFollowUps = followUps
      .filter((fu: any) => !fu.completed)
      .map((fu: any) => fu.dueDate?.toDate?.() || new Date(fu.dueDate))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime());
    
    await updateDoc(leadRef, {
      followUps,
      nextFollowUpDate: incompleteFollowUps.length > 0 
        ? Timestamp.fromDate(incompleteFollowUps[0])
        : null,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error completing follow-up:', error);
    throw error;
  }
}

/**
 * Get all recruitment leads
 */
export async function getAllRecruitmentLeads(filters?: {
  status?: LeadStatus;
  platform?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}): Promise<RecruitmentLead[]> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    // Check if we have any filters that would require a composite index
    const hasFilters = filters?.status || filters?.platform || filters?.priority || filters?.assignedTo;
    
    let q;
    if (hasFilters) {
      // When filters are applied, we can't use orderBy with where clauses without composite indexes
      // So we'll fetch and sort client-side
      q = query(collection(db, 'recruitmentLeads'));
      
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters?.platform) {
        q = query(q, where('platform', '==', filters.platform));
      }
      if (filters?.priority) {
        q = query(q, where('priority', '==', filters.priority));
      }
      if (filters?.assignedTo) {
        q = query(q, where('assignedTo', '==', filters.assignedTo));
      }
    } else {
      // No filters, safe to use orderBy on leadId
      q = query(collection(db, 'recruitmentLeads'), orderBy('leadId', 'asc'));
    }
    
    const snapshot = await getDocs(q);
    let leads = snapshot.docs.map(doc => 
      convertFirestoreRecruitmentLead(doc.data(), doc.id)
    );
    
    // Sort client-side by leadId in ascending order (oldest first)
    // This ensures consistent sorting whether filters are applied or not
    leads.sort((a, b) => {
      // Extract numeric part from leadId (e.g., "RL001" -> 1, "RL002" -> 2)
      const getLeadNumber = (leadId: string) => {
        const match = leadId.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getLeadNumber(a.leadId) - getLeadNumber(b.leadId);
    });
    
    // Apply search filter if provided
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      leads = leads.filter(lead =>
        lead.businessName.toLowerCase().includes(searchLower) ||
        lead.businessOwnerManager.toLowerCase().includes(searchLower) ||
        lead.jobLocation.toLowerCase().includes(searchLower) ||
        lead.contactNo.includes(searchLower) ||
        lead.emailAddress?.toLowerCase().includes(searchLower) ||
        lead.leadId.toLowerCase().includes(searchLower)
      );
    }
    
    return leads;
  } catch (error) {
    console.error('Error fetching recruitment leads:', error);
    throw error;
  }
}

/**
 * Get recruitment lead by ID
 */
export async function getRecruitmentLeadById(leadId: string): Promise<RecruitmentLead | null> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const leadRef = doc(db, 'recruitmentLeads', leadId);
    const leadDoc = await getDoc(leadRef);
    
    if (!leadDoc.exists()) {
      return null;
    }
    
    return convertFirestoreRecruitmentLead(leadDoc.data(), leadDoc.id);
  } catch (error) {
    console.error('Error fetching recruitment lead:', error);
    throw error;
  }
}

/**
 * Delete recruitment lead
 */
export async function deleteRecruitmentLead(leadId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    await deleteDoc(doc(db, 'recruitmentLeads', leadId));
  } catch (error) {
    console.error('Error deleting recruitment lead:', error);
    throw error;
  }
}

/**
 * Get recruitment leads analytics
 */
export async function getRecruitmentLeadsAnalytics(): Promise<LeadAnalytics> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const snapshot = await getDocs(collection(db, 'recruitmentLeads'));
    const leads = snapshot.docs.map(doc => 
      convertFirestoreRecruitmentLead(doc.data(), doc.id)
    );
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    
    let totalScore = 0;
    let convertedCount = 0;
    let leadsThisMonth = 0;
    let leadsThisWeek = 0;
    let upcomingFollowUps = 0;
    let overdueFollowUps = 0;
    
    leads.forEach(lead => {
      // Count by status
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      
      // Count by platform
      byPlatform[lead.platform] = (byPlatform[lead.platform] || 0) + 1;
      
      // Count by priority
      byPriority[lead.priority] = (byPriority[lead.priority] || 0) + 1;
      
      // Calculate metrics
      totalScore += lead.leadScore;
      if (lead.status === 'Converted') convertedCount++;
      
      if (lead.createdAt >= startOfMonth) leadsThisMonth++;
      if (lead.createdAt >= startOfWeek) leadsThisWeek++;
      
      // Count follow-ups
      lead.followUps.forEach(fu => {
        if (!fu.completed) {
          if (fu.dueDate < now) {
            overdueFollowUps++;
          } else if (fu.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            upcomingFollowUps++;
          }
        }
      });
    });
    
    return {
      totalLeads: leads.length,
      byStatus: byStatus as any,
      byPlatform: byPlatform as any,
      byPriority: byPriority as any,
      conversionRate: leads.length > 0 ? (convertedCount / leads.length) * 100 : 0,
      averageLeadScore: leads.length > 0 ? totalScore / leads.length : 0,
      leadsThisMonth,
      leadsThisWeek,
      upcomingFollowUps,
      overdueFollowUps,
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

/**
 * Subscribe to recruitment leads changes
 */
export function subscribeToRecruitmentLeads(
  callback: (leads: RecruitmentLead[]) => void,
  filters?: {
    status?: LeadStatus;
    platform?: string;
    priority?: string;
    assignedTo?: string;
  }
): () => void {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  // Check if we have any filters that would require a composite index
  const hasFilters = filters?.status || filters?.platform || filters?.priority || filters?.assignedTo;
  
  let q;
  if (hasFilters) {
    // When filters are applied, we can't use orderBy with where clauses without composite indexes
    // So we'll fetch and sort client-side
    q = query(collection(db, 'recruitmentLeads'));
    
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.platform) {
      q = query(q, where('platform', '==', filters.platform));
    }
    if (filters?.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }
    if (filters?.assignedTo) {
      q = query(q, where('assignedTo', '==', filters.assignedTo));
    }
  } else {
    // No filters, safe to use orderBy on leadId
    q = query(collection(db, 'recruitmentLeads'), orderBy('leadId', 'asc'));
  }
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    let leads = snapshot.docs.map(doc => 
      convertFirestoreRecruitmentLead(doc.data(), doc.id)
    );
    
    // Sort client-side by leadId in ascending order (oldest first)
    // This ensures consistent sorting whether filters are applied or not
    leads.sort((a, b) => {
      // Extract numeric part from leadId (e.g., "RL001" -> 1, "RL002" -> 2)
      const getLeadNumber = (leadId: string) => {
        const match = leadId.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getLeadNumber(a.leadId) - getLeadNumber(b.leadId);
    });
    
    callback(leads);
  });
  
  return unsubscribe;
}

