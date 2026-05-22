"use client";
import { useFormState, useFormStatus } from "react-dom";
import { resetTeacherPassword } from "../actions";
import CopyLinkButton from "./CopyLinkButton";

type Result = {
  ok: boolean;
  message: string;
  tempPassword?: string;
};

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
            "Reset this teacher's password? Their current password (if any) will stop working immediately."
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
  const [state, formAction] = useFormState<Result | null, FormData>(
    resetTeacherPassword,
    null
  );

  // Once we have a temp password to reveal, replace the button with
  // a small panel showing it + a copy button + a dismiss button.
  if (state?.ok && state.tempPassword) {
    return (
      <div className="rounded border border-olive/30 bg-olive/5 px-3 py-2 text-xs space-y-1 max-w-md">
        <div className="text-ink/70">
          Temp password for <span className="font-mono">{email}</span> &mdash;
          copy and DM it to them:
        </div>
        <div className="flex items-center gap-3">
          <code className="font-mono text-sm flex-1">{state.tempPassword}</code>
          <CopyLinkButton link={state.tempPassword} label="Copy" />
        </div>
        <div className="text-ink/60">
          Ask them to set their own password from <span className="font-mono">/account</span> after signing in.
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
