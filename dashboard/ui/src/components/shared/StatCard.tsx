import React, { ReactNode } from 'react';

interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;
  icon?: ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  color,
  icon,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
      {icon && (
        <div className="flex justify-center mb-2 text-gray-500">{icon}</div>
      )}
      <div
        className="text-3xl font-bold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
};

export default StatCard;
