# Resend Email Setup Guide

This project uses [Resend](https://resend.com) to send email notifications to admin users when someone clocks in.

## Features

- **Automatic Email Notifications**: Admin users receive email notifications when any user clocks in
- **HTML Email Templates**: Professional, formatted email notifications
- **Non-blocking**: Email sending doesn't block the clock-in process - if emails fail, clock-in still succeeds

## Setup Instructions

### 1. Create a Resend Account

1. Go to [Resend](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Operations Dashboard")
4. Copy the API key (you'll only see it once!)

### 3. Configure Your Domain (Optional but Recommended)

For production use, you should verify your own domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Follow the DNS verification steps
4. Once verified, you can use emails like `noreply@yourdomain.com`

**For Testing**: You can use the default `onboarding@resend.dev` without domain verification.

### 4. Add Environment Variables

Add these to your `.env.local` file:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**Note**: 
- If `RESEND_FROM_EMAIL` is not set, it defaults to `onboarding@resend.dev` (for testing)
- For production, use a verified domain email address

### 5. Test the Setup

1. Start your development server: `npm run dev`
2. Have a user clock in
3. Check that admin users receive email notifications
4. Check the browser console for any errors (emails are sent asynchronously and won't block clock-in)

## Email Notification Details

### When Emails Are Sent

Emails are automatically sent to all admin users when:
- A regular user clocks in via the clock-in button
- An admin clocks in another user
- An admin uses the "Clock User In/Out" dialog

### Email Content

Each email includes:
- User's name who clocked in
- User's email address
- Clock-in time (formatted with date and time)
- Professional HTML formatting

### Email Recipients

- All users with `role: 'admin'` in the Firestore `users` collection
- The admin who performs a clock-in action for another user is excluded (to avoid duplicate notifications)

## Troubleshooting

### Emails Not Sending

1. **Check API Key**: Verify `RESEND_API_KEY` is set correctly in `.env.local`
2. **Check From Email**: Ensure `RESEND_FROM_EMAIL` is a verified domain (or use `onboarding@resend.dev` for testing)
3. **Check Console**: Look for error messages in the browser console
4. **Check Resend Dashboard**: Go to Resend dashboard > Logs to see email delivery status

### Common Issues

- **"Email service not configured"**: `RESEND_API_KEY` is missing or invalid
- **"Failed to send email"**: Check Resend dashboard logs for specific error details
- **Emails going to spam**: Verify your domain in Resend and set up SPF/DKIM records

## API Route

The email functionality uses a Next.js API route at `/api/send-clock-in-email` that:
- Accepts POST requests with user and clock-in information
- Sends emails via Resend
- Returns success/error responses

## Security Notes

- The Resend API key is stored server-side only (in `.env.local`)
- Never commit `.env.local` to version control
- The API route validates all required fields before sending emails

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

