import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "./PasswordForm";
import MfaManager from "./MfaManager";
import { parseStudentPasswordStatus } from "@/lib/student-password";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: passwordStatusData, error: passwordStatusError } = await supabase.rpc("student_password_status");
  const passwordStatus = parseStudentPasswordStatus(passwordStatusData);
  if (passwordStatusError || !passwordStatus) throw new Error("Password access could not be confirmed. Please try again.");
  if (!passwordStatus.session_valid) redirect("/login?error=password_reset");
  if (passwordStatus.required) redirect("/account/change-password");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-md mx-auto space-y-8">
      <header>
        <p className="h-display text-sky text-xs tracking-[0.3em] mb-1">Civis</p>
        <h1 className="h-display text-3xl">Account</h1>
        <p className="text-ink/60">
          Signed in as <span className="font-medium">{user.email}</span>
          {profile?.role && (
            <span className="ml-2 chip-wine">{profile.role}</span>
          )}
        </p>
      </header>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Set password</h2>
        <p className="text-sm text-ink/60">
          Pick a password so you can sign in next time without needing an invite link.
        </p>
        <PasswordForm />
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="font-semibold">Authenticator app</h2>
        <p className="text-sm text-ink/60">
          Two-step verification is required for teachers and administrators and optional for pupils.
        </p>
        <MfaManager required={["teacher", "admin"].includes(profile?.role ?? "")} />
      </section>
    </div>
  );
}
