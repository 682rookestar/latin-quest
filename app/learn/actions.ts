"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function joinClass(formData: FormData): Promise<void> {
  const raw = ((formData.get("code") as string) || "").trim().toUpperCase();
  if (!raw) {
    redirect("/learn/join?error=missing");
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("join_code", raw)
    .maybeSingle();
  if (!cls) redirect("/learn/join?error=notfound");

  const { error: e2 } = await supabase
    .from("class_members")
    .upsert({ class_id: cls.id, student_id: user.id });
  if (e2) redirect("/learn/join?error=" + encodeURIComponent(e2.message));

  revalidatePath("/learn");
  redirect("/learn");
}
