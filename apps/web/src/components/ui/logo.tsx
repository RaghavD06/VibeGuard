import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  useImage?: boolean;
}

export function VibeGuardLogo({ className = "", size = 28, useImage = false }: LogoProps) {
  if (useImage) {
    return (
      <img
        src="/logo.png"
        alt="VibeGuard Logo"
        width={size}
        height={size}
        className={`object-contain rounded-sm ${className}`}
      />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={`inline-block shrink-0 ${className}`}
    >
      <defs>
        <filter id="logo-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="logo-radar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00E599" stopOpacity="0.25" />
          <stop offset="65%" stopColor="#00E599" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#00E599" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer Shield Frame */}
      <path
        d="M 50 6 C 58 12 71 14 88 16 C 90 49 84 74 50 94 C 16 74 10 49 12 16 C 29 14 42 12 50 6 Z"
        stroke="#475569"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="#0A0D12"
      />

      {/* Inner Concentric Shield */}
      <path
        d="M 50 12.5 C 57 17.5 68 19 82 21 C 84 48 78 70 50 88 C 22 70 16 48 18 21 C 32 19 43 17.5 50 12.5 Z"
        stroke="#334155"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Radar Glow Disc */}
      <circle cx="50" cy="50" r="26.5" fill="url(#logo-radar-glow)" />

      {/* Radar Scope Ring */}
      <circle
        cx="50"
        cy="50"
        r="26.5"
        stroke="#00E599"
        strokeWidth="2.2"
        filter="url(#logo-glow)"
        strokeOpacity="0.95"
      />

      {/* Radar Sweep Arm */}
      <line
        x1="50"
        y1="50"
        x2="68.7"
        y2="31.3"
        stroke="#00E599"
        strokeWidth="2.4"
        strokeLinecap="round"
        filter="url(#logo-glow)"
      />

      {/* Center Origin Pivot */}
      <circle cx="50" cy="50" r="3.4" fill="#5EEAD4" filter="url(#logo-glow)" />

      {/* Perimeter Target Dot */}
      <circle cx="68.7" cy="31.3" r="3.4" fill="#5EEAD4" filter="url(#logo-glow)" />
    </svg>
  );
}

export default VibeGuardLogo;
