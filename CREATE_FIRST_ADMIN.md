# Creating the First Admin User

## Method 1: Automatic Setup (Recommended) ⚡

The easiest way to create your first admin is through the built-in setup page:

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to the setup page**:
   - Go to `http://localhost:3000/setup` (or your dev server URL)
   - Fill in the form with your admin details
   - Click "Create Admin Account"

3. **That's it!** The admin account will be created automatically with:
   - Status: `approved`
   - Role: `admin`
   - Full access to the system

The setup page will only work if no admin user exists yet. Once an admin is created, this page will show an error if you try to use it again.

---

## Method 2: Manual Setup via Firebase Console

If you prefer to create the admin manually, here are the steps:

### Option A: Sign up and manually approve

1. **Sign up through the app**:
   - Go to `/signup` in your application
   - Create an account with your admin email and password
   - You'll be redirected to the pending approval page

2. **Go to Firebase Console**:
   - Open [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `we-will-australia-ops`
   - Go to **Firestore Database**

3. **Find your user document**:
   - In the `users` collection, find the document with your email
   - Click on the document to edit it

4. **Update the user document**:
   - Change `status` from `"pending"` to `"approved"`
   - Change `role` from `"itteam"` to `"admin"`
   - Save the changes

5. **Log in again**:
   - Go back to your app and log in
   - You should now have admin access
   - Go to Settings to approve other users

### Option B: Create Admin Directly in Firebase Console

1. **Create user in Firebase Authentication**:
   - Go to Firebase Console → **Authentication** → **Users**
   - Click **Add user**
   - Enter email and password
   - Click **Add user**

2. **Create user document in Firestore**:
   - Go to **Firestore Database**
   - Click **Start collection** (if no collections exist)
   - Collection ID: `users`
   - Document ID: Use the User UID from Authentication
   - Add these fields:
     ```
     email: "admin@example.com"
     name: "Admin User"
     role: "admin"
     status: "approved"
     createdAt: [timestamp - use server timestamp]
     ```
   - Click **Save**

3. **Log in to the app**:
   - Use the email and password you created
   - You'll have admin access immediately

## Verifying Admin Access

Once set up, you should be able to:
- Access the Settings page (visible in sidebar for admins)
- See the "Pending User Approvals" section
- Approve/reject users and assign roles

