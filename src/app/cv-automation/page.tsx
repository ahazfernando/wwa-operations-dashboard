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

export default function CvAutomationPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <ComingSoon
          title="CV Creation Automation"
          description="Automated CV/resume generation system"
          features={[
            'Template-based CV generation',
            'Employee data integration',
            'Multiple format exports (PDF, DOCX)',
            'Custom branding options',
            'Bulk generation capabilities'
          ]}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}

