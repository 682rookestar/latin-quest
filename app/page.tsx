import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Circular laurel-wreath emblem SVGs for the four feature tiles
function EmblemTemple() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden fill="none">
      <circle cx="40" cy="40" r="38" stroke="#C9970A" strokeWidth="1" opacity="0.4" />
      {/* Laurel left */}
      <path d="M12 40 C10 32 15 24 20 22 C18 28 16 34 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M13 35 C11 28 17 21 22 20 C20 26 17 31 18 36" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.7" />
      <path d="M12 40 C10 48 15 56 20 58 C18 52 16 46 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      {/* Laurel right */}
      <path d="M68 40 C70 32 65 24 60 22 C62 28 64 34 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M67 35 C69 28 63 21 58 20 C60 26 63 31 62 36" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.7" />
      <path d="M68 40 C70 48 65 56 60 58 C62 52 64 46 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      {/* Ribbon at bottom */}
      <path d="M32 62 Q40 66 48 62" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.8" />
      {/* Temple icon */}
      <rect x="28" y="34" width="24" height="14" stroke="#C9970A" strokeWidth="1.5" fill="none" />
      <line x1="32" y1="34" x2="32" y2="48" stroke="#C9970A" strokeWidth="1" />
      <line x1="37" y1="34" x2="37" y2="48" stroke="#C9970A" strokeWidth="1" />
      <line x1="43" y1="34" x2="43" y2="48" stroke="#C9970A" strokeWidth="1" />
      <line x1="48" y1="34" x2="48" y2="48" stroke="#C9970A" strokeWidth="1" />
      <rect x="26" y="31" width="28" height="3" fill="#C9970A" opacity="0.8" />
      <line x1="28" y1="48" x2="52" y2="48" stroke="#C9970A" strokeWidth="1.5" />
    </svg>
  );
}

function EmblemSwords() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden fill="none">
      <circle cx="40" cy="40" r="38" stroke="#C9970A" strokeWidth="1" opacity="0.4" />
      <path d="M12 40 C10 32 15 24 20 22 C18 28 16 34 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M12 40 C10 48 15 56 20 58 C18 52 16 46 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 32 65 24 60 22 C62 28 64 34 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 48 65 56 60 58 C62 52 64 46 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M32 62 Q40 66 48 62" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.8" />
      {/* Crossed swords */}
      <line x1="28" y1="26" x2="52" y2="54" stroke="#C9970A" strokeWidth="2" />
      <line x1="52" y1="26" x2="28" y2="54" stroke="#C9970A" strokeWidth="2" />
      <rect x="26" y="37.5" width="9" height="5" rx="1" fill="#C9970A" opacity="0.7" />
      <rect x="45" y="37.5" width="9" height="5" rx="1" fill="#C9970A" opacity="0.7" />
    </svg>
  );
}

