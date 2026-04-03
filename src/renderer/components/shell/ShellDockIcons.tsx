import React from 'react';

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none' as const };

export const IconProject: React.FC = () => (
  <svg {...iconProps} aria-hidden stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M4 20V6l4-2h8l4 2v14H4z" />
    <path d="M8 6v4h8V6" />
  </svg>
);

export const IconResources: React.FC = () => (
  <svg {...iconProps} aria-hidden stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="3" y="5" width="8" height="8" rx="1" />
    <rect x="13" y="5" width="8" height="8" rx="1" />
    <rect x="8" y="13" width="8" height="8" rx="1" />
  </svg>
);

export const IconLayoutTask: React.FC = () => (
  <svg {...iconProps} aria-hidden stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="7" rx="1" />
    <rect x="4" y="13" width="16" height="7" rx="1" />
  </svg>
);

export const IconQaOutput: React.FC = () => (
  <svg {...iconProps} aria-hidden stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const IconProperties: React.FC = () => (
  <svg {...iconProps} aria-hidden stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M4 8h4l2-3h4l2 3h4" />
    <path d="M6 8v10h12V8" />
    <path d="M9 14h6" />
  </svg>
);
