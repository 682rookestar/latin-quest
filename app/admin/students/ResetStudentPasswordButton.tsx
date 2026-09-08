"use client";

import { useFormState, useFormStatus } from "react-dom";
import CopyLinkButton from "../teachers/CopyLinkButton";
import { resetStudentPassword, type StudentPasswordResetResult } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="text-sm text-wine hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm("Create a one-time password recovery link for this pupil? Share it only with the pupil or an authorised parent, guardian, or member of staff.")) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Creating link…" : "Reset password"}
    </button>
  );
}

export default function ResetStudentPasswordButton({ studentId, email }: { studentId: string; email: string }) {
  const [state, formAction] = useFormState<StudentPasswordResetResult | null, FormData>(resetStudentPassword, null);

  if (state?.ok && state.recoveryLink) {
    return (
      <div className="rounded border border-olive/30 bg-olive/5 px-3 py-2 text-xs space-y-1 max-w-xl">
        <div>One-time recovery link for <span className="font-mono">{email}</span>:</div>
        <div className="flex items-center gap-3">
          <code className="font-mono text-xs flex-1 truncate">{state.recoveryLink}</code>
          <CopyLinkButton link={state.recoveryLink} label="Copy link" />
        </div>
        <div className="text-ink/60">Send it privately. The link can be used to set a new password on the Account page.</div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="student_id" value={studentId} />
      <SubmitButton />
      {state && !state.ok && <p className="text-wine text-xs mt-1">{state.message}</p>}
    </form>
  );
}

