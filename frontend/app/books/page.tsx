"use client";

import dynamic from "next/dynamic";

const BooksClient = dynamic(() => import("./BooksClient"), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background" />
});

export default function BooksPage() {
  return <BooksClient />;
}
