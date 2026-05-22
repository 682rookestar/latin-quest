"use client";
import { useFormState, useFormStatus } from "react-dom";
import { inviteTeacher } from "../actions";
import CopyLinkButton from "./CopyLinkButton";

type Result = { ok: boolean; message: string; link?: string | null };

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
        <div className={`text-sm ${state.ok ? "text-olive" : "text-wine"}`}>
          <p>{state.message}</p>
          {state.ok && state.link && (
            <div className="mt-2 p-3 rounded border border-ink/10 bg-parchment/60">
              <div className="text-xs text-ink/70 mb-1">
                Backup link (give this to the teacher if the email doesn&apos;t arrive):
              </div>
              <div className="flex items-center gap-3">
                <code className="text-xs break-all flex-1 text-ink/80">{state.link}</code>
                <CopyLinkButton link={state.link} />
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
