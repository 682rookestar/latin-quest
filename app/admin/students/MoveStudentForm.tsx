"use client";

import { useFormState, useFormStatus } from "react-dom";
import { moveStudent, type StudentActionResult } from "../actions";

type ClassOption = { id: string; name: string };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="text-sm text-wine hover:underline disabled:opacity-50"
      disabled={pending || disabled}
      onClick={(event) => {
        if (!window.confirm("Move this pupil? Their existing class memberships will be replaced, but their learning history will be preserved.")) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Moving…" : "Move pupil"}
    </button>
  );
}

export default function MoveStudentForm({
  studentId,
  currentClassId,
  classes,
}: {
  studentId: string;
  currentClassId: string | null;
  classes: ClassOption[];
}) {
  const [state, formAction] = useFormState<StudentActionResult | null, FormData>(moveStudent, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="student_id" value={studentId} />
      <select name="new_class_id" defaultValue={currentClassId ?? ""} className="input text-sm py-1 min-w-52" required>
        <option value="" disabled>Select a class</option>
        {classes.map((klass) => (
          <option key={klass.id} value={klass.id}>{klass.name}</option>
        ))}
      </select>
      <SubmitButton disabled={classes.length === 0} />
      {state && <span className={`text-xs ${state.ok ? "text-olive" : "text-wine"}`}>{state.message}</span>}
    </form>
  );
}

