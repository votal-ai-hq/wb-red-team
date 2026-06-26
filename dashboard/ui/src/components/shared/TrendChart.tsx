import React from 'react';

interface TrendChartProps {
  data: { date: string; score: number }[];
  width?: number;
  height?: number;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  width = 300,
  height = 60,
}) => {
  if (data.length === 0) return null;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const minScore = Math.min(...data.map((d) => d.score));
  const maxScore = Math.max(...data.map((d) => d.score));
  const range = maxScore - minScore || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding + chartHeight - ((d.score - minScore) / range) * chartHeight;
    return `${x},${y}`;
  });

  const polylinePoints = points.join(' ');

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPoints = `${firstPoint} ${polylinePoints} ${lastPoint.split(',')[0]},${height - padding} ${padding},${height - padding}`;

  const gradientId = `trend-gradient-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default TrendChart;
