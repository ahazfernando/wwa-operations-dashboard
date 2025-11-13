"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors with AuthProvider
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute").then(mod => ({ default: mod.ProtectedRoute })), {
  ssr: false,
});

const DashboardLayout = dynamic(() => import("@/components/DashboardLayout").then(mod => ({ default: mod.DashboardLayout })), {
  ssr: false,
});

const Settings = dynamic(() => import("@/pages/Settings"), {
  ssr: false,
});

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Settings />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

