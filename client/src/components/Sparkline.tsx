interface SparklineProps {
  values: number[];
}

export const Sparkline = ({ values }: SparklineProps) => {
  if (values.length === 0) {
    return <div className="sparkline sparkline--empty">Waiting for market data</div>;
  }

  const width = 600;
  const height = 220;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkline-gradient" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f6b546" />
          <stop offset="100%" stopColor="#ff6a3d" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="url(#sparkline-gradient)" strokeWidth="6" points={points} />
    </svg>
  );
};
