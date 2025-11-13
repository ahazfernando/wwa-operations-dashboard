"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors
const Signup = dynamic(() => import("@/pages/Signup"), {
  ssr: false,
});

export default function SignupPage() {
  return <Signup />;
}

