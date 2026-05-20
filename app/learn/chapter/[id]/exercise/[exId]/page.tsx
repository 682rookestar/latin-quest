import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ExerciseRunner from "@/components/ExerciseRunner";

export default async function ExercisePage({ params }: { params: { id: string; exId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercise } = await supabase
    .from("exercises").select("*").eq("id", params.exId).single();
  if (!exercise) notFound();

  const { data: questions } = await supabase
    .from("exercise_questions")
    .select("*")
    .eq("exercise_id", params.exId)
    .order("position");

  return (
    <ExerciseRunner
      exercise={exercise}
      questions={questions ?? []}
      backHref={`/learn/chapter/${params.id}`}
    />
  );
}
