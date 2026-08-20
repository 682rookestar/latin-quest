"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  manageTeacherAccount,
  type TeacherAccountResult,
} from "../actions";

type AccountAction = "disable" | "restore" | "remove";

function SubmitButton({ enabled, action }: { enabled: boolean; action: AccountAction }) {
  const { pending } = useFormStatus();
  const labels: Record<AccountAction, string> = {
    disable: "Disable teacher",
    restore: "Restore teacher",
    remove: "Permanently remove teacher",
  };
  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className={action === "restore" ? "btn-primary" : "btn-primary bg-wine"}
    >
      {pending ? "Working…" : labels[action]}
    </button>
  );
}

function AccountActionForm({
  targetId,
  email,
  action,
}: {
  targetId: string;
  email: string;
  action: AccountAction;
}) {
  const [state, formAction] = useFormState<TeacherAccountResult | null, FormData>(
    manageTeacherAccount,
    null
  );
  const [confirmation, setConfirmation] = useState("");
  const expected = action === "remove" ? `DELETE ${email}` : email;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="account_action" value={action} />
      <label className="block text-xs">
        Type <strong className="font-mono">{expected}</strong> to confirm
        <input
          className="input mt-1 w-full"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </label>
      <SubmitButton enabled={confirmation === expected} action={action} />
      {state && (
        <p className={`text-xs ${state.ok ? "text-olive" : "text-wine"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export default function TeacherAccountActions({
  targetId,
  email,
  disabledAt,
  classCount,
}: {
  targetId: string;
  email: string;
  disabledAt: string | null;
  classCount: number;
}) {
  return (
    <div className="space-y-3">
      {!disabledAt ? (
        <details>
          <summary className="cursor-pointer text-sm text-wine">Disable teacher</summary>
          <div className="mt-2 max-w-xl">
            <p className="text-xs text-ink/60 mb-2">
              Immediately blocks login, classes, pupil data and staff actions. This can be reversed.
            </p>
            <AccountActionForm targetId={targetId} email={email} action="disable" />
          </div>
        </details>
      ) : (
        <>
          <AccountActionForm targetId={targetId} email={email} action="restore" />
          <details>
            <summary className="cursor-pointer text-sm text-wine">Permanently remove teacher</summary>
            <div className="mt-2 max-w-xl">
              {classCount > 0 ? (
                <p className="text-xs text-wine">
                  This teacher still owns {classCount} class{classCount === 1 ? "" : "es"}. Transfer or delete those classes first.
                </p>
              ) : (
                <>
                  <p className="text-xs text-ink/60 mb-2">
                    Permanently deletes the login and profile. Student progress and audit records remain.
                  </p>
                  <AccountActionForm targetId={targetId} email={email} action="remove" />
                </>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
