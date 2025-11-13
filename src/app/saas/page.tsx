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

export default function SaasPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ComingSoon
          title="SaaS Monetization"
          description="Productization and monetization configuration"
          features={[
            'Subscription plan management',
            'Pricing tier configuration',
            'Usage tracking and billing',
            'Customer portal integration',
            'Revenue analytics dashboard'
          ]}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

