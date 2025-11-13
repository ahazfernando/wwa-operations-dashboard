# wwa-operations-dashboard

We Will Australia Operations Hub - A comprehensive operations management platform.

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### Installation

Follow these steps:

```sh
# Step 1: Clone the repository
git clone https://github.com/ahazfernando/wwa-operations-dashboard.git

# Step 2: Navigate to the project directory
cd wwa-operations-dashboard

# Step 3: Install the necessary dependencies
npm install

# Step 4: Set up Firebase
# Create a .env.local file in the root directory with your Firebase configuration
# See FIREBASE_SETUP.md for detailed instructions

# Step 5: Start the development server
npm run dev
```

The application will be available at `http://localhost:3000`

## Technologies

This project is built with:

- Next.js
- TypeScript
- React
- Firebase (Authentication & Firestore)
- shadcn-ui
- Tailwind CSS

## Firebase Setup

This project uses Firebase for authentication and user management. Before running the application, you need to:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password, Google, GitHub)
3. Create a Firestore database
4. Set up environment variables in `.env.local`
5. **Create your first admin**: Navigate to `/setup` in your app to automatically create the first admin account

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed setup instructions.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Deployment

Build the application and deploy to your preferred hosting platform.

```sh
npm run build
npm run start
```
