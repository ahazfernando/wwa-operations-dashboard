import { collection, addDoc, updateDoc, doc, getDocs, query, where, Timestamp, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Reminder, FirestoreReminder } from '@/types/reminder';

/**
 * Convert Firestore reminder to app Reminder
 */
export function convertFirestoreReminder(docData: any, docId: string): Reminder {
  return {
    id: docId,
    title: docData.title || '',
    description: docData.description || undefined,
    dueDate: docData.dueDate?.toDate() || new Date(),
    completed: docData.completed || false,
    completedAt: docData.completedAt?.toDate() || undefined,
    userId: docData.userId || '',
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    priority: docData.priority || 'medium',
    images: docData.images || undefined,
    assignedMembers: docData.assignedMembers || undefined,
    assignedMemberNames: docData.assignedMemberNames || undefined,
  };
}

/**
 * Create a new reminder
 */
export async function createReminder(reminderData: {
  title: string;
  description?: string;
  dueDate: Date;
  userId: string;
  priority?: 'low' | 'medium' | 'high';
  images?: string[];
  assignedMembers?: string[];
  assignedMemberNames?: string[];
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'reminders'), {
      title: reminderData.title,
      description: reminderData.description || null,
      dueDate: Timestamp.fromDate(reminderData.dueDate),
      completed: false,
      completedAt: null,
      userId: reminderData.userId,
      createdAt: now,
      updatedAt: now,
      priority: reminderData.priority || 'medium',
      images: reminderData.images || null,
      assignedMembers: reminderData.assignedMembers || null,
      assignedMemberNames: reminderData.assignedMemberNames || null,
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating reminder:', error);
    throw error;
  }
}

/**
 * Update a reminder
 */
export async function updateReminder(
  reminderId: string,
  updates: {
    title?: string;
    description?: string;
    dueDate?: Date;
    completed?: boolean;
    priority?: 'low' | 'medium' | 'high';
    images?: string[];
    assignedMembers?: string[];
    assignedMemberNames?: string[];
  }
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.dueDate !== undefined) updateData.dueDate = Timestamp.fromDate(updates.dueDate);
    if (updates.completed !== undefined) {
      updateData.completed = updates.completed;
      if (updates.completed) {
        updateData.completedAt = serverTimestamp();
      } else {
        updateData.completedAt = null;
      }
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.images !== undefined) updateData.images = updates.images.length > 0 ? updates.images : null;
    if (updates.assignedMembers !== undefined) updateData.assignedMembers = updates.assignedMembers.length > 0 ? updates.assignedMembers : null;
    if (updates.assignedMemberNames !== undefined) updateData.assignedMemberNames = updates.assignedMemberNames.length > 0 ? updates.assignedMemberNames : null;

    await updateDoc(doc(db, 'reminders', reminderId), updateData);
  } catch (error) {
    console.error('Error updating reminder:', error);
    throw error;
  }
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    await deleteDoc(doc(db, 'reminders', reminderId));
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
}

/**
 * Get all reminders for a specific user (owned by user or assigned to user)
 */
export async function getRemindersByUser(userId: string): Promise<Reminder[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    // Get reminders owned by the user
    const ownedQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', userId)
    );
    const ownedSnapshot = await getDocs(ownedQuery);
    
    // Get reminders where user is in assignedMembers
    // Note: Firestore doesn't support array-contains with multiple queries easily,
    // so we'll fetch all reminders and filter in memory
    const allRemindersQuery = query(collection(db, 'reminders'));
    const allRemindersSnapshot = await getDocs(allRemindersQuery);
    
    const allReminders = allRemindersSnapshot.docs.map(doc => 
      convertFirestoreReminder(doc.data(), doc.id)
    );
    
    // Filter reminders where user is assigned
    const assignedReminders = allReminders.filter(reminder => 
      reminder.assignedMembers?.includes(userId)
    );
    
    // Combine owned and assigned reminders, removing duplicates
    const ownedReminders = ownedSnapshot.docs.map(doc => 
      convertFirestoreReminder(doc.data(), doc.id)
    );
    
    const reminderMap = new Map<string, Reminder>();
    [...ownedReminders, ...assignedReminders].forEach(reminder => {
      reminderMap.set(reminder.id, reminder);
    });
    
    const reminders = Array.from(reminderMap.values());
    
    // Sort by dueDate in memory
    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  } catch (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
}

/**
 * Get a single reminder by ID
 */
export async function getReminderById(reminderId: string): Promise<Reminder | null> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const docSnapshot = await getDoc(doc(db, 'reminders', reminderId));
    if (docSnapshot.exists()) {
      return convertFirestoreReminder(docSnapshot.data(), docSnapshot.id);
    }
    return null;
  } catch (error) {
    console.error('Error fetching reminder:', error);
    throw error;
  }
}

