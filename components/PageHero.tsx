/**
 * Themed page header used at the top of major dashboards.
 *
 * Variants:
 *   colosseum -- broad/atmospheric backdrop (Colosseum image), good
 *                for dashboard landings where you want gravitas.
 *   legionary -- the cyber-Roman portrait, weighted to the right so
 *                the headline text doesn't fight the figure.
 *
 * Keep the children short -- usually just the page title + 1-line
 * subtitle. Latin tag is optional flavour text.
 */
export default function PageHero({
  title,
  subtitle,
  latinTag,
  variant = "colosseum",
  children,
}: {
  title: string;
  subtitle?: string;
  latinTag?: string;
  variant?: "colosseum" | "legionary";
  children?: React.ReactNode;
}) {
  const bg =
    variant === "legionary" ? "/hero.png" : "/colosseum.png";
  const overlay =
    variant === "legionary"
      ? // Heavier wash on the left to leave the legionary visible on the right.
        "linear-gradient(90deg, rgba(11,18,32,0.96) 0%, rgba(11,18,32,0.85) 45%, rgba(11,18,32,0.45) 100%)"
      : // Soft top-bottom darkening so the title sits comfortably anywhere.
        "linear-gradient(180deg, rgba(11,18,32,0.7) 0%, rgba(11,18,32,0.55) 50%, rgba(11,18,32,0.9) 100%)";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink/10 mb-8">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `url('${bg}')`,
          backgroundSize: "cover",
          backgroundPosition: variant === "legionary" ? "right center" : "center",
          opacity: variant === "legionary" ? 0.85 : 0.55,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: overlay }}
      />

      <div className="relative p-6 sm:p-10 min-h-[200px] flex flex-col justify-end">
        {latinTag && (
          <p className="h-display text-xs tracking-[0.4em] text-sky mb-2">
            {latinTag}
          </p>
        )}
        <h1 className="h-display text-3xl sm:text-4xl text-ink leading-tight" style={{ textShadow: "0 0 24px rgba(11,18,32,0.6)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-ink/75 mt-2 max-w-xl">{subtitle}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}
