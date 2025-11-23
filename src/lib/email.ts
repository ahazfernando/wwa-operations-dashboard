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
    console.log('Attempting to send email to:', adminEmail, {
      userName,
      userEmail,
      clockInTime: clockInTime instanceof Date ? clockInTime.toISOString() : clockInTime,
    });
    
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

    console.log('API Response status:', response.status, response.statusText);

    let data;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
        console.log('API Response data:', data);
      } catch (parseError: any) {
        console.error('Failed to parse JSON response:', parseError);
        const text = await response.text();
        console.error('Raw response text:', text);
        return { success: false, error: `Failed to parse response: ${parseError.message}. Status: ${response.status}` };
      }
    } else {
      const text = await response.text();
      console.error('Non-JSON response. Status:', response.status, 'Content-Type:', contentType, 'Response:', text);
      return { success: false, error: `API returned non-JSON response (${response.status}): ${text.substring(0, 200)}` };
    }

    if (!response.ok) {
      // Extract error message with better fallback handling
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      if (data) {
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (typeof data === 'object') {
          errorMessage = data.error || data.message || data.details || errorMessage;
        }
      }
      
      // Log detailed error information
      const errorDetails: any = {
        status: response.status,
        statusText: response.statusText,
        errorMessage: errorMessage,
      };
      
      if (data) {
        errorDetails.data = data;
        try {
          errorDetails.dataString = JSON.stringify(data, null, 2);
        } catch (e) {
          errorDetails.dataString = String(data);
        }
      } else {
        errorDetails.data = null;
        errorDetails.note = 'No response data received';
      }
      
      console.error('Failed to send email - Full error details:', errorDetails);
      return { success: false, error: errorMessage };
    }

    console.log('Email sent successfully to:', adminEmail, data);
    return { success: true };
  } catch (error: any) {
    console.error('Network or other error sending clock-in email:', {
      error: error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    return { success: false, error: error?.message || 'Network error: Failed to send email' };
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
        console.error(`Failed to send email to ${adminEmail}:`, result.error || 'Unknown error');
      }
      return result;
    }).catch((error) => {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      console.error(`Error sending email to ${adminEmail}:`, {
        error: errorMessage,
        errorObject: error,
        stack: error?.stack
      });
      // Don't throw - we want to try sending to all admins even if one fails
      return { success: false, error: errorMessage };
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

