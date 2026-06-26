import React, { ReactNode } from 'react';

interface MetricCardProps {
  value: string | number;
  label: string;
  subtitle?: string;
  color?: string;
  icon?: ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  subtitle,
  color,
  icon,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      {icon && (
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3"
          style={{ backgroundColor: color ? `${color}1a` : '#f3f4f6' }}
        >
          <span style={color ? { color } : undefined}>{icon}</span>
        </div>
      )}
      <div
        className="text-2xl font-bold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-sm text-gray-700 font-medium mt-1">{label}</div>
      {subtitle && (
        <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
};

export default MetricCard;
