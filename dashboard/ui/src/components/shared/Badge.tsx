import React, { ReactNode } from 'react';

type BadgeVariant = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  info: 'bg-gray-100 text-gray-700',
};

export const Badge: React.FC<BadgeProps> = ({ variant, children }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
};

export default Badge;
