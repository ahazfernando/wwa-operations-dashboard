export type NotificationType = 'lead_assigned' | 'reminder_assigned' | 'task_assigned' | 'general';

export interface Notification {
  id: string;
  userId: string; // User who receives the notification
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: Date;
  relatedId?: string; // ID of related entity (lead ID, reminder ID, etc.)
  relatedType?: string; // Type of related entity ('lead', 'reminder', 'task', etc.)
  createdAt: Date;
  createdBy?: string;
  createdByName?: string;
}

export interface FirestoreNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt?: any; // Firestore Timestamp
  relatedId?: string;
  relatedType?: string;
  createdAt: any; // Firestore Timestamp
  createdBy?: string;
  createdByName?: string;
}

