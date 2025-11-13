"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors with AuthProvider
const ProtectedRoute = dynamic(() => import("@/components/ProtectedRoute").then(mod => ({ default: mod.ProtectedRoute })), {
  ssr: false,
});

const DashboardLayout = dynamic(() => import("@/components/DashboardLayout").then(mod => ({ default: mod.DashboardLayout })), {
  ssr: false,
});

const ComingSoon = dynamic(() => import("@/pages/ComingSoon"), {
  ssr: false,
});

export default function LeavePage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ComingSoon
          title="Leave Management"
          description="Employee leave request and approval system"
          features={[
            'Submit leave requests with date ranges',
            'Manager approval workflow',
            'Leave balance tracking',
            'Calendar integration',
            'Automatic conflict detection'
          ]}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

