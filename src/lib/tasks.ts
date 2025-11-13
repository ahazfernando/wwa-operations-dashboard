import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, FirestoreTask, TaskStatus } from '@/types/task';

/**
 * Convert Firestore task to app Task
 */
export function convertFirestoreTask(docData: any, docId: string): Task {
  return {
    id: docId,
    taskId: docData.taskId || '',
    name: docData.name || '',
    description: docData.description || '',
    date: docData.date?.toDate() || new Date(),
    status: docData.status || 'New',
    assignedMembers: docData.assignedMembers || [],
    assignedMemberNames: docData.assignedMemberNames || [],
    images: docData.images || [],
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    createdBy: docData.createdBy || '',
    createdByName: docData.createdByName || '',
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
  images: string[];
  createdBy: string;
  createdByName: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const docRef = await addDoc(collection(db, 'tasks'), {
      taskId: taskData.taskId,
      name: taskData.name,
      description: taskData.description,
      date: Timestamp.fromDate(taskData.date),
      status: 'New' as TaskStatus,
      assignedMembers: taskData.assignedMembers,
      assignedMemberNames: taskData.assignedMemberNames,
      images: taskData.images,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: taskData.createdBy,
      createdByName: taskData.createdByName,
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
export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    await updateDoc(doc(db, 'tasks', taskId), {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    throw error;
  }
}

/**
 * Update task images
 */
export async function updateTaskImages(taskId: string, images: string[]): Promise<void> {
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
    images: string[];
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

