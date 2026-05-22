import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PasswordForm from "./PasswordForm";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="max-w-md mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Account</h1>
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
    </div>
  );
}
