import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

// Real emblem images — drop these in /public/ to replace placeholders
function Emblem({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={110}
      height={110}
      className="select-none"
    />
  );
}

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const features = [
    {
      emblem: <Emblem src="/emblem-curriculum.png" alt="" />,
      title: "Latin Curriculum",
      body: "Learn through a proven, comprehensive Latin curriculum.",
      link: "/curriculum",
      linkLabel: "Explore Curriculum",
    },
    {
      emblem: <Emblem src="/emblem-missions.png" alt="" />,
      title: "Gamified Learning",
      body: "Earn mastery, complete missions, and rise through the ranks.",
      link: user ? "/learn" : "/signup",
      linkLabel: "View Missions",
    },
    {
      emblem: <Emblem src="/emblem-skills.png" alt="" />,
      title: "Master Core Skills",
      body: "Vocabulary, grammar, cases, and translation — all in one path.",
      link: "/skills",
      linkLabel: "Develop Skills",
    },
    {
      emblem: <Emblem src="/emblem-progress.png" alt="" />,
      title: "Track Your Progress",
      body: "See your growth chapter by chapter. Become legendary.",
      link: user ? "/dashboard" : "/signup",
      linkLabel: "View Progress",
    },
  ];

  return (
    <div className="-mt-8">
      {/* ── HERO — breaks out of max-w-6xl container ── */}
      <section
        className="relative overflow-hidden -mx-6"
        style={{ minHeight: "520px" }}
      >
        {/* Centurion image — Next.js Image with priority for fast LCP */}
        <Image
          src="/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden
        />
        {/* Gradient: solid dark on left so text is always readable */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #0B1220 0%, #0B1220 20%, rgba(11,18,32,0.6) 35%, rgba(11,18,32,0.0) 55%)",
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
            <span className="block text-4xl sm:text-5xl lg:text-6xl text-white">
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
              <h3 className="h-display text-sm text-white leading-snug">{f.title}</h3>
              <p className="text-sm text-ink/60 mt-2 max-w-[20ch] leading-relaxed">{f.body}</p>
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
            src="/aquila.png"
            alt=""
            aria-hidden
            className="h-52 sm:h-64 w-auto select-none"
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
              className="inline-flex items-center gap-3 mt-6 h-display text-xs tracking-[0.2em] text-white border border-gold/40 px-6 py-3 rounded hover:bg-gold/10 transition-colors"
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
