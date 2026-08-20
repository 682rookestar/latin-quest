import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "./InviteForm";
import CopyLinkButton from "./CopyLinkButton";
import ResetPasswordButton from "./ResetPasswordButton";
import { revokeInvite } from "../actions";
import PageHero from "@/components/PageHero";
import TeacherAccountActions from "./TeacherAccountActions";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default async function TeachersAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [
    { data: teachers },
    { data: invites },
    { data: ownedClasses },
    { data: accountAudit },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, display_name, created_at, role, disabled_at")
      .in("role", ["teacher", "admin"])
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_invites")
      .select("id, email, created_at, expires_at, accepted_at, accepted_by, action_link, action_link_sent_at")
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("teacher_id"),
    supabase
      .from("teacher_account_audit")
      .select("id, target_email, target_display_name, actor_email, action, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  const classCounts = new Map<string, number>();
  for (const klass of (ownedClasses as any[]) ?? []) {
    classCounts.set(klass.teacher_id, (classCounts.get(klass.teacher_id) ?? 0) + 1);
  }

  // Match invites against profiles so we can tell who has actually
  // become a teacher vs. is still mid-signup. With admin.generateLink
  // the profile is provisioned at invite time, so an invite is
  // "active" until the link is consumed or the row is revoked.
  const teacherEmails = new Set(
    ((teachers as any[]) ?? []).map((t) => t.email?.toLowerCase()).filter(Boolean)
  );

  return (
    <div className="space-y-8">
      <PageHero
        latinTag="Magistri"
        title="Teachers"
        subtitle="Invite teachers by email. They'll receive an invitation link to set their password and finish signup. If their email scanner kills the link, copy the backup link below and DM it to them instead."
        variant="colosseum"
      />

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Invite a teacher</h2>
        <InviteForm />
      </section>

      <section>
        <h2 className="h-display text-xl mb-3">Sent invites</h2>
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
                    {/* Only pending (not-yet-accepted) invites can be revoked.
                        Removing an established teacher requires a separate
                        admin workflow to handle class transfer safely. */}
                    {!i.accepted_by ? (
                      <form action={revokeInvite}>
                        <input type="hidden" name="id" value={i.id} />
                        <button
                          className="text-sm text-wine hover:underline"
                          type="submit"
                        >
                          Revoke
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-ink/30">account active</span>
                    )}
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
        <h2 className="h-display text-xl mb-3">Teachers &amp; admins</h2>
        {!teachers?.length ? (
          <p className="text-ink/60">No teachers yet.</p>
        ) : (
          <ul className="card divide-y divide-ink/10">
            {(teachers as any[]).map((t) => {
              const canReset = t.role === "teacher" && t.id !== user.id;
              const classCount = classCounts.get(t.id) ?? 0;
              return (
                <li key={t.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {t.display_name ?? t.email}
                        {t.role === "admin" && (
                          <span className="ml-2 chip-gold">admin</span>
                        )}
                        {t.disabled_at && (
                          <span className="ml-2 chip-wine">disabled</span>
                        )}
                      </div>
                      <div className="text-xs text-ink/60">{t.email}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-ink/60">
                        since {fmtDate(t.created_at)}
                      </span>
                      {canReset && (
                        <ResetPasswordButton targetId={t.id} email={t.email} />
                      )}
                    </div>
                  </div>
                  {canReset && (
                    <TeacherAccountActions
                      targetId={t.id}
                      email={t.email}
                      disabledAt={t.disabled_at}
                      classCount={classCount}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="h-display text-xl mb-1">Teacher account audit</h2>
        <p className="text-sm text-ink/60 mb-3">
          Administrator actions are retained even after a teacher account is removed.
        </p>
        {!accountAudit?.length ? (
          <p className="text-ink/60">No teacher account actions recorded yet.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b border-ink/10">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Teacher</th>
                  <th className="p-3">Administrator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {(accountAudit as any[]).map((entry) => (
                  <tr key={entry.id}>
                    <td className="p-3 whitespace-nowrap">{fmtDate(entry.occurred_at)}</td>
                    <td className="p-3 capitalize">{entry.action}</td>
                    <td className="p-3">{entry.target_display_name ?? entry.target_email}</td>
                    <td className="p-3">{entry.actor_email ?? "Removed administrator"}</td>
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
