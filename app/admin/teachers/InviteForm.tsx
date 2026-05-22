"use client";
import { useFormState, useFormStatus } from "react-dom";
import { inviteTeacher } from "../actions";

type Result = { ok: boolean; message: string };

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending} type="submit">
      {pending ? "Sending…" : "Send invite"}
    </button>
  );
}

export default function InviteForm() {
  const [state, formAction] = useFormState<Result | null, FormData>(inviteTeacher, null);
  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-3">
        <input
          className="input flex-1"
          type="email"
          name="email"
          placeholder="teacher@example.com"
          required
        />
        <SubmitBtn />
      </div>
      {state && (
        <p className={`text-sm ${state.ok ? "text-olive" : "text-wine"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
