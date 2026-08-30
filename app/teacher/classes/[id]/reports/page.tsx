import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReportingPeriod } from "./actions";

function defaultDates() {
  const now = new Date();
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    startsOn: `${year}-09-01`,
    endsOn: `${year + 1}-07-10`,
  };
}

export default async function ClassReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: klass }] = await Promise.all([
    supabase.from("profiles").select("role, disabled_at").eq("id", user.id).single(),
    supabase.from("classes").select("id, name, teacher_id, archived_at").eq("id", id).single(),
  ]);
  const isAdmin = profile?.role === "admin";
  const isOwningTeacher = profile?.role === "teacher" && klass?.teacher_id === user.id;
  if (!profile || profile.disabled_at || (!isAdmin && !isOwningTeacher)) redirect("/learn");
  if (!klass || klass.archived_at) redirect(isAdmin ? "/admin/classes" : "/teacher");

  const [{ data: periods }, { data: memberships }] = await Promise.all([
    supabase
      .from("reporting_periods")
      .select("id, name, starts_on, ends_on, due_at, status, created_at")
      .eq("class_id", id)
      .order("starts_on", { ascending: false }),
    supabase
      .from("class_members")
      .select("student_id, profiles(display_name, email)")
      .eq("class_id", id),
  ]);

  const periodIds = (periods ?? []).map((period: any) => period.id);
  const { data: reports } = periodIds.length
    ? await supabase
        .from("student_reports")
        .select("period_id, student_id, status, updated_at")
        .in("period_id", periodIds)
    : { data: [] as any[] };
  const reportMap = new Map(
    ((reports ?? []) as any[]).map((report) => [`${report.period_id}:${report.student_id}`, report])
  );
  const defaults = defaultDates();

  return (
    <div className="space-y-8">
      <div>
        <Link href={isAdmin ? "/admin/classes" : `/teacher/classes/${id}`} className="text-sm text-ink/60 hover:underline">
          &lsaquo; back to {isAdmin ? "all classes" : klass.name}
        </Link>
        <p className="h-display text-sky text-xs tracking-[0.3em] mt-5 mb-1">Reporting</p>
        <h1 className="h-display text-3xl">Pupil reports</h1>
        <p className="text-sm text-ink/60 mt-2 max-w-3xl">
          Generate evidence-led Halliford report comments from each pupil&apos;s Latin Quest activity,
          then copy the result into the school reporting system.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="h-display text-lg mb-3">Create reporting period</h2>
        <form action={createReportingPeriod} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 items-end">
          <input type="hidden" name="class_id" value={id} />
          <label className="text-sm xl:col-span-2">
            Period name
            <input className="input mt-1" name="name" placeholder="Summer Full Report 2026" minLength={2} maxLength={80} required />
          </label>
          <label className="text-sm">
            Evidence starts
            <input className="input mt-1" type="date" name="starts_on" defaultValue={defaults.startsOn} required />
          </label>
          <label className="text-sm">
            Evidence ends
            <input className="input mt-1" type="date" name="ends_on" defaultValue={defaults.endsOn} required />
          </label>
          <button type="submit" className="btn-primary">Create period</button>
        </form>
      </section>

      {!periods?.length ? (
        <div className="card p-8 text-center text-ink/60">
          Create the first reporting period to begin drafting reports.
        </div>
      ) : (
        (periods as any[]).map((period) => {
          const rows = ((memberships ?? []) as any[]).map((membership) => {
            const pupil = Array.isArray(membership.profiles) ? membership.profiles[0] : membership.profiles;
            const report = reportMap.get(`${period.id}:${membership.student_id}`) as any;
            return { membership, pupil, report };
          });
          const generated = rows.filter((row) => row.report?.status === "generated" || row.report?.status === "approved").length;
          return (
            <section key={period.id} className="card overflow-hidden">
              <header className="p-5 border-b border-ink/10 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="h-display text-xl">{period.name}</h2>
                    <span className={period.status === "open" ? "chip-olive" : "chip-wine"}>{period.status}</span>
                  </div>
                  <p className="text-xs text-ink/60 mt-1">
                    Evidence from {new Date(`${period.starts_on}T12:00:00Z`).toLocaleDateString("en-GB")} to{" "}
                    {new Date(`${period.ends_on}T12:00:00Z`).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <span className="chip-sky">{generated}/{rows.length} generated</span>
              </header>
              {!rows.length ? (
                <p className="p-5 text-sm text-ink/60">No pupils are currently enrolled in this class.</p>
              ) : (
                <div className="divide-y divide-ink/10">
                  {rows.map(({ membership, pupil, report }) => (
                    <Link
                      key={membership.student_id}
                      href={`/teacher/classes/${id}/reports/${period.id}/${membership.student_id}`}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-ink/5"
                    >
                      <div>
                        <div className="font-medium">{pupil?.display_name ?? pupil?.email ?? "Unknown pupil"}</div>
                        <div className="text-xs text-ink/50">{pupil?.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={
                          report?.status === "approved" || report?.status === "generated" ? "chip-olive" : "chip-wine"
                        }>
                          {report?.status === "approved" || report?.status === "generated" ? "generated" : "not started"}
                        </span>
                        <span className="text-ink/40">&rsaquo;</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
