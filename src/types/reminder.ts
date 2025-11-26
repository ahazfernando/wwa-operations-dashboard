export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  completed: boolean;
  completedAt?: Date;
  userId: string; // User who owns this reminder
  createdAt: Date;
  updatedAt: Date;
  priority?: 'low' | 'medium' | 'high';
  images?: string[]; // Array of image URLs
  assignedMembers?: string[]; // Array of user IDs who are assigned to this reminder
  assignedMemberNames?: string[]; // Array of user names for display
}

export interface FirestoreReminder {
  id: string;
  title: string;
  description?: string;
  dueDate: any; // Firestore Timestamp
  completed: boolean;
  completedAt?: any; // Firestore Timestamp
  userId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  priority?: 'low' | 'medium' | 'high';
  images?: string[]; // Array of image URLs
  assignedMembers?: string[]; // Array of user IDs who are assigned to this reminder
  assignedMemberNames?: string[]; // Array of user names for display
}

