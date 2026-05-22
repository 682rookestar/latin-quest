import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "./InviteForm";
import CopyLinkButton from "./CopyLinkButton";
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
      .select("id, email, display_name, created_at, role")
      .in("role", ["teacher", "admin"])
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_invites")
      .select("id, email, created_at, expires_at, accepted_at, accepted_by, action_link, action_link_sent_at")
      .order("created_at", { ascending: false }),
  ]);

  // Match invites against profiles so we can tell who has actually
  // become a teacher vs. is still mid-signup. With admin.generateLink
  // the profile is provisioned at invite time, so an invite is
  // "active" until the link is consumed or the row is revoked.
  const teacherEmails = new Set(
    ((teachers as any[]) ?? []).map((t) => t.email?.toLowerCase()).filter(Boolean)
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Teachers</h1>
        <p className="text-ink/60">
          Invite teachers by email. They&apos;ll receive an invitation link to set their password and finish signup.
          If their email scanner kills the link, copy the backup link below and DM it to them instead.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Invite a teacher</h2>
        <InviteForm />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Sent invites</h2>
        {!invites?.length ? (
          <p className="text-ink/60">No invites yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {(invites as any[]).map((i) => {
              const provisioned = teacherEmails.has(i.email?.toLowerCase());
              return (
                <li key={i.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{i.email}</div>
                      <div className="text-xs text-ink/60">
                        sent {fmtDate(i.action_link_sent_at ?? i.created_at)}
                        {provisioned ? (
                          <span className="ml-2 chip-olive">teacher account ready</span>
                        ) : (
                          <span className="ml-2 chip-wine">awaiting signup</span>
                        )}
                      </div>
                    </div>
                    <form action={revokeInvite}>
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        className="text-sm text-wine hover:underline"
                        type="submit"
                      >
                        Revoke
                      </button>
                    </form>
                  </div>
                  {i.action_link && (
                    <div className="flex items-center gap-3 text-xs">
                      <code className="break-all flex-1 text-ink/70">{i.action_link}</code>
                      <CopyLinkButton link={i.action_link} />
                    </div>
                  )}
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
                  <div className="font-medium">
                    {t.display_name ?? t.email}
                    {t.role === "admin" && <span className="ml-2 chip-gold">admin</span>}
                  </div>
                  <div className="text-xs text-ink/60">{t.email}</div>
                </div>
                <span className="text-xs text-ink/60">since {fmtDate(t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
