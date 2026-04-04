/**
 * CSS 旋转 Spinner — sm / md / lg 三档
 */
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 16, md: 24, lg: 40 };

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  const s = sizes[size];
  return (
    <span
      className={`spinner spinner--${size}${className ? ` ${className}` : ''}`}
      style={{ width: s, height: s }}
      role="status"
      aria-label="加载中"
    />
  );
};

interface LoadingOverlayProps {
  visible: boolean;
  label?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, label }) => {
  if (!visible) return null;
  return (
    <div className="loading-overlay">
      <Spinner size="lg" />
      {label && <span className="loading-overlay__label">{label}</span>}
    </div>
  );
};
