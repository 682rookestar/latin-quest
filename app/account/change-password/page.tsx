import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseStudentPasswordStatus } from "@/lib/student-password";
import TemporaryPasswordForm from "./TemporaryPasswordForm";

export default async function ChangeStudentPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.rpc("student_password_status");
  const status = parseStudentPasswordStatus(data);
  if (error || !status) throw new Error("Password access could not be confirmed. Please try again.");
  if (!status.session_valid) redirect("/login?error=password_reset");
  if (!status.required) redirect("/account");
  return <section className="card p-6 max-w-md mx-auto space-y-5">
    <header><p className="text-xs text-gold uppercase tracking-wider mb-2">Keep your account secure</p>
      <h1 className="h-display text-2xl">Choose your own password</h1>
      <p className="text-sm text-ink/70 mt-3">Your teacher gave you a temporary password. Replace it with your own before returning to your activities.</p>
    </header>
    {status.expired ? <p role="alert" className="text-wine">Your temporary password has expired. Ask your teacher for a new one.</p>
      : status.busy ? <p role="status">A password reset is in progress. Wait two minutes, then refresh this page.</p>
      : <TemporaryPasswordForm />}
  </section>;
}
