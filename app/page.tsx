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
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, number, title, subtitle, description")
    .order("number");

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

          <h1 className="h-display text-5xl lg:text-6xl mt-6 leading-[1.1]">
            A gamified Latin<br />
            <span style={{ color: "#A78BFA" }}>learning platform</span>
          </h1>

          <p className="mt-5 text-ink/70 max-w-md text-lg">
            Built around the <em className="text-gold not-italic">de Romanis</em> curriculum. Master vocab, grammar, cases, and translation through interactive exercises.
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

      {/* CHAPTERS */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="h-display text-2xl">Chapters in Book 1: <span className="text-gold italic">dei et deae</span></h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters?.map((ch) => (
            <div key={ch.id} className="card p-5 relative overflow-hidden">
              <div
                aria-hidden
                className="absolute right-0 top-0 h-10 w-10"
                style={{
                  background: "linear-gradient(45deg, transparent 50%, rgba(34,211,238,0.25) 50%)",
                }}
              />
              <div className="flex items-baseline justify-between relative">
                <span className="chip-sky h-display tracking-widest text-[10px]">Chapter {ch.number}</span>
                <span className="text-xs text-ink/50">{ch.subtitle}</span>
              </div>
              <h3 className="text-xl font-semibold mt-3">{ch.title}</h3>
              <p className="text-sm text-ink/70 mt-2 min-h-[3.5rem]">{ch.description}</p>
              <div className="xp-bar mt-4"><span style={{ width: '0%' }} /></div>
            </div>
          ))}
        </div>
      </section>

      {/* AUDIENCES */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="h-display text-lg mb-2 text-sky">For teachers</h3>
          <p className="text-sm text-ink/70">
            Create classes, share a join code, lock chapters as homework, and track each student&apos;s mastery across vocab, grammar, case usage, and translation.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="h-display text-lg mb-2" style={{ color: "#A78BFA" }}>For students</h3>
          <p className="text-sm text-ink/70">
            Ten game types — vocab matching, case and tense ID, gap-fills, preposition pictures, sentence translation, and more — all self-marking with instant feedback.
          </p>
        </div>
      </section>

      {/* MOTTO STRIP */}
      <section className="text-center py-12 border-t border-ink/10">
        <div className="flex items-center justify-center gap-4 text-gold">
          <GlyphEagle />
        </div>
        <p className="h-display text-2xl mt-5 text-gold">Lingua Latina. Potentia Aeterna.</p>
        <p className="h-display text-xs mt-2 tracking-[0.4em] text-sky">The language is your power</p>
      </section>
    </div>
  );
}
