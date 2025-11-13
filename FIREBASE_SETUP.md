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
```

Replace the placeholder values with your actual Firebase configuration values.

## 6. Set up Firestore Security Rules

Go to **Firestore Database** > **Rules** and update the rules to:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
      
      // Admins can read/write all user data
      match /{document=**} {
        allow read, write: if request.auth != null && 
          get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
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

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)

