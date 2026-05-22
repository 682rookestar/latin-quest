import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role, display_name").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: teacherCount }, { count: studentCount }, { count: invitesSent }, { count: classCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("teacher_invites").select("id", { count: "exact", head: true }),
    supabase.from("classes").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-ink/60">Welcome, {profile?.display_name}.</p>
      </header>

      <section className="grid md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-sm text-ink/60">Teachers</div>
          <div className="text-3xl font-bold">{teacherCount ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink/60">Students</div>
          <div className="text-3xl font-bold">{studentCount ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink/60">Classes</div>
          <div className="text-3xl font-bold">{classCount ?? 0}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink/60">Teacher invites sent</div>
          <div className="text-3xl font-bold">{invitesSent ?? 0}</div>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-2">Manage teachers</h2>
          <p className="text-sm text-ink/60 mb-3">
            Teachers can only be added by invite. Send an invite by email and they&apos;ll get an invitation link to set their password.
          </p>
          <Link href="/admin/teachers" className="btn-primary inline-block">Invite a teacher</Link>
        </div>
        <div className="card p-5">
          <h2 className="text-lg font-semibold mb-2">Manage classes</h2>
          <p className="text-sm text-ink/60 mb-3">
            Browse every class and transfer ownership when a teacher leaves or a class moves between teachers.
          </p>
          <Link href="/admin/classes" className="btn-primary inline-block">Manage classes</Link>
        </div>
      </section>
    </div>
  );
}
