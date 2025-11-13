"use client";

import Setup from "@/pages/Setup";

// Force dynamic rendering to prevent SSR issues
export const dynamic = 'force-dynamic';

export default function SetupPage() {
  return <Setup />;
}

