import { RIASEC } from "../lib/types";
import type { Riasec } from "../lib/types";
import { RIASEC_COLOR, RIASEC_LABEL } from "../lib/presentation";

/**
 * Hexagone Holland lisible : le polygone est rempli, les six branches sont
 * nommées, et les trois dominantes ressortent. Pas de pourcentage de réussite.
 */
export function HollandChart({
  theta,
  code,
  className = "",
}: {
  theta: Record<Riasec, number>;
  code?: string;
  className?: string;
}) {
  const width = 400;
  const height = 360;
  const cx = 200;
  const cy = 176;
  const radius = 104;
  const labelRadius = 134;

  const angles = RIASEC.map(
    (_, index) => -Math.PI / 2 + (index * Math.PI * 2) / 6,
  );
  const value = (key: Riasec) => Math.max(0.08, Math.min(1, theta[key]));
  const point = (index: number, amount: number) => {
    const r = radius * (0.18 + 0.82 * amount);
    return [
      cx + r * Math.cos(angles[index]),
      cy + r * Math.sin(angles[index]),
    ] as const;
  };
  const polygon = RIASEC.map((key, index) =>
    point(index, value(key)).join(","),
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`mx-auto h-auto w-full max-w-[380px] ${className}`}
      role="img"
      aria-label={`Profil Holland ${RIASEC.map(
        (key) => `${key}:${Math.round(theta[key] * 100)}`,
      ).join(", ")}`}
    >
      <defs>
        <linearGradient id="holland-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#C8F169" stopOpacity="0.16" />
        </linearGradient>
        <radialGradient id="holland-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FF5A36" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#FF5A36" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={radius * 1.18} fill="url(#holland-glow)" />

      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={RIASEC.map((_, index) => {
            const r = radius * scale;
            return `${cx + r * Math.cos(angles[index])},${
              cy + r * Math.sin(angles[index])
            }`;
          }).join(" ")}
          fill="none"
          stroke="rgba(247,242,232,0.12)"
          strokeWidth={scale === 1 ? 1.4 : 1}
        />
      ))}

      {RIASEC.map((_, index) => (
        <line
          key={index}
          x1={cx}
          y1={cy}
          x2={cx + radius * Math.cos(angles[index])}
          y2={cy + radius * Math.sin(angles[index])}
          stroke="rgba(247,242,232,0.12)"
        />
      ))}

      <polygon
        points={polygon}
        fill="url(#holland-fill)"
        stroke="#FF5A36"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {RIASEC.map((key, index) => {
        const [x, y] = point(index, value(key));
        return (
          <g key={key}>
            <circle
              cx={x}
              cy={y}
              r="6"
              fill={RIASEC_COLOR[key]}
              stroke="#141414"
              strokeWidth="2"
            />
            <circle cx={x} cy={y} r="2" fill="#141414" opacity="0.45" />
          </g>
        );
      })}

      {RIASEC.map((key, index) => {
        const lx = cx + labelRadius * Math.cos(angles[index]);
        const ly = cy + labelRadius * Math.sin(angles[index]);
        const anchor =
          Math.abs(lx - cx) < 10 ? "middle" : lx > cx ? "start" : "end";
        const dominant = code?.includes(key);
        return (
          <g key={`label-${key}`}>
            <text
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill={RIASEC_COLOR[key]}
              fontSize={dominant ? 16 : 14}
              fontWeight="900"
            >
              {key}
            </text>
            <text
              x={lx}
              y={ly + 15}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill={dominant ? "rgba(247,242,232,0.78)" : "rgba(247,242,232,0.5)"}
              fontSize="10.5"
              fontWeight="700"
            >
              {RIASEC_LABEL[key]} · {Math.round(theta[key] * 100)}
            </text>
          </g>
        );
      })}

      {code && (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fill="rgba(247,242,232,0.22)"
          fontSize="20"
          fontWeight="900"
          letterSpacing="3"
        >
          {code}
        </text>
      )}
    </svg>
  );
}

/**
 * Barres d'affinité : lisibles, stables, sans effet « dashboard ».
 */
export function AffinityBars({
  title,
  caption,
  rows,
}: {
  title: string;
  caption?: string;
  rows: { label: string; value: number; detail?: string }[];
}) {
  return (
    <div className="rounded-3xl border border-ink/10 bg-paper p-5 shadow-[0_1px_0_rgba(20,20,20,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-ink/40">
          {title}
        </p>
        <span className="rounded-full bg-sand px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink/45">
          affinité
        </span>
      </div>
      {caption && (
        <p className="mt-1 text-[10px] leading-relaxed text-ink/35">{caption}</p>
      )}
      <div className="mt-4 space-y-3.5">
        {rows.map((row, index) => {
          const percentage = Math.round(Math.max(0, Math.min(1, row.value)) * 100);
          return (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={`min-w-0 truncate text-xs ${
                    index < 2 ? "font-black text-ink/80" : "font-semibold text-ink/65"
                  }`}
                >
                  {row.label}
                </span>
                <span className="shrink-0 text-[11px] font-black tabular-nums text-ink/45">
                  {percentage}
                  <span className="ml-0.5 text-[9px] font-bold text-ink/30">%</span>
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    background:
                      "linear-gradient(90deg, #FF5A36 0%, #FF7A4D 55%, #FFB36B 100%)",
                  }}
                />
              </div>
              {row.detail && (
                <p className="mt-1 text-[10px] text-ink/35">{row.detail}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
