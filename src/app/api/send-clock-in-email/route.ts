import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userName, userEmail, clockInTime } = body;

    if (!userName || !userEmail || !clockInTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Initialize Resend only when needed and after checking for API key
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Format the clock-in time
    const clockInDate = new Date(clockInTime);
    const formattedTime = clockInDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Get the admin email from the request body
    const adminEmail = body.adminEmail;

    if (!adminEmail) {
      return NextResponse.json(
        { error: 'Admin email is required' },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: adminEmail,
      subject: `User Clock-In Notification: ${userName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Clock-In Notification</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="color: #2c3e50; margin-top: 0;">User Clock-In Notification</h2>
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
              <p style="font-size: 16px; margin-bottom: 10px;">
                <strong>${userName}</strong> has clocked in.
              </p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>User:</strong> ${userName}</p>
                <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin: 5px 0;"><strong>Clock-In Time:</strong> ${formattedTime}</p>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                This is an automated notification from the Operations Dashboard.
              </p>
            </div>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;">
              <p>Operations Dashboard - Clock-In Notification System</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

