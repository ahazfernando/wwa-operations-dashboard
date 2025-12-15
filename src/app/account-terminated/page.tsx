"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors
const AccountTerminated = dynamic(() => import("@/pages/AccountTerminated"), {
  ssr: false,
});

export default function AccountTerminatedPage() {
  return <AccountTerminated />;
}

