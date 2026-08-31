"use client";
import { useFormState, useFormStatus } from "react-dom";
import { resetTeacherPassword, type TeacherPasswordResetResult } from "../actions";
import CopyLinkButton from "./CopyLinkButton";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="text-sm text-wine hover:underline disabled:opacity-50"
      disabled={pending}
      // Confirm with the admin so a stray click doesn't lock the
      // teacher out of their existing session.
      onClick={(e) => {
        if (
          !window.confirm(
            "Create a one-time password recovery link for this teacher? Share the link only with the intended teacher."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Resetting…" : "Reset password"}
    </button>
  );
}

export default function ResetPasswordButton({
  targetId,
  email,
}: {
  targetId: string;
  email: string;
}) {
  const [state, formAction] = useFormState<TeacherPasswordResetResult | null, FormData>(
    resetTeacherPassword,
    null
  );

  if (state?.ok && state.recoveryLink) {
    return (
      <div className="rounded border border-olive/30 bg-olive/5 px-3 py-2 text-xs space-y-1 max-w-md">
        <div className="text-ink/70">
          One-time recovery link for <span className="font-mono">{email}</span>:
        </div>
        <div className="flex items-center gap-3">
          <code className="font-mono text-xs flex-1 truncate">{state.recoveryLink}</code>
          <CopyLinkButton link={state.recoveryLink} label="Copy link" />
        </div>
        <div className="text-ink/60">
          Send it privately. The teacher should open it and set a new password on the Account page.
        </div>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="target_id" value={targetId} />
      <SubmitBtn />
      {state && !state.ok && (
        <p className="text-wine text-xs mt-1">{state.message}</p>
      )}
    </form>
  );
}
