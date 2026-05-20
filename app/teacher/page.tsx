import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClass } from "./actions";

export default async function TeacherHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,display_name").eq("id", user.id).single();
  if (profile?.role !== "teacher") redirect("/learn");

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, join_code, created_at, class_members(count)")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Teacher dashboard</h1>
        <p className="text-ink/60">Welcome, {profile?.display_name}. Create a class and share the join code with your students.</p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Create a new class</h2>
        <form action={createClass} className="flex gap-3">
          <input className="input flex-1" name="name" placeholder="e.g. Year 8 Latin — set 1" required />
          <button className="btn-primary">Create class</button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Your classes</h2>
        {!classes?.length ? (
          <p className="text-ink/60">No classes yet — create one above.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {classes.map(c => {
              const count = (c.class_members as any)?.[0]?.count ?? 0;
              return (
                <Link key={c.id} href={`/teacher/classes/${c.id}`} className="card p-5 hover:shadow-md transition">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <span className="chip-gold">code {c.join_code}</span>
                  </div>
                  <p className="text-sm text-ink/60 mt-1">{count} student{count === 1 ? "" : "s"}</p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
