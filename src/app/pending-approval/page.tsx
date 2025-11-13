"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors
const PendingApproval = dynamic(() => import("@/pages/PendingApproval"), {
  ssr: false,
});

export default function PendingApprovalPage() {
  return <PendingApproval />;
}

