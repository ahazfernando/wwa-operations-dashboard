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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  CandidateCV, 
  FirestoreCandidateCV, 
  CandidateStatus,
  CandidatePriority,
  JobRole,
  ExperienceLevel,
  CandidateAnalytics,
  CandidateNote
} from '@/types/candidate-cv';

/**
 * Convert Firestore candidate CV to app CandidateCV
 */
export function convertFirestoreCandidateCV(docData: any, docId: string): CandidateCV {
  // Convert candidate notes
  const candidateNotes: CandidateNote[] = (docData.candidateNotes || []).map((note: any) => ({
    id: note.id || '',
    note: note.note || '',
    addedBy: note.addedBy || '',
    addedByName: note.addedByName || '',
    addedAt: note.addedAt?.toDate() || new Date(),
  }));

  return {
    id: docId,
    candidateId: docData.candidateId || '',
    candidateName: docData.candidateName || '',
    email: docData.email,
    phone: docData.phone,
    jobRole: Array.isArray(docData.jobRole) ? docData.jobRole : docData.jobRole ? [docData.jobRole] : ['Other'],
    experienceLevel: docData.experienceLevel,
    location: docData.location,
    cvUrl: docData.cvUrl || '',
    cvFileName: docData.cvFileName,
    notes: docData.notes,
    candidateNotes: candidateNotes.length > 0 ? candidateNotes : undefined,
    status: docData.status || 'New',
    priority: docData.priority || 'Medium',
    tags: docData.tags || [],
    assignedTo: docData.assignedTo,
    assignedToName: docData.assignedToName,
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    createdBy: docData.createdBy || '',
    createdByName: docData.createdByName || '',
    updatedBy: docData.updatedBy,
    updatedByName: docData.updatedByName,
  };
}

/**
 * Generate next candidate ID
 */
