import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Inline SVG glyphs for the feature hex tiles (book, swords, column, laurel).
// Matches the cyber-Roman style of the mockup.
function GlyphBook() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 5.5C3 4.7 3.7 4 4.5 4H11v15.5H4.5C3.7 19.5 3 18.8 3 18V5.5z" />
      <path d="M21 5.5C21 4.7 20.3 4 19.5 4H13v15.5h6.5c.8 0 1.5-.7 1.5-1.5V5.5z" />
      <path d="M12 4v15.5" />
    </svg>
  );
}
function GlyphSwords() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 21l4-2 11-11 1-4-4 1L4 16l-1 5z" />
      <path d="M21 21l-4-2L6 8l-1-4 4 1 11 11 1 5z" />
    </svg>
  );
}
function GlyphColumn() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M5 4h14M5 20h14M7 4v16M12 4v16M17 4v16M3 4h18M3 20h18" />
    </svg>
  );
}
function GlyphLaurel() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 21c-4-1-7-4-7-9 0-3 1-5 3-7 1 2 1 4 1 6" />
      <path d="M12 21c4-1 7-4 7-9 0-3-1-5-3-7-1 2-1 4-1 6" />
      <path d="M8 12c1 0 2 1 4 1s3-1 4-1" />
    </svg>
  );
}
function GlyphEagle() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M12 4l-3 5h6l-3-5z" fill="currentColor" />
      <path d="M3 13l9-4 9 4-6 2 1 5-4-3-4 3 1-5-6-2z" />
    </svg>
  );
}

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const features = [
    { glyph: <GlyphBook />,   title: "de Romanis curriculum", body: "Learn through a proven, comprehensive Latin curriculum." },
    { glyph: <GlyphSwords />, title: "Gamified learning",     body: "Earn mastery, complete missions, and rise through the ranks." },
    { glyph: <GlyphColumn />, title: "Master core skills",    body: "Vocabulary, grammar, cases, and translation — all in one path." },
    { glyph: <GlyphLaurel />, title: "Track your progress",   body: "See your growth chapter by chapter. Become legendary." },
  ];

  return (
    <div className="space-y-16 -mt-8">
      {/* HERO */}
      <section className="grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center pt-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md text-parchment font-bold"
                  style={{ background: "#22D3EE", boxShadow: "0 0 18px -4px rgba(34,211,238,0.6)" }}>
              de
            </span>
            <span className="h-display text-3xl">de Romanis</span>
          </div>
          <p className="h-display text-sky text-xs mt-3 tracking-[0.3em]">Learn Latin · Level up</p>

          <h1 className="h-display text-3xl lg:text-4xl mt-6 leading-[1.15] lg:whitespace-nowrap">
            Before cyber security<br />
            <span style={{ color: "#A78BFA" }}>there was Rome.</span>
          </h1>

          <p className="h-display text-2xl lg:text-3xl mt-5 leading-[1.2] text-gold" style={{ textShadow: "0 0 18px rgba(251,191,36,0.25)" }}>
            Decrypt the empire.
          </p>
          <p className="h-display text-lg lg:text-xl mt-3 leading-[1.25] tracking-[0.08em] text-sky">
            2000 years of secrets &mdash; and you are the key.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <Link href="/dashboard" className="cta-hex">
                Enter the academy <span aria-hidden>›</span>
              </Link>
            ) : (
              <>
                <Link href="/signup" className="cta-hex">
                  Begin your legion <span aria-hidden>›</span>
                </Link>
                <Link href="/login" className="btn-ghost">I already have an account</Link>
              </>
            )}
          </div>
        </div>

        {/* Hero image slot. Drop /public/hero.jpg in the repo to replace
            the gradient fallback. The aspect is kept fixed so layouts
            don't reflow when the image swaps in. */}
        <div className="hex-frame">
          <div className="hero-image" style={{ aspectRatio: "4/3" }} />
        </div>
      </section>

      {/* FEATURE TILES */}
      <section>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div className="hex-tile" style={{ ['--hex-color' as any]: 'rgba(251,191,36,0.55)' }}>
                <div style={{ color: '#FBBF24' }}>{f.glyph}</div>
              </div>
              <h3 className="h-display text-sm mt-4 text-ink">{f.title}</h3>
              <p className="text-sm text-ink/60 mt-2 max-w-[18ch]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MOTTO STRIP */}
      <section className="relative overflow-hidden border-t border-ink/10 mt-4 rounded-2xl">
        {/* Colosseum backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: "url('/colosseum.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.6,
          }}
        />
        {/* Dark gradient overlay to keep text readable */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,18,32,0.95) 0%, rgba(11,18,32,0.65) 35%, rgba(11,18,32,0.6) 65%, rgba(11,18,32,0.95) 100%)",
          }}
        />

        <div className="relative grid grid-cols-[auto_1fr] items-center gap-6 sm:gap-10 py-12 sm:py-16 px-6 sm:px-10">
          {/* Aquila standard — vertical totem */}
          <img
            src="/aquila.png"
            alt=""
            aria-hidden
            className="h-56 sm:h-72 w-auto select-none"
            style={{ filter: "drop-shadow(0 0 18px rgba(251,191,36,0.35))" }}
          />

          {/* Motto block */}
          <div>
            <p
              className="h-display text-3xl sm:text-4xl text-gold leading-tight"
              style={{ textShadow: "0 0 18px rgba(251,191,36,0.3)" }}
            >
              Lingua Latina.<br />
              Potentia Aeterna.
            </p>
            <p className="h-display text-xs sm:text-sm mt-4 tracking-[0.4em] text-sky">
              The language is your power
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
