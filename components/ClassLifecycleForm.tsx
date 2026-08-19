"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  manageClassLifecycle,
  type ClassLifecycleResult,
} from "@/app/teacher/actions";

type LifecycleAction = "archive" | "restore" | "delete";

const labels: Record<LifecycleAction, string> = {
  archive: "Archive class",
  restore: "Restore class",
  delete: "Permanently delete class",
};

function SubmitButton({
  action,
  enabled,
}: {
  action: LifecycleAction;
  enabled: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!enabled || pending}
      className={action === "delete" ? "btn-primary bg-wine" : "btn-primary"}
    >
      {pending ? "Working…" : labels[action]}
    </button>
  );
}

export default function ClassLifecycleForm({
  classId,
  className,
  action,
  compact = false,
}: {
  classId: string;
  className: string;
  action: LifecycleAction;
  compact?: boolean;
}) {
  const [state, formAction] = useFormState<ClassLifecycleResult | null, FormData>(
    manageClassLifecycle,
    null
  );
  const [confirmation, setConfirmation] = useState("");
  const expected = action === "delete" ? `DELETE ${className}` : className;

  return (
    <form action={formAction} className={compact ? "space-y-2" : "space-y-3"}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="lifecycle_action" value={action} />
      <label className="block text-sm">
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
      <SubmitButton action={action} enabled={confirmation === expected} />
      {state && (
        <p className={`text-sm ${state.ok ? "text-olive" : "text-wine"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
