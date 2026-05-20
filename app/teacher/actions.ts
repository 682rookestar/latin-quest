"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function createClass(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Try a few times in case of code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const join_code = makeJoinCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({ teacher_id: user.id, name, join_code })
      .select("id")
      .single();
    if (!error && data) {
      revalidatePath("/teacher");
      redirect(`/teacher/classes/${data.id}`);
    }
    if (error && !error.message.includes("duplicate")) {
      throw new Error(error.message);
    }
  }
  throw new Error("Could not allocate a unique join code");
}
