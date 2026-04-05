import { useId } from 'react';

interface SparklineProps {
  values: number[];
}

const createPath = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

export const Sparkline = ({ values }: SparklineProps) => {
  if (values.length === 0) {
    return <div className="sparkline sparkline--empty">Waiting for market data</div>;
  }

  const width = 600;
  const height = 220;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const ids = useId().replace(/:/g, '');
  const isUptrend = values[values.length - 1] >= values[0];
  const strokeStart = isUptrend ? '#0f9d58' : '#c07a28';
  const strokeEnd = isUptrend ? '#9be9b3' : '#f6c36c';
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });
  const linePath = createPath(points);
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const finalPoint = points[points.length - 1];
  const gridLines = [0.2, 0.5, 0.8].map((stop) => height * stop);

  return (
    <div className="sparkline-shell">
      <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${ids}-sparkline-stroke`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={strokeStart} />
            <stop offset="100%" stopColor={strokeEnd} />
          </linearGradient>
          <linearGradient id={`${ids}-sparkline-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={isUptrend ? 'rgba(15, 157, 88, 0.34)' : 'rgba(192, 122, 40, 0.3)'} />
            <stop offset="100%" stopColor="rgba(8, 12, 16, 0)" />
          </linearGradient>
          <filter id={`${ids}-sparkline-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor={isUptrend ? '#0f9d58' : '#d58f3c'} floodOpacity="0.2" />
          </filter>
        </defs>

        <g className="sparkline__grid">
          {gridLines.map((y) => (
            <line key={y} x1="0" y1={y} x2={width} y2={y} />
          ))}
        </g>

        <path className="sparkline__area" d={areaPath} fill={`url(#${ids}-sparkline-fill)`} />
        <path
          className="sparkline__line"
          d={linePath}
          fill="none"
          stroke={`url(#${ids}-sparkline-stroke)`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${ids}-sparkline-shadow)`}
          pathLength={100}
        />
        <circle className="sparkline__point" cx={finalPoint.x} cy={finalPoint.y} r="7" fill={strokeEnd} />
        <circle className="sparkline__point sparkline__point--halo" cx={finalPoint.x} cy={finalPoint.y} r="14" fill={strokeEnd} />
      </svg>
      <div className="sparkline__labels">
        <span>Low {min.toFixed(2)}</span>
        <span>High {max.toFixed(2)}</span>
      </div>
    </div>
  );
};
