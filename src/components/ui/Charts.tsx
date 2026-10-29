import { useMemo } from 'react';

interface BarSeries {
  label: string;
  income: number;
  expense: number;
}

interface BarChartProps {
  series: BarSeries[];
  height?: number;
  currencySymbol?: string;
}

export function GroupedBarChart({ series, height = 200, currencySymbol = '₹' }: BarChartProps) {
  const max = useMemo(() => {
    const m = Math.max(1, ...series.map((s) => Math.max(s.income, s.expense)));
    return m;
  }, [series]);

  if (series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">No data</div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {series.map((s, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-emerald-500 transition-all"
                style={{ height: `${(s.income / max) * 100}%` }}
                title={`Income: ${currencySymbol}${s.income.toLocaleString('en-IN')}`}
              />
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-red-500 transition-all"
                style={{ height: `${(s.expense / max) * 100}%` }}
                title={`Expense: ${currencySymbol}${s.expense.toLocaleString('en-IN')}`}
              />
            </div>
            <span className="truncate text-[10px] text-gray-500 dark:text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ data, size = 160, currencySymbol = '₹' }: { data: DonutDatum[]; size?: number; currencySymbol?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 18;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2" style={{ height: size }}>
        <div className="rounded-full border-[18px] border-gray-100 dark:border-white/5" style={{ width: size - 20, height: size - 20 }} />
        <p className="text-xs text-gray-400">No spending yet</p>
      </div>
    );
  }

  let offset = 0;
  const circumference = 2 * Math.PI * radius;
  const segments = data.map((d) => {
    const frac = d.value / total;
    const dash = frac * circumference;
    const seg = {
      ...d,
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: -offset,
    };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" className="text-gray-100 dark:text-white/5" strokeWidth={strokeWidth} />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="w-full space-y-1.5">
        {data.slice(0, 5).map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              {d.label}
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {currencySymbol}{d.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LinePoint {
  label: string;
  value: number;
}

export function LineChart({ data, height = 120, color = '#10b981', currencySymbol = '₹' }: { data: LinePoint[]; height?: number; color?: string; currencySymbol?: string }) {
  if (data.length === 0) return <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>No data</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const w = 100;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d.value - min) / range) * (height - 20) - 10;
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="w-full">
      <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ height }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lineGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        {data.map((d, i) => (
          <span key={i} className={data.length > 6 && i % 2 !== 0 ? 'hidden sm:inline' : ''}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
