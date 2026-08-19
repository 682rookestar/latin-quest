import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TransferOwnerForm from "./TransferOwnerForm";
import PageHero from "@/components/PageHero";
import ClassLifecycleForm from "@/components/ClassLifecycleForm";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function AdminClasses() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: classes }, { data: ownersData }, { data: auditData }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, join_code, teacher_id, created_at, archived_at, deletion_scheduled_at, profiles!classes_teacher_id_fkey(display_name, email), class_members(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, email, role")
      .in("role", ["teacher", "admin"])
      .order("display_name"),
    supabase
      .from("class_lifecycle_audit")
      .select("id, class_name, actor_email, actor_role, action, member_count, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  const owners = ((ownersData as any[]) ?? []).map((o) => ({
    id: o.id,
    label: `${o.display_name ?? o.email}${o.role === "admin" ? " (admin)" : ""} — ${o.email}`,
  }));

  return (
    <div className="space-y-8">
      <PageHero
        latinTag="Classes"
        title="Classes"
        subtitle="All classes across teachers. Use the dropdown to transfer ownership; the previous owner loses edit rights immediately."
        variant="colosseum"
      />

      <section>
        {!classes?.length ? (
          <p className="text-ink/60">No classes yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {(classes as any[]).map((c) => {
              const ownerP: any = Array.isArray(c.profiles)
                ? c.profiles[0]
                : c.profiles;
              const ownerName =
                ownerP?.display_name ?? ownerP?.email ?? "Unknown";
              const count = (c.class_members as any)?.[0]?.count ?? 0;
              const archived = Boolean(c.archived_at);
              const deletionAt = c.deletion_scheduled_at
                ? new Date(c.deletion_scheduled_at)
                : null;
              const canDelete = deletionAt ? deletionAt.getTime() <= Date.now() : false;
              return (
                <li key={c.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium">
                        {c.name}{" "}
                        <span className={archived ? "chip-olive ml-1" : "chip-gold ml-1"}>
                          {archived ? "Archived" : c.join_code}
                        </span>
                      </div>
                      <div className="text-xs text-ink/60">
                        owner: <span className="font-medium">{ownerName}</span>
                        {ownerP?.email && (
                          <span className="text-ink/50"> · {ownerP.email}</span>
                        )}
                        <span className="ml-2">
                          · {count} student{count === 1 ? "" : "s"}
                        </span>
                        <span className="ml-2">
                          · created {fmtDate(c.created_at)}
                        </span>
                      </div>
                    </div>
                    {!archived && (
                      <Link
                        href={`/teacher/classes/${c.id}`}
                        className="text-xs underline text-ink/60 hover:text-ink"
                      >
                        Open class
                      </Link>
                    )}
                  </div>
                  {!archived ? (
                    <>
                      <TransferOwnerForm
                        classId={c.id}
                        currentOwnerId={c.teacher_id}
                        owners={owners}
                      />
                      <details className="text-sm">
                        <summary className="cursor-pointer text-wine">Archive class</summary>
                        <div className="mt-2 max-w-xl">
                          <p className="text-xs text-ink/60 mb-2">
                            The join code will stop immediately. Memberships, attempts, and progress remain recoverable for 30 days.
                          </p>
                          <ClassLifecycleForm classId={c.id} className={c.name} action="archive" compact />
                        </div>
                      </details>
                    </>
                  ) : (
                    <div className="space-y-4 max-w-xl">
                      <p className="text-xs text-ink/60">
                        {canDelete
                          ? "The 30-day recovery period has ended."
                          : `Recoverable until ${fmtDate(c.deletion_scheduled_at)}.`}
                        {" "}Attempts and progress records are retained even after the class is deleted.
                      </p>
                      {!canDelete && (
                        <ClassLifecycleForm classId={c.id} className={c.name} action="restore" compact />
                      )}
                      {canDelete && (
                        <ClassLifecycleForm classId={c.id} className={c.name} action="delete" compact />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h-display text-xl mb-1">Class lifecycle audit</h2>
        <p className="text-sm text-ink/60 mb-3">
          A tamper-resistant record of archive, restore, and permanent deletion actions.
        </p>
        {!auditData?.length ? (
          <p className="text-ink/60">No lifecycle actions recorded yet.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b border-ink/10">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Class</th>
                  <th className="p-3">Staff account</th>
                  <th className="p-3">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {(auditData as any[]).map((entry) => (
                  <tr key={entry.id}>
                    <td className="p-3 whitespace-nowrap">{new Date(entry.occurred_at).toLocaleString()}</td>
                    <td className="p-3 capitalize">{entry.action}</td>
                    <td className="p-3 font-medium">{entry.class_name}</td>
                    <td className="p-3">{entry.actor_email ?? `Deleted ${entry.actor_role} account`}</td>
                    <td className="p-3">{entry.member_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
