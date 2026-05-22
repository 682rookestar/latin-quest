import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "./InviteForm";
import { revokeInvite } from "../actions";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default async function TeachersAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: teachers }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, created_at")
      .in("role", ["teacher", "admin"])
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_invites")
      .select("id, email, created_at, expires_at, accepted_at, accepted_by")
      .order("created_at", { ascending: false }),
  ]);

  const pending = (invites ?? []).filter((i: any) => !i.accepted_at);
  const accepted = (invites ?? []).filter((i: any) => i.accepted_at);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Teachers</h1>
        <p className="text-ink/60">
          Invite teachers by email. They&apos;ll get a magic-link signup and be auto-promoted to teacher when they click it.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Invite a teacher</h2>
        <InviteForm />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Pending invites</h2>
        {!pending.length ? (
          <p className="text-ink/60">No pending invites.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {pending.map((i: any) => {
              const expired = new Date(i.expires_at).getTime() < Date.now();
              return (
                <li key={i.id} className="p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{i.email}</div>
                    <div className="text-xs text-ink/60">
                      sent {fmtDate(i.created_at)} &middot; {expired ? <span className="text-wine">expired</span> : <>expires {fmtDate(i.expires_at)}</>}
                    </div>
                  </div>
                  <form action={revokeInvite}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="text-sm text-wine hover:underline" type="submit">Revoke</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Teachers &amp; admins</h2>
        {!teachers?.length ? (
          <p className="text-ink/60">No teachers yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {(teachers as any[]).map((t) => (
              <li key={t.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{t.display_name ?? t.email}</div>
                  <div className="text-xs text-ink/60">{t.email}</div>
                </div>
                <span className="text-xs text-ink/60">since {fmtDate(t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {accepted.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Accepted invites</h2>
          <ul className="card divide-y divide-ink/10">
            {accepted.map((i: any) => (
              <li key={i.id} className="p-3 text-sm">
                <span className="font-medium">{i.email}</span>
                <span className="text-ink/60"> &middot; accepted {fmtDate(i.accepted_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
