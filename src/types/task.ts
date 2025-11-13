export type TaskStatus = 'New' | 'Progress' | 'Complete';

export interface Task {
  id: string;
  taskId: string; // User-defined task ID
  name: string;
  description: string;
  date: Date;
  status: TaskStatus;
  assignedMembers: string[]; // Array of user IDs
  assignedMemberNames?: string[]; // Array of user names for display
  images: string[]; // Array of Cloudinary image URLs
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // Admin user ID who created the task
  createdByName?: string; // Admin name for display
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
  images: string[];
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
  createdByName?: string;
}

