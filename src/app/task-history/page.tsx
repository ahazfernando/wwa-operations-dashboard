"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors with AuthProvider
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute").then(mod => ({ default: mod.ProtectedRoute })), {
  ssr: false,
});

const DashboardLayout = dynamic(() => import("@/components/DashboardLayout").then(mod => ({ default: mod.DashboardLayout })), {
  ssr: false,
});

const TaskHistory = dynamic(() => import("@/pages/TaskHistory"), {
  ssr: false,
});

export default function TaskHistoryPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <TaskHistory />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

