
import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, count = 1 }) => {
  return (
    <div className="space-y-3 animate-pulse w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`bg-gray-200 dark:bg-gray-700 rounded ${className}`} 
        />
      ))}
    </div>
  );
};
