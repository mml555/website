"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import React from "react";

const Navigation = dynamic(() => import("../components/Navigation"), { ssr: false });

export default function ShowNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !pathname.startsWith("/admin") && !pathname.startsWith("/dashboard");
  return (
    <>
      {showNav ? <Navigation /> : null}
      {children}
    </>
  );
} 