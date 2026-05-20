import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, number, title, subtitle, description")
    .order("number");

  return (
    <div className="space-y-10">
      <section className="text-center py-10">
        <h1 className="text-5xl font-bold tracking-tight">salvē, discipule!</h1>
        <p className="text-xl mt-4 text-ink/70 max-w-2xl mx-auto">
          A gamified Latin learning platform built around the <em>de Romanis</em> curriculum. Master vocab, grammar, cases, and translation through interactive exercises.
        </p>
        <div className="flex justify-center gap-3 mt-6">
          {user ? (
            <Link href="/dashboard" className="btn-primary">Go to my dashboard</Link>
          ) : (
            <>
              <Link href="/signup" className="btn-primary">Start learning</Link>
              <Link href="/login" className="btn-ghost">I already have an account</Link>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Chapters in Book 1: <em>dei et deae</em></h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters?.map((ch) => (
            <div key={ch.id} className="card p-5">
              <div className="flex items-baseline justify-between">
                <span className="chip-wine">Chapter {ch.number}</span>
                <span className="text-xs text-ink/50">{ch.subtitle}</span>
              </div>
              <h3 className="text-xl font-semibold mt-2">{ch.title}</h3>
              <p className="text-sm text-ink/70 mt-2">{ch.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-2">For teachers</h3>
          <p className="text-sm text-ink/70">
            Create classes, share a join code, and track each student's mastery of vocab,
            grammar, case usage, and translation across every chapter.
          </p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-2">For students</h3>
          <p className="text-sm text-ink/70">
            Ten game types — vocab matching, case/tense ID, gap-fills, preposition pictures,
            sentence translation, and more — all self-marking with instant feedback.
          </p>
        </div>
      </section>
    </div>
  );
}
