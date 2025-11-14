"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardContent />;
}

