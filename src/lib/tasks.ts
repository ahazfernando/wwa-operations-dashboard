import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, FirestoreTask, TaskStatus, StatusChange, TaskImage } from '@/types/task';

/**
 * Convert Firestore task to app Task
 */
export function convertFirestoreTask(docData: any, docId: string): Task {
  const statusHistory: StatusChange[] = docData.statusHistory
    ? docData.statusHistory.map((entry: any) => ({
        status: entry.status,
        timestamp: entry.timestamp?.toDate() || new Date(),
        changedBy: entry.changedBy,
        changedByName: entry.changedByName,
      }))
    : [];

  // Normalize images: convert strings to objects for backward compatibility
  const images: (string | TaskImage)[] = (docData.images || []).map((img: any) => {
    if (typeof img === 'string') {
      return img; // Keep as string for backward compatibility
    }
    return {
      url: img.url || '',
      description: img.description || '',
    };
  });

  return {
    id: docId,
    taskId: docData.taskId || '',
    name: docData.name || '',
    description: docData.description || '',
    date: docData.date?.toDate() || new Date(),
    status: docData.status || 'New',
    assignedMembers: docData.assignedMembers || [],
    assignedMemberNames: docData.assignedMemberNames || [],
    images,
    kpi: docData.kpi || '',
    eta: docData.eta?.toDate() || undefined,
    time: docData.time || '',
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    createdBy: docData.createdBy || '',
    createdByName: docData.createdByName || '',
    statusHistory: statusHistory.length > 0 ? statusHistory : undefined,
    recurring: docData.recurring || false,
    parentTaskId: docData.parentTaskId || undefined,
  };
}

/**
 * Create a new task
 */
export async function createTask(taskData: {
  taskId: string;
  name: string;
  description: string;
  date: Date;
  assignedMembers: string[];
  assignedMemberNames: string[];
  images: (string | TaskImage)[];
  kpi?: string;
  eta?: Date;
  time?: string;
  createdBy: string;
  createdByName: string;
  recurring?: boolean;
  parentTaskId?: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const now = Timestamp.now();
    const initialStatusHistory = [{
      status: 'New' as TaskStatus,
      timestamp: now,
      changedBy: taskData.createdBy,
      changedByName: taskData.createdByName,
    }];

    const docRef = await addDoc(collection(db, 'tasks'), {
      taskId: taskData.taskId,
      name: taskData.name,
      description: taskData.description,
      date: Timestamp.fromDate(taskData.date),
      status: 'New' as TaskStatus,
      assignedMembers: taskData.assignedMembers,
      assignedMemberNames: taskData.assignedMemberNames,
      images: taskData.images,
      kpi: taskData.kpi || '',
      eta: taskData.eta ? Timestamp.fromDate(taskData.eta) : null,
      time: taskData.time || '',
      createdAt: now,
      updatedAt: now,
      createdBy: taskData.createdBy,
      createdByName: taskData.createdByName,
      statusHistory: initialStatusHistory,
      recurring: taskData.recurring || false,
      parentTaskId: taskData.parentTaskId || null,
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating task:', error);
    throw error;
  }
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  options?: {
    changedBy?: string;
    changedByName?: string;
  }
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    // Get current task to check if status is actually changing
    const taskDoc = await getDoc(doc(db, 'tasks', taskId));
    if (!taskDoc.exists()) {
      throw new Error('Task not found');
    }

    const currentData = taskDoc.data();
    const currentStatus = currentData.status as TaskStatus;
    
    // Only track if status is actually changing
    if (currentStatus !== status) {
      const now = Timestamp.now();
      const statusChange = {
        status,
        timestamp: now,
        changedBy: options?.changedBy,
        changedByName: options?.changedByName,
      };

      // Get existing status history or initialize empty array
      const existingHistory = currentData.statusHistory || [];
      
      // Add new status change to history
      const updatedHistory = [...existingHistory, statusChange];

      await updateDoc(doc(db, 'tasks', taskId), {
        status,
        statusHistory: updatedHistory,
        updatedAt: now,
      });

      // If task is being marked as Complete and it's a recurring task, create a new instance
      if (status === 'Complete' && currentData.recurring === true) {
        try {
          // Generate a new task ID by appending a timestamp or incrementing
          const baseTaskId = currentData.taskId;
          const timestamp = Date.now();
          const newTaskId = `${baseTaskId}-${timestamp}`;
          
          // Use the original task's ID as parentTaskId (or use the existing parentTaskId if this is already a recurring instance)
          const parentId = currentData.parentTaskId || taskId;
          
          // Convert Firestore timestamp to Date if needed
          const etaDate = currentData.eta 
            ? (currentData.eta.toDate ? currentData.eta.toDate() : new Date(currentData.eta))
            : undefined;
          
          // Create new task with same scope but new ID and current date
          const newTaskData = {
            taskId: newTaskId,
            name: currentData.name,
            description: currentData.description,
            date: new Date(), // New date for the recurring task
            assignedMembers: currentData.assignedMembers,
            assignedMemberNames: currentData.assignedMemberNames || [],
            images: [], // Start with no images for the new instance
            kpi: currentData.kpi || '',
            eta: etaDate,
            time: currentData.time || '',
            createdBy: options?.changedBy || currentData.createdBy,
            createdByName: options?.changedByName || currentData.createdByName,
            recurring: true, // Keep it as recurring
            parentTaskId: parentId, // Link to the original recurring task
          };

          await createTask(newTaskData);
        } catch (error) {
          // Log error but don't fail the status update
          console.error('Error creating recurring task instance:', error);
        }
      }
    } else {
      // Status hasn't changed, just update updatedAt
      await updateDoc(doc(db, 'tasks', taskId), {
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
}

/**
 * Update task images
 */
export async function updateTaskImages(taskId: string, images: (string | TaskImage)[]): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      images,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task images:', error);
    throw error;
  }
}

/**
 * Update task details
 */
export async function updateTask(
  taskId: string,
  taskData: {
    taskId: string;
    name: string;
    description: string;
    date: Date;
    assignedMembers: string[];
    assignedMemberNames: string[];
    images: (string | TaskImage)[];
    kpi?: string;
    eta?: Date;
    time?: string;
  }
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      taskId: taskData.taskId,
      name: taskData.name,
      description: taskData.description,
      date: Timestamp.fromDate(taskData.date),
      assignedMembers: taskData.assignedMembers,
      assignedMemberNames: taskData.assignedMemberNames,
      images: taskData.images,
      kpi: taskData.kpi || '',
      eta: taskData.eta ? Timestamp.fromDate(taskData.eta) : null,
      time: taskData.time || '',
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task:', error);
    throw error;
  }
}

/**
 * Get all tasks (for admins)
 */
export async function getAllTasks(): Promise<Task[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => 
      convertFirestoreTask(doc.data(), doc.id)
    );
  } catch (error) {
    console.error('Error fetching tasks:', error);
    throw error;
  }
}

