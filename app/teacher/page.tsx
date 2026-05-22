import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";
import PageHero from "@/components/PageHero";

export default async function TeacherHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "teacher") redirect("/learn");

  // Every teacher can see every class. Fetch with the owner's display info.
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, join_code, teacher_id, created_at, profiles!classes_teacher_id_fkey(display_name, email), class_members(count)")
    .order("created_at", { ascending: false });

  const mine = ((classes ?? []) as any[]).filter((c) => c.teacher_id === user.id);
  const others = ((classes ?? []) as any[]).filter((c) => c.teacher_id !== user.id);

  function ClassCard({ c, mine }: { c: any; mine: boolean }) {
    const count = (c.class_members as any)?.[0]?.count ?? 0;
    const ownerP: any = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
    const ownerName = ownerP?.display_name ?? ownerP?.email ?? "Unknown";
    return (
      <Link
        key={c.id}
        href={`/teacher/classes/${c.id}`}
        className="card p-5 hover:shadow-md transition block"
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">{c.name}</h3>
          <span className="chip-gold">code {c.join_code}</span>
        </div>
        <p className="text-sm text-ink/60 mt-1">
          {count} student{count === 1 ? "" : "s"}
          {!mine && <> &middot; <span className="text-ink/50">teacher: {ownerName}</span></>}
        </p>
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        latinTag="Magister"
        title="Teacher dashboard"
        subtitle={`Welcome, ${profile?.display_name}. Create a class and share the join code, or browse other teachers' classes below.`}
        variant="colosseum"
      />

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Create a new class</h2>
        <form action={createClass} className="flex gap-3">
          <input className="input flex-1" name="name" placeholder="e.g. Year 8 Latin - set 1" required />
          <button className="btn-primary">Create class</button>
        </form>
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Your classes</h2>
        {!mine.length ? (
          <p className="text-ink/60">No classes yet &mdash; create one above.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {mine.map((c) => <ClassCard key={c.id} c={c} mine={true} />)}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="h-display text-xl mb-3">Other teachers&apos; classes</h2>
          <p className="text-sm text-ink/60 mb-3">
            View-only. You can browse students, attempts, and exports, but only the owning teacher can edit or delete.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {others.map((c) => <ClassCard key={c.id} c={c} mine={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}
