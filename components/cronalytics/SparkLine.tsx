"use client";

interface SparkLineProps {
  values: Array<number | null>;
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  ariaLabel?: string;
}

export function SparkLine({
  values,
  width = 80,
  height = 24,
  stroke = "var(--accent, currentColor)",
  fill = "transparent",
  ariaLabel,
}: SparkLineProps) {
  const numeric = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (numeric.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? "sparkline (no data)"}
        className="opacity-30"
      >
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  const stepX = width / Math.max(1, values.length - 1);

  const points = values
    .map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null;
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? "sparkline"}
    >
      <polyline
        points={points}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