async function generateCandidateId(): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const q = query(
      collection(db, 'candidateCVs'),
      orderBy('candidateId', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return 'CV001';
    }
    
    const lastCandidate = snapshot.docs[0].data();
    const lastId = lastCandidate.candidateId || 'CV000';
    const lastNumber = parseInt(lastId.replace('CV', '')) || 0;
    const nextNumber = lastNumber + 1;
    return `CV${nextNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating candidate ID:', error);
    // Fallback to timestamp-based ID
    return `CV${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Create a new candidate CV
 */
export async function createCandidateCV(candidateData: {
  candidateName: string;
  email?: string;
  phone?: string;
  jobRole: JobRole;
  experienceLevel?: ExperienceLevel;
  location?: string;
  cvUrl: string;
  cvFileName?: string;
  notes?: string;
  status?: CandidateStatus;
  priority?: CandidatePriority;
  tags?: string[];
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  
  try {
    const now = Timestamp.now();
    const candidateId = await generateCandidateId();
    
    const newCandidate: any = {
      candidateId,
      candidateName: candidateData.candidateName,
      jobRole: candidateData.jobRole,
      cvUrl: candidateData.cvUrl,
      status: candidateData.status || 'New',
      priority: candidateData.priority || 'Medium',
      tags: candidateData.tags || [],
      createdAt: now,
      updatedAt: now,
      createdBy: candidateData.createdBy,
      createdByName: candidateData.createdByName,
    };
    
    // Only include optional fields if they are defined
    if (candidateData.email !== undefined && candidateData.email !== null && candidateData.email !== '') {
      newCandidate.email = candidateData.email;
    }
    if (candidateData.phone !== undefined && candidateData.phone !== null && candidateData.phone !== '') {
      newCandidate.phone = candidateData.phone;
    }
    if (candidateData.experienceLevel !== undefined && candidateData.experienceLevel !== null) {
      newCandidate.experienceLevel = candidateData.experienceLevel;
    }
    if (candidateData.location !== undefined && candidateData.location !== null && candidateData.location !== '') {
      newCandidate.location = candidateData.location;
    }
    if (candidateData.cvFileName !== undefined && candidateData.cvFileName !== null) {
      newCandidate.cvFileName = candidateData.cvFileName;
    }
    if (candidateData.notes !== undefined && candidateData.notes !== null && candidateData.notes !== '') {
      newCandidate.notes = candidateData.notes;
    }
    if (candidateData.assignedTo !== undefined && candidateData.assignedTo !== null && candidateData.assignedTo !== '') {
      newCandidate.assignedTo = candidateData.assignedTo;
    }
    if (candidateData.assignedToName !== undefined && candidateData.assignedToName !== null && candidateData.assignedToName !== '') {
      newCandidate.assignedToName = candidateData.assignedToName;
    }
    
    const docRef = await addDoc(collection(db, 'candidateCVs'), newCandidate);
    return docRef.id;
  } catch (error) {
    console.error('Error creating candidate CV:', error);
    throw error;
  }
}

/**
 * Update a candidate CV
 */
export async function updateCandidateCV(
  candidateId: string,
  updates: Partial<{
    candidateName: string;
    email: string;
    phone: string;
    jobRole: JobRole | JobRole[];
    experienceLevel: ExperienceLevel;
    location: string;
    cvUrl: string;
    cvFileName: string;
    notes: string;
    status: CandidateStatus;
    priority: CandidatePriority;
    tags: string[];
    assignedTo: string;
    assignedToName: string;
    updatedBy: string;
    updatedByName: string;
  }>
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const candidateRef = doc(db, 'candidateCVs', candidateId);
    const candidateDoc = await getDoc(candidateRef);
    
    if (!candidateDoc.exists()) {
      throw new Error('Candidate CV not found');
    }
    
    const updateData: any = {
      updatedAt: Timestamp.now(),
    };
    
    // Copy other fields, filtering out undefined values
    Object.keys(updates).forEach(key => {
      const value = updates[key as keyof typeof updates];
      // Only include the field if it's not undefined
      if (value !== undefined && value !== null && value !== '') {
        updateData[key] = value;
      }
    });
    
    await updateDoc(candidateRef, updateData);
  } catch (error) {
    console.error('Error updating candidate CV:', error);
    throw error;
  }
}

/**
 * Get all candidate CVs
 */
export async function getAllCandidateCVs(filters?: {
  status?: CandidateStatus;
  jobRole?: JobRole;
  priority?: CandidatePriority;
  experienceLevel?: ExperienceLevel;
  assignedTo?: string;
  search?: string;
}): Promise<CandidateCV[]> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const hasFilters = filters?.status || filters?.jobRole || filters?.priority || filters?.experienceLevel || filters?.assignedTo;
    
    let q;
    if (hasFilters) {
      q = query(collection(db, 'candidateCVs'));
      
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters?.jobRole) {
        // Use array-contains to match if jobRole is an array, or == for single value
        // Note: Firestore array-contains will work for arrays, == will work for single values
        // We'll filter client-side for better compatibility
      }
      if (filters?.priority) {
        q = query(q, where('priority', '==', filters.priority));
      }
      if (filters?.experienceLevel) {
        q = query(q, where('experienceLevel', '==', filters.experienceLevel));
      }
      if (filters?.assignedTo) {
        q = query(q, where('assignedTo', '==', filters.assignedTo));
      }
    } else {
      q = query(collection(db, 'candidateCVs'), orderBy('candidateId', 'asc'));
    }
    
    const snapshot = await getDocs(q);
    let candidates = snapshot.docs.map(doc => 
      convertFirestoreCandidateCV(doc.data(), doc.id)
    );
    
    // Sort client-side by candidateId in ascending order
    candidates.sort((a, b) => {
      const getCandidateNumber = (candidateId: string) => {
        const match = candidateId.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getCandidateNumber(a.candidateId) - getCandidateNumber(b.candidateId);
    });
    
    // Apply search filter if provided
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      candidates = candidates.filter(candidate =>
        candidate.candidateName.toLowerCase().includes(searchLower) ||
        candidate.email?.toLowerCase().includes(searchLower) ||
        candidate.phone?.includes(searchLower) ||
        candidate.location?.toLowerCase().includes(searchLower) ||
        candidate.candidateId.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply job role filter (handle both single and array values)
    if (filters?.jobRole) {
      candidates = candidates.filter(candidate => {
        const candidateRoles = Array.isArray(candidate.jobRole) ? candidate.jobRole : [candidate.jobRole];
        return candidateRoles.includes(filters.jobRole!);
      });
    }
    
    return candidates;
  } catch (error) {
    console.error('Error fetching candidate CVs:', error);
    throw error;
  }
}

/**
 * Get candidate CV by ID
 */
export async function getCandidateCVById(candidateId: string): Promise<CandidateCV | null> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const candidateRef = doc(db, 'candidateCVs', candidateId);
    const candidateDoc = await getDoc(candidateRef);
    
    if (!candidateDoc.exists()) {
      return null;
    }
    
    return convertFirestoreCandidateCV(candidateDoc.data(), candidateDoc.id);
  } catch (error) {
    console.error('Error fetching candidate CV:', error);
    throw error;
  }
}

/**
 * Delete candidate CV
 */
export async function deleteCandidateCV(candidateId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    await deleteDoc(doc(db, 'candidateCVs', candidateId));
  } catch (error) {
    console.error('Error deleting candidate CV:', error);
    throw error;
  }
}

/**
 * Get candidate CVs analytics
 */
