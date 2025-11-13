"use client";

import dynamic from 'next/dynamic';

// Dynamically import with SSR disabled to prevent build-time errors
const Login = dynamic(() => import("@/pages/Login"), {
  ssr: false,
});

export default function LoginPage() {
  return <Login />;
}

