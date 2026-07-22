import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasAal2 } from "@/lib/auth-security";

export default async function DashboardRedirect() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (["admin", "teacher"].includes(profile?.role ?? "") && !(await hasAal2(supabase))) {
    redirect("/account?mfa=required");
  }
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "teacher") redirect("/teacher");
  redirect("/learn");
}
