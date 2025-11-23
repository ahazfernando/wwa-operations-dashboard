import { collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Task, FirestoreTask, TaskStatus, StatusChange, TaskImage, TaskFile, CompletedBy, Subtask } from '@/types/task';

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

  // Normalize files: convert strings to objects for backward compatibility
  const files: (string | TaskFile)[] = (docData.files || []).map((file: any) => {
    if (typeof file === 'string') {
      return file; // Keep as string for backward compatibility
    }
    return {
      url: file.url || '',
      name: file.name || '',
      description: file.description || '',
    };
  });

  // Normalize completedBy: convert Firestore timestamps to Dates
  const completedBy: CompletedBy[] = (docData.completedBy || []).map((entry: any) => ({
    userId: entry.userId || '',
    userName: entry.userName || '',
    completedAt: entry.completedAt?.toDate() || new Date(),
  }));

  // Normalize subtasks: convert Firestore timestamps to Dates
  const subtasks: Subtask[] = (docData.subtasks || []).map((subtask: any) => {
    // Normalize subtask images
    const subtaskImages: (string | TaskImage)[] = (subtask.images || []).map((img: any) => {
      if (typeof img === 'string') {
        return img;
      }
      return {
        url: img.url || '',
        description: img.description || '',
      };
    });

    // Normalize subtask files
    const subtaskFiles: (string | TaskFile)[] = (subtask.files || []).map((file: any) => {
      if (typeof file === 'string') {
        return file;
      }
      return {
        url: file.url || '',
        name: file.name || '',
        description: file.description || '',
      };
    });

    return {
      id: subtask.id || '',
      description: subtask.description || '',
      addedAt: subtask.addedAt?.toDate() || new Date(),
      completed: subtask.completed || false,
      completedAt: subtask.completedAt?.toDate() || undefined,
      images: subtaskImages.length > 0 ? subtaskImages : undefined,
      files: subtaskFiles.length > 0 ? subtaskFiles : undefined,
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
    files: files.length > 0 ? files : undefined,
    expectedKpi: docData.expectedKpi !== undefined && docData.expectedKpi !== null && docData.expectedKpi !== '' 
      ? (typeof docData.expectedKpi === 'number' ? docData.expectedKpi : parseFloat(docData.expectedKpi)) 
      : undefined,
    actualKpi: docData.actualKpi !== undefined && docData.actualKpi !== null && docData.actualKpi !== '' 
      ? (typeof docData.actualKpi === 'number' ? docData.actualKpi : parseFloat(docData.actualKpi)) 
      : undefined,
    eta: docData.eta?.toDate() || undefined,
    time: docData.time || '',
    createdAt: docData.createdAt?.toDate() || new Date(),
    updatedAt: docData.updatedAt?.toDate() || new Date(),
    createdBy: docData.createdBy || '',
    createdByName: docData.createdByName || '',
    statusHistory: statusHistory.length > 0 ? statusHistory : undefined,
    recurring: docData.recurring || false,
    recurringFrequency: docData.recurringFrequency || undefined,
    recurringStartDate: docData.recurringStartDate?.toDate() || undefined,
    recurringEndDate: docData.recurringEndDate?.toDate() || undefined,
    parentTaskId: docData.parentTaskId || undefined,
    collaborative: docData.collaborative || false,
    completedBy: completedBy.length > 0 ? completedBy : undefined,
    subtasks: subtasks.length > 0 ? subtasks : undefined,
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
  files?: (string | TaskFile)[];
  expectedKpi?: number;
  actualKpi?: number;
  eta?: Date;
  time?: string;
  createdBy: string;
  createdByName: string;
  recurring?: boolean;
  recurringFrequency?: string[];
  recurringStartDate?: Date;
  recurringEndDate?: Date;
  parentTaskId?: string;
  collaborative?: boolean;
  subtasks?: Subtask[];
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

    const sanitizedImages = sanitizeImages(taskData.images);
    const sanitizedFiles = taskData.files ? sanitizeFiles(taskData.files) : null;
    const docRef = await addDoc(collection(db, 'tasks'), {
      taskId: taskData.taskId,
      name: taskData.name,
      description: taskData.description,
      date: Timestamp.fromDate(taskData.date),
      status: 'New' as TaskStatus,
      assignedMembers: taskData.assignedMembers,
      assignedMemberNames: taskData.assignedMemberNames,
      images: sanitizedImages,
      files: sanitizedFiles,
      expectedKpi: taskData.expectedKpi ?? null,
      actualKpi: taskData.actualKpi ?? null,
      eta: taskData.eta ? Timestamp.fromDate(taskData.eta) : null,
      time: taskData.time || '',
      createdAt: now,
      updatedAt: now,
      createdBy: taskData.createdBy,
      createdByName: taskData.createdByName,
      statusHistory: initialStatusHistory,
      recurring: taskData.recurring || false,
      recurringFrequency: taskData.recurringFrequency || null,
      recurringStartDate: taskData.recurringStartDate ? Timestamp.fromDate(taskData.recurringStartDate) : null,
      recurringEndDate: taskData.recurringEndDate ? Timestamp.fromDate(taskData.recurringEndDate) : null,
      parentTaskId: taskData.parentTaskId || null,
      collaborative: taskData.collaborative || false,
      completedBy: [],
      subtasks: taskData.subtasks ? taskData.subtasks.map(subtask => {
        const sanitizedSubtaskImages = subtask.images ? sanitizeImages(subtask.images) : null;
        const sanitizedSubtaskFiles = subtask.files ? sanitizeFiles(subtask.files) : null;
        return {
          id: subtask.id,
          description: subtask.description,
          addedAt: Timestamp.fromDate(subtask.addedAt),
          completed: subtask.completed,
          completedAt: subtask.completedAt ? Timestamp.fromDate(subtask.completedAt) : null,
          images: sanitizedSubtaskImages,
          files: sanitizedSubtaskFiles,
        };
      }) : [],
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
    const isCollaborative = currentData.collaborative === true;
    const assignedMembers = currentData.assignedMembers || [];
    const completedBy = currentData.completedBy || [];
    const actualKpi = currentData.actualKpi;
    const expectedKpi = currentData.expectedKpi;
    
    // Validate KPI only if Expected KPI is set
    // (Skip this check for collaborative tasks as they have their own completion logic)
    if (status === 'Complete' && !isCollaborative) {
      // Only validate KPI if Expected KPI is set
      if (expectedKpi !== undefined && expectedKpi !== null) {
        // If Expected KPI is set, Actual KPI must be set and must match
        if (actualKpi === undefined || actualKpi === null) {
          throw new Error('Cannot complete task: Actual KPI must be filled before completing the task');
        }
        if (actualKpi !== expectedKpi) {
          throw new Error('Expected KPI has not been met');
        }
      }
      // If Expected KPI is not set, task can be completed without KPI validation
    }
    
    // Handle collaborative task completion logic
    if (isCollaborative && status === 'Complete' && options?.changedBy) {
      const userId = options.changedBy;
      const userName = options.changedByName || 'Unknown';
      
      // Check if user has already completed this task
      const alreadyCompleted = completedBy.some((entry: any) => entry.userId === userId);
      
      if (!alreadyCompleted) {
        // Add user to completedBy array
        const now = Timestamp.now();
        const newCompletedBy = [
          ...completedBy,
          {
            userId,
            userName,
            completedAt: now,
          }
        ];
        
        // Check if all assigned members have completed
        const allCompleted = assignedMembers.every((memberId: string) =>
          newCompletedBy.some((entry: any) => entry.userId === memberId)
        );
        
        // Get existing status history or initialize empty array
        const existingHistory = currentData.statusHistory || [];
        
        // Add status history entry showing user completed
        const completionStatusChange = {
          status: 'Progress' as TaskStatus,
          timestamp: now,
          changedBy: userId,
          changedByName: `${userName} completed their part`,
        };
        
        const updatedHistory = [...existingHistory, completionStatusChange];
        
        // If all members completed, check KPI validation only if Expected KPI is set
        if (allCompleted) {
          const expectedKpi = currentData.expectedKpi;
          // Only validate KPI if Expected KPI is set
          if (expectedKpi !== undefined && expectedKpi !== null) {
            // If Expected KPI is set, Actual KPI must be set and must match
            if (actualKpi === undefined || actualKpi === null) {
              // Keep as Progress if actualKpi is not filled
              await updateDoc(doc(db, 'tasks', taskId), {
                status: 'Progress' as TaskStatus,
                completedBy: newCompletedBy,
                statusHistory: updatedHistory,
                updatedAt: now,
              });
              throw new Error('Cannot complete task: Actual KPI must be filled before completing the task');
            }
            // Validate that actualKpi equals expectedKpi
            if (actualKpi !== expectedKpi) {
              // Keep as Progress if KPI doesn't match
              await updateDoc(doc(db, 'tasks', taskId), {
                status: 'Progress' as TaskStatus,
                completedBy: newCompletedBy,
                statusHistory: updatedHistory,
                updatedAt: now,
              });
              throw new Error('Expected KPI has not been met');
            }
          }
          // If Expected KPI is not set, task can be completed without KPI validation
          
          const finalStatusChange = {
            status: 'Complete' as TaskStatus,
            timestamp: now,
            changedBy: userId,
            changedByName: `${userName} - All members completed`,
          };
          updatedHistory.push(finalStatusChange);
          
          await updateDoc(doc(db, 'tasks', taskId), {
            status: 'Complete' as TaskStatus,
            completedBy: newCompletedBy,
            statusHistory: updatedHistory,
            updatedAt: now,
          });
        } else {
          // Not all completed, keep as Progress
          await updateDoc(doc(db, 'tasks', taskId), {
            status: 'Progress' as TaskStatus,
            completedBy: newCompletedBy,
            statusHistory: updatedHistory,
            updatedAt: now,
          });
        }
        
        return; // Exit early, we've handled the collaborative completion
      } else {
        // User already completed, don't do anything
        return;
      }
    }
    
    // Only track if status is actually changing (for non-collaborative or non-complete status changes)
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
          
          const recurringStartDate = currentData.recurringStartDate
            ? (currentData.recurringStartDate.toDate ? currentData.recurringStartDate.toDate() : new Date(currentData.recurringStartDate))
            : undefined;
          
          const recurringEndDate = currentData.recurringEndDate
            ? (currentData.recurringEndDate.toDate ? currentData.recurringEndDate.toDate() : new Date(currentData.recurringEndDate))
            : undefined;
          
          // Reset subtasks completion status when creating recurring instance
          const recurringSubtasks = currentData.subtasks ? currentData.subtasks.map((subtask: any) => {
            const subtaskAddedAt = subtask.addedAt?.toDate ? subtask.addedAt.toDate() : new Date(subtask.addedAt);
            // Preserve images and files but reset completion
            const subtaskImages = subtask.images || [];
            const subtaskFiles = subtask.files || [];
            return {
              id: `${subtask.id}-${Date.now()}`,
              description: subtask.description || '',
              addedAt: new Date(), // Reset to current date
              completed: false, // Reset completion status
              completedAt: undefined, // Clear completion time
              images: subtaskImages.length > 0 ? subtaskImages : undefined,
              files: subtaskFiles.length > 0 ? subtaskFiles : undefined,
            };
          }) : [];

          // Create new task with same scope but new ID and current date
          const newTaskData = {
            taskId: newTaskId,
            name: currentData.name,
            description: currentData.description,
            date: new Date(), // New date for the recurring task
            assignedMembers: currentData.assignedMembers,
            assignedMemberNames: currentData.assignedMemberNames || [],
            images: [], // Start with no images for the new instance
            expectedKpi: currentData.expectedKpi,
            actualKpi: currentData.actualKpi,
            eta: etaDate,
            time: currentData.time || '',
            createdBy: options?.changedBy || currentData.createdBy,
            createdByName: options?.changedByName || currentData.createdByName,
            recurring: true, // Keep it as recurring
            recurringFrequency: currentData.recurringFrequency || undefined,
            recurringStartDate: recurringStartDate,
            recurringEndDate: recurringEndDate,
            parentTaskId: parentId, // Link to the original recurring task
            collaborative: currentData.collaborative || false,
            subtasks: recurringSubtasks,
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
 * Sanitize images array to remove undefined values (Firebase doesn't allow undefined)
 */
function sanitizeImages(images: (string | TaskImage)[]): (string | TaskImage)[] {
  return images.map(img => {
    if (typeof img === 'string') {
      return img;
    }
    // Remove undefined description field
    const sanitized: TaskImage = { url: img.url };
    if (img.description !== undefined && img.description !== null && img.description !== '') {
      sanitized.description = img.description;
    }
    return sanitized;
  });
}

/**
 * Sanitize files array to remove undefined values (Firebase doesn't allow undefined)
 */
function sanitizeFiles(files: (string | TaskFile)[]): (string | TaskFile)[] {
  return files.map(file => {
    if (typeof file === 'string') {
      return file;
    }
    // Remove undefined description field
    const sanitized: TaskFile = { url: file.url, name: file.name };
    if (file.description !== undefined && file.description !== null && file.description !== '') {
      sanitized.description = file.description;
    }
    return sanitized;
  });
}

/**
 * Update task images
 */
export async function updateTaskImages(taskId: string, images: (string | TaskImage)[]): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const sanitizedImages = sanitizeImages(images);
    await updateDoc(doc(db, 'tasks', taskId), {
      images: sanitizedImages,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task images:', error);
    throw error;
  }
}

/**
 * Update task files
 */
export async function updateTaskFiles(taskId: string, files: (string | TaskFile)[]): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const sanitizedFiles = sanitizeFiles(files);
    await updateDoc(doc(db, 'tasks', taskId), {
      files: sanitizedFiles,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task files:', error);
    throw error;
  }
}

/**
 * Update task subtasks
 */
export async function updateTaskSubtasks(taskId: string, subtasks: Subtask[]): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const subtasksData = subtasks.map(subtask => {
      const sanitizedSubtaskImages = subtask.images ? sanitizeImages(subtask.images) : null;
      const sanitizedSubtaskFiles = subtask.files ? sanitizeFiles(subtask.files) : null;
      return {
        id: subtask.id,
        description: subtask.description,
        addedAt: Timestamp.fromDate(subtask.addedAt),
        completed: subtask.completed,
        completedAt: subtask.completedAt ? Timestamp.fromDate(subtask.completedAt) : null,
        images: sanitizedSubtaskImages,
        files: sanitizedSubtaskFiles,
      };
    });
    await updateDoc(doc(db, 'tasks', taskId), {
      subtasks: subtasksData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating task subtasks:', error);
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
    files?: (string | TaskFile)[];
    expectedKpi?: number;
    actualKpi?: number;
    eta?: Date;
    time?: string;
    subtasks?: Subtask[];
  }
): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }
  try {
    const sanitizedImages = sanitizeImages(taskData.images);
    const updateData: any = {
      taskId: taskData.taskId,
      name: taskData.name,
      description: taskData.description,
      date: Timestamp.fromDate(taskData.date),
      assignedMembers: taskData.assignedMembers,
      assignedMemberNames: taskData.assignedMemberNames,
      images: sanitizedImages,
      expectedKpi: taskData.expectedKpi ?? null,
      actualKpi: taskData.actualKpi ?? null,
      eta: taskData.eta ? Timestamp.fromDate(taskData.eta) : null,
      time: taskData.time || '',
      updatedAt: Timestamp.now(),
    };
    
    if (taskData.files !== undefined) {
      const sanitizedFiles = sanitizeFiles(taskData.files);
      updateData.files = sanitizedFiles;
    }
    
    if (taskData.subtasks !== undefined) {
      updateData.subtasks = taskData.subtasks.map(subtask => {
        const sanitizedSubtaskImages = subtask.images ? sanitizeImages(subtask.images) : null;
        const sanitizedSubtaskFiles = subtask.files ? sanitizeFiles(subtask.files) : null;
        return {
          id: subtask.id,
          description: subtask.description,
          addedAt: Timestamp.fromDate(subtask.addedAt),
          completed: subtask.completed,
          completedAt: subtask.completedAt ? Timestamp.fromDate(subtask.completedAt) : null,
          images: sanitizedSubtaskImages,
          files: sanitizedSubtaskFiles,
        };
      });
    }
    
    await updateDoc(doc(db, 'tasks', taskId), updateData);
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

