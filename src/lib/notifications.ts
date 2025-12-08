import { collection, addDoc, updateDoc, doc, getDocs, query, where, Timestamp, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification, FirestoreNotification, NotificationType } from '@/types/notification';

/**
 * Convert Firestore notification to app Notification
 */
export function convertFirestoreNotification(docData: any, docId: string): Notification {
  return {
    id: docId,
    userId: docData.userId || '',
    type: docData.type || 'general',
    title: docData.title || '',
    message: docData.message || '',
    read: docData.read || false,
    readAt: docData.readAt?.toDate() || undefined,
    relatedId: docData.relatedId || undefined,
    relatedType: docData.relatedType || undefined,
    createdAt: docData.createdAt?.toDate() || new Date(),
    createdBy: docData.createdBy || undefined,
    createdByName: docData.createdByName || undefined,
  };
}

/**
 * Create a new notification
 */
export async function createNotification(notificationData: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  createdBy?: string;
  createdByName?: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, 'notifications'), {
      userId: notificationData.userId,
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      read: false,
      readAt: null,
      relatedId: notificationData.relatedId || null,
      relatedType: notificationData.relatedType || null,
      createdAt: now,
      createdBy: notificationData.createdBy || null,
      createdByName: notificationData.createdByName || null,
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    
    const batch = snapshot.docs.map(docRef =>
      updateDoc(docRef.ref, {
        read: true,
        readAt: serverTimestamp(),
      })
    );

    await Promise.all(batch);
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Get all notifications for a specific user
 */
export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    // Fetch all notifications for the user (without orderBy to avoid index requirement)
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    // Convert and sort in memory by createdAt descending
    const notifications = snapshot.docs.map(doc => 
      convertFirestoreNotification(doc.data(), doc.id)
    );
    
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Get unread notifications count for a user
 */
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.size;
  } catch (error) {
    console.error('Error fetching unread notifications count:', error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  if (!db) {
    throw new Error('Firebase is not initialized. Please check your environment variables.');
  }

  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

