"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function joinClass(formData: FormData): Promise<void> {
  // Strip whitespace and uppercase. The RPC also normalises, but doing it
  // here keeps the rate-limit accounting honest (junk input still counts).
  const raw = ((formData.get("code") as string) || "")
    .replace(/\s+/g, "")
    .toUpperCase();
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
    // The RPC raises 'rate_limited' when a user has tried too many codes
    // in a short window. Every other error gets a generic message so we
    // don't leak DB internals or hint at which codes exist.
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("rate_limited")) {
      redirect("/learn/join?error=ratelimited");
    }
    redirect("/learn/join?error=invalid");
  }
  if (!data) {
    // Empty result = code unknown or expired. Same generic error.
    redirect("/learn/join?error=invalid");
  }

  revalidatePath("/learn");
  redirect("/learn");
}
