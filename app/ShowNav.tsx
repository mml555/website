"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import React from "react";

const Navigation = dynamic(() => import("../components/Navigation"), {
  ssr: true,
  loading: () => (
    <div className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  ),
});

export default function ShowNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !pathname.startsWith("/admin") && !pathname.startsWith("/dashboard");
  
  return (
    <>
      {showNav && <Navigation />}
      {children}
    </>
  );
} 