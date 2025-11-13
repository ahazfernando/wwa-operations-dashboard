"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors
const AccountRejected = dynamic(() => import("@/pages/AccountRejected"), {
  ssr: false,
});

export default function AccountRejectedPage() {
  return <AccountRejected />;
}

