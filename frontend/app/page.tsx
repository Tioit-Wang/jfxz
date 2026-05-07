"use client";

import dynamic from "next/dynamic";

const LandingClient = dynamic(() => import("./LandingClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background" />
});

export default function LandingPage() {
  return <LandingClient />;
}
