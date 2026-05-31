"use client";

/**
 * ChapterStandard
 *
 * Renders a Roman military signum (standard) for a chapter.
 * - Top totem: chapter-specific PNG image
 * - Phalerae: one disc per grammar topic, filled gold when passed
 * - Crimson plaque with the chapter number
 * - Wooden pole with a ground spike
 *
 * Chapter → totem image mapping (accounting for filename quirks):
 *   Ch1 → /Manus.png       (open hand)
 *   Ch2 → /Lion.png        (lion)
 *   Ch3 → /Boar.png        (bull — Taurus theme despite filename)
 *   Ch4 → /Aper.png        (boar — despite filename)
 *   Ch5 → /Capricornus.png (capricorn)
 *   Ch6 → /aquila.png      (eagle)
 */

const TOTEM_BY_CHAPTER: Record<number, string> = {
  1: "/Manus.png",
  2: "/Lion.png",
  3: "/Boar.png",
  4: "/Aper.png",
  5: "/Capricornus.png",
  6: "/aquila.png",
};

interface Props {
  chapterNumber: number;
  totalTopics: number;
  passedTopics: number;
  badgeEarned: boolean;
  /** px width of the rendered component; height scales automatically */
  size?: number;
}

export default function ChapterStandard({
  chapterNumber,
  totalTopics,
  passedTopics,
  badgeEarned,
  size = 120,
}: Props) {
  const totem = TOTEM_BY_CHAPTER[chapterNumber] ?? "/aquila.png";

  // Layout constants (all relative to a 100-unit wide canvas)
  const W = 100;
  const poleX = W / 2;          // centre x
  const poleTop = 28;            // where pole starts (below totem)
  const poleBottom = 96;         // above the spike tip
  const poleWidth = 5;

  // Totem sits above the pole
  const totemSize = 28;
  const totemY = 0;

  // Phalerae — stacked discs below the totem, above the plaque
  const maxDiscs = Math.max(totalTopics, 1);
  const discR = 7;
  const discSpacing = 16;
  const discStartY = poleTop + 8;

  // Crimson plaque
  const plaqueW = 34;
  const plaqueH = 14;
  const plaqueY = discStartY + maxDiscs * discSpacing + 2;

  // Crossbar
  const crossbarY = poleTop + 2;
  const crossbarHalf = 18;
  const crossbarThick = 3;

  // Full SVG height
  const svgH = poleBottom + 10;

  // Scale factor for rendering
  const scale = size / W;

  return (
    <svg
      viewBox={`0 0 ${W} ${svgH}`}
      width={W * scale}
      height={svgH * scale}
      aria-label={`Chapter ${chapterNumber} standard — ${passedTopics}/${totalTopics} topics complete`}
      style={{ display: "block" }}
    >
      <defs>
        {/* Wood grain gradient for pole */}
        <linearGradient id={`pole-${chapterNumber}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6B3A1F" />
          <stop offset="40%"  stopColor="#8B4513" />
          <stop offset="60%"  stopColor="#A0522D" />
          <stop offset="100%" stopColor="#6B3A1F" />
        </linearGradient>

        {/* Gold gradient for filled phalerae */}
        <radialGradient id={`gold-disc-${chapterNumber}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#FFE066" />
          <stop offset="60%"  stopColor="#C9970A" />
          <stop offset="100%" stopColor="#7A5A00" />
        </radialGradient>

        {/* Empty disc */}
        <radialGradient id={`empty-disc-${chapterNumber}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="#555" />
          <stop offset="100%" stopColor="#222" />
        </radialGradient>

        {/* Spike gradient */}
        <linearGradient id={`spike-${chapterNumber}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#888" />
          <stop offset="50%"  stopColor="#ddd" />
          <stop offset="100%" stopColor="#888" />
        </linearGradient>

        {/* Badge glow filter */}
        {badgeEarned && (
          <filter id={`glow-${chapterNumber}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* ── Pole ── */}
      <rect
        x={poleX - poleWidth / 2}
        y={poleTop}
        width={poleWidth}
        height={poleBottom - poleTop}
        fill={`url(#pole-${chapterNumber})`}
        rx="1"
      />

      {/* ── Crossbar ── */}
      <rect
        x={poleX - crossbarHalf}
        y={crossbarY - crossbarThick / 2}
        width={crossbarHalf * 2}
        height={crossbarThick}
        fill={`url(#pole-${chapterNumber})`}
        rx="1"
      />
      {/* Crossbar end caps */}
      <circle cx={poleX - crossbarHalf} cy={crossbarY} r={crossbarThick / 2 + 0.5} fill="#C9970A" />
      <circle cx={poleX + crossbarHalf} cy={crossbarY} r={crossbarThick / 2 + 0.5} fill="#C9970A" />

      {/* ── Totem image ── */}
      <image
        href={totem}
        x={poleX - totemSize / 2}
        y={totemY}
        width={totemSize}
        height={totemSize}
        style={badgeEarned ? { filter: `url(#glow-${chapterNumber})` } : undefined}
      />

      {/* ── Phalerae (topic discs) ── */}
      {Array.from({ length: maxDiscs }).map((_, i) => {
        const cx = poleX;
        const cy = discStartY + i * discSpacing;
        const passed = i < passedTopics;
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={discR}
              fill={passed ? `url(#gold-disc-${chapterNumber})` : `url(#empty-disc-${chapterNumber})`}
              stroke={passed ? "#7A5A00" : "#444"}
              strokeWidth="0.8"
            />
            {/* Decorative ring inside disc */}
            <circle
              cx={cx}
              cy={cy}
              r={discR * 0.65}
              fill="none"
              stroke={passed ? "#FFE066" : "#555"}
              strokeWidth="0.5"
              opacity="0.6"
            />
            {passed && (
              /* Small dot centre for filled discs */
              <circle cx={cx} cy={cy} r={1.2} fill="#FFE066" opacity="0.9" />
            )}
          </g>
        );
      })}

      {/* ── Crimson plaque ── */}
      <rect
        x={poleX - plaqueW / 2}
        y={plaqueY}
        width={plaqueW}
        height={plaqueH}
        fill="#8B1A1A"
        stroke="#C9970A"
        strokeWidth="1"
        rx="2"
      />
      <text
        x={poleX}
        y={plaqueY + plaqueH / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="6"
        fontFamily="serif"
        fontWeight="bold"
        fill="#FFE066"
        letterSpacing="1"
      >
        {`LEG·${toRoman(chapterNumber)}`}
      </text>

      {/* ── Ground spike ── */}
      <polygon
        points={`${poleX - 2.5},${poleBottom} ${poleX + 2.5},${poleBottom} ${poleX},${svgH - 2}`}
        fill={`url(#spike-${chapterNumber})`}
      />
    </svg>
  );
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, "X"], [9, "IX"], [8, "VIII"], [7, "VII"],
    [6, "VI"], [5, "V"],  [4, "IV"],  [1, "I"],
  ];
  let result = "";
  for (const [val, sym] of map) {
    while (n >= val) { result += sym; n -= val; }
  }
  return result;
}
