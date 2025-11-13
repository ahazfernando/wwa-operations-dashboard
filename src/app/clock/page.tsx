"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors with AuthProvider
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute").then(mod => ({ default: mod.ProtectedRoute })), {
  ssr: false,
});

const DashboardLayout = dynamic(() => import("@/components/DashboardLayout").then(mod => ({ default: mod.DashboardLayout })), {
  ssr: false,
});

const Clock = dynamic(() => import("@/pages/Clock"), {
  ssr: false,
});

export default function ClockPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Clock />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

