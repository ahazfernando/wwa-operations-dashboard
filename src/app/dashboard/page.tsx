"use client";

import dynamic from 'next/dynamic';

// Wrap entire page in a single dynamic import to prevent SSR
const DashboardContent = dynamic(
  async () => {
    const [{ ProtectedRoute }, { DashboardLayout }, Dashboard] = await Promise.all([
      import("@/components/ProtectedRoute"),
      import("@/components/DashboardLayout"),
      import("@/pages/Dashboard"),
    ]);
    
    return {
      default: () => (
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard.default />
          </DashboardLayout>
        </ProtectedRoute>
      ),
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardContent />;
}

