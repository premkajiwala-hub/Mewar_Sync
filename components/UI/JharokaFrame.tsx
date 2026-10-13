
import React from 'react';

interface JharokaFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Traditional Mewari Arched Window (Jharoka) component
 */
export const JharokaFrame: React.FC<JharokaFrameProps> = ({ children, className = "" }) => {
  return (
    <div className={`relative jharoka-frame aspect-[4/5] bg-white group overflow-hidden ${className}`}>
      {children}
      <div className="absolute inset-0 pointer-events-none border-[12px] border-amber-600/10 mix-blend-overlay"></div>
    </div>
  );
};
