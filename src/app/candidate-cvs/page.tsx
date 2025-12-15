"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors with AuthProvider
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute").then(mod => ({ default: mod.ProtectedRoute })), {
  ssr: false,
});

const DashboardLayout = dynamic(() => import("@/components/DashboardLayout").then(mod => ({ default: mod.DashboardLayout })), {
  ssr: false,
});

const CandidateCVs = dynamic(() => import("@/pages/CandidateCVs"), {
  ssr: false,
});

export default function CandidateCVsPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <CandidateCVs />
      </DashboardLayout>
    </ProtectedRoute>
  );
}