/**
 * Get tasks assigned to a specific user
 */
export async function getTasksByUser(userId: string): Promise<Task[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    // Note: Firestore doesn't support orderBy with array-contains without a composite index
    // We'll fetch all tasks and sort in memory, or create a composite index
    const q = query(
      collection(db, 'tasks'),
      where('assignedMembers', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => 
      convertFirestoreTask(doc.data(), doc.id)
    );
    
    // Sort by createdAt descending
    return tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    throw error;
  }
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(status: TaskStatus): Promise<Task[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const q = query(
      collection(db, 'tasks'),
      where('status', '==', status),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => 
      convertFirestoreTask(doc.data(), doc.id)
    );
  } catch (error: any) {
    // If composite index is missing, Firestore will throw an error
    // Fallback: fetch all tasks and filter in memory
    if (error.code === 'failed-precondition') {
      console.warn('Composite index missing. Fetching all tasks and filtering...');
      const allTasks = await getAllTasks();
      return allTasks
        .filter(task => task.status === status)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    console.error('Error fetching tasks by status:', error);
    throw error;
  }
}

/**
 * Get completed tasks (for task history)
 */
export async function getCompletedTasks(): Promise<Task[]> {
  return getTasksByStatus('Complete');
}

/**
 * Get completed tasks assigned to a specific user
 */
export async function getCompletedTasksByUser(userId: string): Promise<Task[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const q = query(
      collection(db, 'tasks'),
      where('status', '==', 'Complete'),
      where('assignedMembers', 'array-contains', userId)
    );
    const querySnapshot = await getDocs(q);
    
    const tasks = querySnapshot.docs.map(doc => 
      convertFirestoreTask(doc.data(), doc.id)
    );
    
    // Sort by updatedAt descending (most recently completed first)
    return tasks.sort((a, b) => {
      // Get the completion timestamp from status history
      const aCompleted = a.statusHistory?.find(h => h.status === 'Complete')?.timestamp || a.updatedAt;
      const bCompleted = b.statusHistory?.find(h => h.status === 'Complete')?.timestamp || b.updatedAt;
      return bCompleted.getTime() - aCompleted.getTime();
    });
  } catch (error: any) {
    // Fallback: fetch all completed tasks and filter in memory
    if (error.code === 'failed-precondition') {
      console.warn('Composite index missing. Fetching all completed tasks and filtering...');
      const allCompleted = await getCompletedTasks();
      return allCompleted
        .filter(task => task.assignedMembers.includes(userId))
        .sort((a, b) => {
          const aCompleted = a.statusHistory?.find(h => h.status === 'Complete')?.timestamp || a.updatedAt;
          const bCompleted = b.statusHistory?.find(h => h.status === 'Complete')?.timestamp || b.updatedAt;
          return bCompleted.getTime() - aCompleted.getTime();
        });
    }
    console.error('Error fetching completed user tasks:', error);
    throw error;
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

