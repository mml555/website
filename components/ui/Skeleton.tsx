import React from 'react';

export default function Skeleton({ className = '', children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`bg-gray-200 rounded animate-pulse ${className}`}>{children}</div>
  );
} 