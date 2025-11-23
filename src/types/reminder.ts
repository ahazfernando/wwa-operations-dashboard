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
}