export async function getCandidateCVsAnalytics(): Promise<CandidateAnalytics> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const snapshot = await getDocs(collection(db, 'candidateCVs'));
    const candidates = snapshot.docs.map(doc => 
      convertFirestoreCandidateCV(doc.data(), doc.id)
    );
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const byStatus: Record<string, number> = {};
    const byJobRole: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byExperienceLevel: Record<string, number> = {};
    
    let candidatesThisMonth = 0;
    let candidatesThisWeek = 0;
    let shortlistedCount = 0;
    let hiredCount = 0;
    
    candidates.forEach(candidate => {
      // Count by status
      byStatus[candidate.status] = (byStatus[candidate.status] || 0) + 1;
      
      // Count by job role (handle both single and array values)
      const roles = Array.isArray(candidate.jobRole) ? candidate.jobRole : [candidate.jobRole];
      roles.forEach(role => {
        byJobRole[role] = (byJobRole[role] || 0) + 1;
      });
      
      // Count by priority
      byPriority[candidate.priority] = (byPriority[candidate.priority] || 0) + 1;
      
      // Count by experience level
      if (candidate.experienceLevel) {
        byExperienceLevel[candidate.experienceLevel] = (byExperienceLevel[candidate.experienceLevel] || 0) + 1;
      }
      
      // Calculate metrics
      if (candidate.createdAt >= startOfMonth) candidatesThisMonth++;
      if (candidate.createdAt >= startOfWeek) candidatesThisWeek++;
      if (candidate.status === 'Shortlisted') shortlistedCount++;
      if (candidate.status === 'Hired') hiredCount++;
    });
    
    return {
      totalCandidates: candidates.length,
      byStatus: byStatus as any,
      byJobRole: byJobRole as any,
      byPriority: byPriority as any,
      byExperienceLevel: byExperienceLevel as any,
      candidatesThisMonth,
      candidatesThisWeek,
      shortlistedCount,
      hiredCount,
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    throw error;
  }
}

/**
 * Subscribe to candidate CVs changes
 */
export function subscribeToCandidateCVs(
  callback: (candidates: CandidateCV[]) => void,
  filters?: {
    status?: CandidateStatus;
    jobRole?: JobRole;
    priority?: CandidatePriority;
    experienceLevel?: ExperienceLevel;
    assignedTo?: string;
  }
): () => void {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  const hasFilters = filters?.status || filters?.jobRole || filters?.priority || filters?.experienceLevel || filters?.assignedTo;
  
  let q;
  if (hasFilters) {
    q = query(collection(db, 'candidateCVs'));
    
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.jobRole) {
      // Use array-contains to match if jobRole is an array, or == for single value
      // Note: Firestore array-contains will work for arrays, == will work for single values
      // We'll filter client-side for better compatibility
    }
    if (filters?.priority) {
      q = query(q, where('priority', '==', filters.priority));
    }
    if (filters?.experienceLevel) {
      q = query(q, where('experienceLevel', '==', filters.experienceLevel));
    }
    if (filters?.assignedTo) {
      q = query(q, where('assignedTo', '==', filters.assignedTo));
    }
  } else {
    q = query(collection(db, 'candidateCVs'), orderBy('candidateId', 'asc'));
  }
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    let candidates = snapshot.docs.map(doc => 
      convertFirestoreCandidateCV(doc.data(), doc.id)
    );
    
    // Apply job role filter client-side if provided
    if (filters?.jobRole) {
      candidates = candidates.filter(candidate => {
        const candidateRoles = Array.isArray(candidate.jobRole) ? candidate.jobRole : [candidate.jobRole];
        return candidateRoles.includes(filters.jobRole!);
      });
    }
    
    // Sort client-side by candidateId in ascending order
    candidates.sort((a, b) => {
      const getCandidateNumber = (candidateId: string) => {
        const match = candidateId.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getCandidateNumber(a.candidateId) - getCandidateNumber(b.candidateId);
    });
    
    callback(candidates);
  });
  
  return unsubscribe;
}

/**
 * Add a note to a candidate CV
 */
export async function addCandidateNote(
  candidateId: string,
  note: string,
  addedBy: string,
  addedByName: string
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const candidateRef = doc(db, 'candidateCVs', candidateId);
    const candidateDoc = await getDoc(candidateRef);
    
    if (!candidateDoc.exists()) {
      throw new Error('Candidate CV not found');
    }
    
    const currentData = candidateDoc.data();
    const existingNotes = currentData.candidateNotes || [];
    
    const newNote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      note: note.trim(),
      addedBy,
      addedByName,
      addedAt: Timestamp.now(),
    };
    
    await updateDoc(candidateRef, {
      candidateNotes: [...existingNotes, newNote],
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error adding candidate note:', error);
    throw error;
  }
}

/**
 * Delete a note from a candidate CV
 */
export async function deleteCandidateNote(
  candidateId: string,
  noteId: string
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized');
  }
  
  try {
    const candidateRef = doc(db, 'candidateCVs', candidateId);
    const candidateDoc = await getDoc(candidateRef);
    
    if (!candidateDoc.exists()) {
      throw new Error('Candidate CV not found');
    }
    
    const currentData = candidateDoc.data();
    const existingNotes = currentData.candidateNotes || [];
    const updatedNotes = existingNotes.filter((note: any) => note.id !== noteId);
    
    await updateDoc(candidateRef, {
      candidateNotes: updatedNotes,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error deleting candidate note:', error);
    throw error;
  }
}


