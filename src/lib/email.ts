/**
 * Utility functions for sending emails via Resend API
 */

interface ClockInEmailParams {
  userName: string;
  userEmail: string;
  clockInTime: Date | string;
  adminEmail: string;
}

/**
 * Sends a clock-in notification email to an admin user
 */
export async function sendClockInEmail({
  userName,
  userEmail,
  clockInTime,
  adminEmail,
}: ClockInEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-clock-in-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userName,
        userEmail,
        clockInTime: clockInTime instanceof Date ? clockInTime.toISOString() : clockInTime,
        adminEmail,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to send email:', data);
      return { success: false, error: data.error || 'Failed to send email' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending clock-in email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Sends clock-in notification emails to all admin users
 */
export async function sendClockInEmailsToAdmins(
  userName: string,
  userEmail: string,
  clockInTime: Date | string,
  adminEmails: string[]
): Promise<void> {
  // Send emails to all admins in parallel (but don't wait for all to complete)
  const emailPromises = adminEmails.map((adminEmail) =>
    sendClockInEmail({
      userName,
      userEmail,
      clockInTime,
      adminEmail,
    }).catch((error) => {
      console.error(`Failed to send email to ${adminEmail}:`, error);
      // Don't throw - we want to try sending to all admins even if one fails
    })
  );

  // Fire and forget - don't block the clock-in process
  Promise.all(emailPromises).catch((error) => {
    console.error('Error sending some admin emails:', error);
  });
}

