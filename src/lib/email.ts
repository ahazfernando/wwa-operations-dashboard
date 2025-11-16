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
    console.log('Attempting to send email to:', adminEmail);
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

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error('Failed to parse API response. Status:', response.status, 'Response:', text);
      return { success: false, error: `API returned status ${response.status}: ${text}` };
    }

    if (!response.ok) {
      console.error('Failed to send email - API error:', {
        status: response.status,
        statusText: response.statusText,
        data: data,
        fullResponse: JSON.stringify(data, null, 2)
      });
      return { success: false, error: data?.error || data?.details || `API error: ${response.status} ${response.statusText}` };
    }

    console.log('Email sent successfully to:', adminEmail, data);
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
  console.log('Sending clock-in emails to admins:', adminEmails);
  
  if (adminEmails.length === 0) {
    console.warn('No admin emails found to send notifications to');
    return;
  }

  // Send emails to all admins in parallel (but don't wait for all to complete)
  const emailPromises = adminEmails.map((adminEmail) =>
    sendClockInEmail({
      userName,
      userEmail,
      clockInTime,
      adminEmail,
    }).then((result) => {
      if (!result.success) {
        console.error(`Failed to send email to ${adminEmail}:`, result.error);
      }
      return result;
    }).catch((error) => {
      console.error(`Error sending email to ${adminEmail}:`, error);
      // Don't throw - we want to try sending to all admins even if one fails
      return { success: false, error: error.message };
    })
  );

  // Fire and forget - don't block the clock-in process
  Promise.all(emailPromises).then((results) => {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`Email sending complete: ${successCount} succeeded, ${failCount} failed`);
  }).catch((error) => {
    console.error('Error sending some admin emails:', error);
  });
}

