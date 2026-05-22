"use client";
import { useFormState, useFormStatus } from "react-dom";
import { transferClassOwnership } from "../actions";

type Owner = {
  id: string;
  label: string; // e.g. "Alex Rooke (dramateacha@gmail.com)"
};

type Result = { ok: boolean; message: string };

function SubmitBtn({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="text-sm text-wine hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={pending || disabled}
      onClick={(e) => {
        if (
          !window.confirm(
            "Transfer ownership of this class? The previous owner will lose edit access."
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Transferring…" : "Transfer"}
    </button>
  );
}

export default function TransferOwnerForm({
  classId,
  currentOwnerId,
  owners,
}: {
  classId: string;
  currentOwnerId: string;
  owners: Owner[];
}) {
  const [state, formAction] = useFormState<Result | null, FormData>(
    transferClassOwnership,
    null
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="class_id" value={classId} />
      <select
        name="new_owner_id"
        defaultValue={currentOwnerId}
        className="input text-sm py-1"
      >
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <SubmitBtn disabled={false} />
      {state && (
        <span
          className={`text-xs ${state.ok ? "text-olive" : "text-wine"}`}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
