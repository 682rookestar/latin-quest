interface LeaderboardRow {
  class_id: string;
  class_name: string;
  rank: number;
  student_id: string;
  display_name: string;
  badges: number;
  total_mastery: number;
  is_me: boolean;
}

interface Props {
  rows: LeaderboardRow[];
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function ClassLeaderboard({ rows }: Props) {
  if (!rows.length) {
    return (
      <aside className="card p-4">
        <h2 className="h-display text-xs tracking-widest text-gold mb-3">Leaderboard</h2>
        <p className="text-xs text-ink/50 leading-relaxed">
          Join a class to compete with your cohort.
        </p>
      </aside>
    );
  }

  // Group by class
  const classes = new Map<string, { name: string; rows: LeaderboardRow[] }>();
  for (const row of rows) {
    if (!classes.has(row.class_id)) {
      classes.set(row.class_id, { name: row.class_name, rows: [] });
    }
    classes.get(row.class_id)!.rows.push(row);
  }

  return (
    <aside className="space-y-4">
      {Array.from(classes.values()).map(({ name, rows: classRows }) => (
        <div key={name} className="card p-4">
          <h2 className="h-display text-xs tracking-widest text-gold mb-1">Leaderboard</h2>
          <p className="text-xs text-ink/50 mb-3 truncate">{name}</p>

          <ol className="space-y-1">
            {classRows.map((r) => (
              <li
                key={r.student_id}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors
                  ${r.is_me
                    ? "bg-gold/10 border border-gold/30"
                    : "hover:bg-white/5"
                  }`}
              >
                {/* Rank */}
                <span className="w-6 text-center flex-shrink-0 text-base leading-none">
                  {RANK_MEDAL[r.rank] ?? (
                    <span className="text-xs text-ink/40 font-mono">{r.rank}</span>
                  )}
                </span>

                {/* Name */}
                <span
                  className={`flex-1 truncate text-xs font-medium ${
                    r.is_me ? "text-gold" : "text-white/80"
                  }`}
                >
                  {r.display_name}
                  {r.is_me && (
                    <span className="ml-1 text-gold/60 font-normal">(you)</span>
                  )}
                </span>

                {/* Badges */}
                {r.badges > 0 && (
                  <span className="text-xs text-gold/70 flex-shrink-0" title={`${r.badges} chapter badge${r.badges !== 1 ? "s" : ""}`}>
                    {"🎖".repeat(Math.min(r.badges, 3))}
                    {r.badges > 3 ? ` ×${r.badges}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </aside>
  );
}
