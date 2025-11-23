export type TaskStatus = 'New' | 'Progress' | 'Complete';

export interface StatusChange {
  status: TaskStatus;
  timestamp: Date;
  changedBy?: string; // User ID who changed the status
  changedByName?: string; // User name for display
}

export interface CompletedBy {
  userId: string;
  userName: string;
  completedAt: Date;
}

export interface TaskImage {
  url: string;
  description?: string;
}

export interface TaskFile {
  url: string;
  name: string;
  description?: string;
}

export interface Subtask {
  id: string; // Unique ID for the subtask
  description: string;
  addedAt: Date; // Time when subtask was added
  completed: boolean; // Whether the subtask is completed
  completedAt?: Date; // Time when subtask was completed (if completed)
  images?: (string | TaskImage)[]; // Array of Cloudinary image URLs or objects with url and description
  files?: (string | TaskFile)[]; // Array of Cloudinary file URLs or objects with url, name and description
}

export interface Task {
  id: string;
  taskId: string; // User-defined task ID
  name: string;
  description: string;
  date: Date;
  status: TaskStatus;
  assignedMembers: string[]; // Array of user IDs
  assignedMemberNames?: string[]; // Array of user names for display
  images: (string | TaskImage)[]; // Array of Cloudinary image URLs or objects with url and description
  files?: (string | TaskFile)[]; // Array of Cloudinary file URLs or objects with url, name and description
  expectedKpi?: number; // Expected Key Performance Indicator
  actualKpi?: number; // Actual Key Performance Indicator
  eta?: Date; // Estimated Time of Arrival / Estimated Completion Date
  time?: string; // Task time (HH:MM format)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID who created the task
  createdByName?: string; // Admin name for display
  statusHistory?: StatusChange[]; // History of status changes
  recurring?: boolean; // Whether this task should recur when completed
  recurringFrequency?: string[]; // Array of day names (Monday, Tuesday, etc.) or ['all'] for all days
  recurringStartDate?: Date; // Start date for recurring task
  recurringEndDate?: Date; // End date for recurring task
  parentTaskId?: string; // ID of the original recurring task (for tracking recurring instances)
  collaborative?: boolean; // Whether this is a collaborative task requiring all members to complete
  completedBy?: CompletedBy[]; // Array of users who have completed this collaborative task
  subtasks?: Subtask[]; // Array of subtasks
}

export interface FirestoreTask {
  id: string;
  taskId: string;
  name: string;
  description: string;
  date: any; // Firestore Timestamp
  status: TaskStatus;
  assignedMembers: string[];
  assignedMemberNames?: string[];
  images: (string | { url: string; description?: string })[];
  files?: (string | { url: string; name: string; description?: string })[];
  expectedKpi?: number;
  actualKpi?: number;
  eta?: any; // Firestore Timestamp
  time?: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
  createdByName?: string;
  statusHistory?: Array<{
    status: TaskStatus;
    timestamp: any; // Firestore Timestamp
    changedBy?: string;
    changedByName?: string;
  }>;
  recurring?: boolean;
  recurringFrequency?: string[]; // Array of day names or ['all'] for all days
  recurringStartDate?: any; // Firestore Timestamp
  recurringEndDate?: any; // Firestore Timestamp
  parentTaskId?: string;
  collaborative?: boolean;
  completedBy?: Array<{
    userId: string;
    userName: string;
    completedAt: any; // Firestore Timestamp
  }>;
  subtasks?: Array<{
    id: string;
    description: string;
    addedAt: any; // Firestore Timestamp
    completed: boolean;
    completedAt?: any; // Firestore Timestamp
    images?: (string | { url: string; description?: string })[];
    files?: (string | { url: string; name: string; description?: string })[];
  }>;
}

