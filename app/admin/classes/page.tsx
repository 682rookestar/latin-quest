import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TransferOwnerForm from "./TransferOwnerForm";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function AdminClasses() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: classes }, { data: ownersData }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, join_code, teacher_id, created_at, profiles!classes_teacher_id_fkey(display_name, email), class_members(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, email, role")
      .in("role", ["teacher", "admin"])
      .order("display_name"),
  ]);

  const owners = ((ownersData as any[]) ?? []).map((o) => ({
    id: o.id,
    label: `${o.display_name ?? o.email}${o.role === "admin" ? " (admin)" : ""} — ${o.email}`,
  }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Classes</h1>
        <p className="text-ink/60">
          All classes across teachers. Use the dropdown to transfer ownership;
          the previous owner loses edit rights immediately.
        </p>
      </header>

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
              return (
                <li key={c.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-medium">
                        {c.name}{" "}
                        <span className="chip-gold ml-1">{c.join_code}</span>
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
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="text-xs underline text-ink/60 hover:text-ink"
                    >
                      Open class
                    </Link>
                  </div>
                  <TransferOwnerForm
                    classId={c.id}
                    currentOwnerId={c.teacher_id}
                    owners={owners}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
