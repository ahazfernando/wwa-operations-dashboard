export type TaskStatus = 'New' | 'Progress' | 'Complete';

export interface StatusChange {
  status: TaskStatus;
  timestamp: Date;
  changedBy?: string; // User ID who changed the status
  changedByName?: string; // User name for display
}

export interface TaskImage {
  url: string;
  description?: string;
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
  expectedKpi?: string; // Expected Key Performance Indicator
  actualKpi?: string; // Actual Key Performance Indicator
  eta?: Date; // Estimated Time of Arrival / Estimated Completion Date
  time?: string; // Task time (HH:MM format)
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID who created the task
  createdByName?: string; // Admin name for display
  statusHistory?: StatusChange[]; // History of status changes
  recurring?: boolean; // Whether this task should recur when completed
  recurringFrequency?: string[]; // Array of day names (Monday, Tuesday, etc.) or ['all'] for all days
  parentTaskId?: string; // ID of the original recurring task (for tracking recurring instances)
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
  expectedKpi?: string;
  actualKpi?: string;
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
  parentTaskId?: string;
}