function EmblemShield() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden fill="none">
      <circle cx="40" cy="40" r="38" stroke="#C9970A" strokeWidth="1" opacity="0.4" />
      <path d="M12 40 C10 32 15 24 20 22 C18 28 16 34 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M12 40 C10 48 15 56 20 58 C18 52 16 46 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 32 65 24 60 22 C62 28 64 34 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 48 65 56 60 58 C62 52 64 46 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M32 62 Q40 66 48 62" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.8" />
      {/* Shield */}
      <path d="M40 24 L54 30 L54 44 Q54 54 40 58 Q26 54 26 44 L26 30 Z" stroke="#C9970A" strokeWidth="1.5" fill="none" />
      <line x1="40" y1="24" x2="40" y2="58" stroke="#C9970A" strokeWidth="1" opacity="0.5" />
      <line x1="26" y1="38" x2="54" y2="38" stroke="#C9970A" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function EmblemEagle() {
  return (
    <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden fill="none">
      <circle cx="40" cy="40" r="38" stroke="#C9970A" strokeWidth="1" opacity="0.4" />
      <path d="M12 40 C10 32 15 24 20 22 C18 28 16 34 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M12 40 C10 48 15 56 20 58 C18 52 16 46 17 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 32 65 24 60 22 C62 28 64 34 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M68 40 C70 48 65 56 60 58 C62 52 64 46 63 40" stroke="#C9970A" strokeWidth="1.2" fill="none" opacity="0.9" />
      <path d="M32 62 Q40 66 48 62" stroke="#C9970A" strokeWidth="1" fill="none" opacity="0.8" />
      {/* Eagle wings spread */}
      <path d="M40 32 L22 38 L28 42 L22 46 L30 44 L36 50 L40 48 L44 50 L50 44 L58 46 L52 42 L58 38 Z"
            stroke="#C9970A" strokeWidth="1.2" fill="none" />
      <circle cx="40" cy="34" r="3" stroke="#C9970A" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const features = [
    {
      emblem: <EmblemTemple />,
      title: "de Romanis Curriculum",
      body: "Learn through a proven, comprehensive Latin curriculum.",
      link: "/curriculum",
      linkLabel: "Explore Curriculum",
    },
    {
      emblem: <EmblemSwords />,
      title: "Gamified Learning",
      body: "Earn mastery, complete missions, and rise through the ranks.",
      link: user ? "/learn" : "/signup",
      linkLabel: "View Missions",
    },
    {
      emblem: <EmblemShield />,
      title: "Master Core Skills",
      body: "Vocabulary, grammar, cases, and translation — all in one path.",
      link: "/skills",
      linkLabel: "Develop Skills",
    },
    {
      emblem: <EmblemEagle />,
      title: "Track Your Progress",
      body: "See your growth chapter by chapter. Become legendary.",
      link: user ? "/dashboard" : "/signup",
      linkLabel: "View Progress",
    },
  ];

  return (
    <div className="-mt-8">
      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "520px" }}
      >
        {/* Centurion image — right side, blends left */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/hero.png')",
            backgroundSize: "cover",
            backgroundPosition: "center right",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Gradient: opaque dark on left, transparent on right so centurion shows */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #0B1220 0%, #0B1220 40%, rgba(11,18,32,0.7) 65%, rgba(11,18,32,0.2) 100%)",
          }}
        />
        {/* Bottom fade */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{
            background: "linear-gradient(to bottom, transparent, #0B1220)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 px-6 py-20 max-w-2xl">
          <p className="h-display text-xs tracking-[0.35em] text-gold mb-6">
            Learn Latin · Level Up.
          </p>

          <h1 className="h-display leading-[1.1]">
            <span className="block text-4xl sm:text-5xl lg:text-6xl text-parchment">
              Before Cyber<br />Security
            </span>
            <span
              className="block text-4xl sm:text-5xl lg:text-6xl text-gold mt-1"
              style={{ textShadow: "0 0 30px rgba(201,151,10,0.4)" }}
            >
              There Was Rome.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-ink/70 max-w-md leading-relaxed">
            Decrypt the empire. 2000 years of secrets —<br className="hidden sm:block" />
            and you are the key.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {user ? (
              <Link href="/dashboard" className="cta-hex">
                Enter the Academy <span aria-hidden>›</span>
              </Link>
            ) : (
              <>
                <Link href="/signup" className="cta-hex">
                  Begin your Legion <span aria-hidden>›</span>
                </Link>
                <Link
                  href="/login"
                  className="btn-ghost"
                  style={{ clipPath: "none", border: "1px solid rgba(229,231,235,0.2)" }}
                >
                  I already have an account
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FEATURE TILES ── */}
      <section className="px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 max-w-5xl mx-auto">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div className="mb-4">{f.emblem}</div>
              <h3 className="h-display text-sm text-parchment leading-snug">{f.title}</h3>
              <p className="text-sm text-ink/60 mt-2 max-w-[20ch] leading-relaxed">{f.body}</p>
              <Link
                href={f.link}
                className="h-display text-xs text-gold mt-4 tracking-widest hover:opacity-80 transition-opacity"
              >
                {f.linkLabel} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── MOTTO STRIP ── */}
      <section className="relative overflow-hidden border-t border-gold/10 mx-6 rounded-2xl">
        {/* Colosseum backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: "url('/colosseum.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.5,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(11,18,32,0.97) 0%, rgba(11,18,32,0.7) 35%, rgba(11,18,32,0.65) 65%, rgba(11,18,32,0.97) 100%)",
          }}
        />

        <div className="relative grid grid-cols-[auto_1fr] items-center gap-8 sm:gap-12 py-14 sm:py-20 px-6 sm:px-12">
          {/* Eagle standard */}
          <img
            src="/eagle.png"
            alt=""
            aria-hidden
            className="h-52 sm:h-64 w-auto select-none"
            style={{ filter: "drop-shadow(0 0 20px rgba(201,151,10,0.4))" }}
          />

          <div>
            <p
              className="h-display text-3xl sm:text-4xl lg:text-5xl text-gold leading-tight"
              style={{ textShadow: "0 0 24px rgba(201,151,10,0.3)" }}
            >
              Lingua Latina.<br />
              Potentia Aeterna.
            </p>
            <p className="h-display text-xs sm:text-sm mt-5 tracking-[0.4em] text-ink/50">
              The language is your power.
            </p>
            <Link
              href={user ? "/learn" : "/signup"}
              className="inline-flex items-center gap-3 mt-6 h-display text-xs tracking-[0.2em] text-parchment border border-gold/40 px-6 py-3 rounded hover:bg-gold/10 transition-colors"
            >
              Join the Legion →
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom padding */}
      <div className="h-16" />
    </div>
  );
}
