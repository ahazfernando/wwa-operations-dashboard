# Firebase Setup Guide

This project uses Firebase for authentication and user management. Follow these steps to set up Firebase for your project.

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

## 2. Enable Authentication

1. In your Firebase project, go to **Authentication** > **Get started**
2. Enable the following sign-in methods:
   - **Email/Password** (enable this)
   - **Google** (enable this for Google sign-in)
   - **GitHub** (enable this for GitHub sign-in)

## 3. Set up Firestore Database

1. Go to **Firestore Database** > **Create database**
2. Start in **test mode** (you can change security rules later)
3. Choose a location for your database

## 3.5. Set up Firebase Storage (for job contracts)

1. Go to **Storage** > **Get started**
2. Start in **test mode** (you can change security rules later)
3. Choose the same location as your Firestore database
4. This is used for uploading and storing job contracts

## 4. Get Your Firebase Configuration

1. Go to **Project Settings** (gear icon) > **General** tab
2. Scroll down to "Your apps" section
3. Click the **Web** icon (`</>`) to add a web app
4. Register your app with a nickname (e.g., "Aussie Ops Hub")
5. Copy the Firebase configuration object

## 5. Configure Environment Variables

1. Create a `.env.local` file in the root of your project
2. Add the following environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Resend API Key for email notifications
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

Replace the placeholder values with your actual Firebase configuration values.

**Note:** For Resend setup:
1. Sign up at [Resend](https://resend.com) and get your API key
2. Add your domain in Resend dashboard (or use the default `onboarding@resend.dev` for testing)
3. Set `RESEND_FROM_EMAIL` to your verified domain email (e.g., `noreply@yourdomain.com`)
4. If not set, the system will default to `onboarding@resend.dev` (for testing only)

## 6. Set up Firestore Security Rules

**⚠️ IMPORTANT**: If you started in test mode, Firebase automatically disables it after 30 days and switches to production mode with restrictive rules. This is why your app suddenly stopped working even though you didn't change anything.

### Quick Fix (Minimal Rules - Use this if you need to get working immediately)

If you just need to get your app working again quickly, use these minimal rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Allow admins to read/write all user documents
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Allow all authenticated users to read/write other collections (for now)
    // You can restrict these later based on your needs
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Full Production Rules (Recommended)

For better security, use these comprehensive rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      // Users can read their own data (even if pending approval)
      // Admins can read all user data
      allow read: if isAuthenticated() && 
        (request.auth.uid == userId || isAdmin());
      
      // Users can write their own data (for profile updates)
      // Admins can write all user data
      allow write: if isAuthenticated() && 
        (request.auth.uid == userId || isAdmin());
    }
    
    // Tasks collection
    match /tasks/{taskId} {
      // Authenticated users can read tasks
      // Users can write tasks they created or are assigned to
      // Admins and operations staff can write all tasks
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (
        resource.data.createdBy == request.auth.uid ||
        request.auth.uid in resource.data.assignedMembers ||
        isAdmin() ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operationsstaff')
      );
    }
    
    // Reminders collection
    match /reminders/{reminderId} {
      // Users can read reminders assigned to them
      // Users can create reminders
      // Users can update/delete reminders they created or are assigned to
      // Admins can read/write all reminders
      allow read: if isAuthenticated() && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid in resource.data.get('assignedMembers', []) ||
        isAdmin()
      );
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid in resource.data.get('assignedMembers', []) ||
        isAdmin()
      );
    }
    
    // Recruitment Leads collection
    match /recruitmentLeads/{leadId} {
      // Authenticated users can read leads
      // Users can create leads
      // Users can update leads they created or are assigned to
      // Admins and operations staff can write all leads
      // IT team members with permissions can read/write based on permissions
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (
        resource.data.createdBy == request.auth.uid ||
        resource.data.assignedTo == request.auth.uid ||
        isAdmin() ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operationsstaff') ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.permissions.leadTracking != null)
      );
    }
  }
}
```

## 7. Configure OAuth Providers (Optional)

### Google OAuth Setup
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Click on **Google** and enable it
3. Add your project's support email
4. Save the changes

### GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Your app name
   - **Homepage URL**: Your app URL
   - **Authorization callback URL**: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
4. Copy the **Client ID** and **Client Secret**
5. In Firebase Console, go to **Authentication** > **Sign-in method**
6. Click on **GitHub** and enable it
7. Paste the Client ID and Client Secret
8. Save the changes

## 8. User Roles

The application supports three user roles:
- **admin**: Full access to all features
- **operationsstaff**: Access to operations-related features
- **itteam**: Limited access (default for new users)

New users are automatically assigned the `itteam` role. Admins can update user roles in the Firestore `users` collection.

## 9. Test Your Setup

1. Start your development server: `npm run dev`
2. Navigate to the signup page
3. Create a test account
4. Check Firestore to see if the user document was created
5. Try logging in with the credentials

## Troubleshooting

- **"Firebase: Error (auth/configuration-not-found)"**: Make sure all environment variables are set correctly in `.env.local`
- **"Firebase: Error (auth/unauthorized-domain)"**: Add your domain to Firebase Console > Authentication > Settings > Authorized domains
- **"Firebase: Error (auth/popup-blocked)"**: Check if popups are blocked in your browser
- **"Firebase: Error (auth/popup-closed-by-user)"**: User closed the popup window
- **"Missing or insufficient permissions" when logging in (suddenly stopped working)**: 
  - **Most common cause**: Firebase automatically moved your database from test mode to production mode after 30 days. Test mode allows all reads/writes, but production mode requires proper security rules.
  - **Quick fix**: Go to Firebase Console > Firestore Database > Rules and paste the rules from section 6 above, then click "Publish"
  - **Why it happened**: You didn't change anything - Firebase automatically enforces security rules after the test period expires
  - The rules must allow users to read their own document in the `users` collection, even if their status is "pending", otherwise login will fail

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)

