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

  const { data, error } = await supabase
    .rpc("join_class_by_code", { p_code: raw })
    .maybeSingle();

  if (error) {
    redirect("/learn/join?error=" + encodeURIComponent(error.message));
  }
  if (!data) {
    redirect("/learn/join?error=notfound");
  }

  revalidatePath("/learn");
  redirect("/learn");
}
