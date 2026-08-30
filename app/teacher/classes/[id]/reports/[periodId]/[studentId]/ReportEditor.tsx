"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { checkHallifordStyle } from "@/lib/reporting";
import { generateStudentReport, type ReportActionResult } from "../../actions";

type ReportData = {
  current_comment: string;
  status: string;
  generated_at?: string | null;
};

function GenerateButton({ regenerating }: { regenerating: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      <button
        className="btn-primary inline-flex items-center gap-2"
        type="submit"
        disabled={pending}
        aria-describedby={pending ? "report-generation-status" : undefined}
      >
        {pending && (
          <span
            className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin"
            aria-hidden="true"
          />
        )}
        {pending ? "Generating report…" : regenerating ? "Regenerate report" : "Generate report"}
      </button>
      {pending && (
        <div
          id="report-generation-status"
          className="max-w-md rounded border border-sky/30 bg-sky/5 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-sky">Generating report from Latin Quest evidence…</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-sky" />
          </div>
          <p className="mt-2 text-xs text-ink/50">This usually takes around 30 seconds. Keep this page open.</p>
        </div>
      )}
    </div>
  );
}

export default function ReportEditor({
  classId,
  periodId,
  studentId,
  preferredName,
  report,
}: {
  classId: string;
  periodId: string;
  studentId: string;
  preferredName: string;
  report: ReportData;
}) {
  const [generateState, generateAction] = useFormState<ReportActionResult | null, FormData>(generateStudentReport, null);
  const [copied, setCopied] = useState(false);
  const comment = report.current_comment ?? "";
  const checks = useMemo(() => checkHallifordStyle(comment, preferredName), [comment, preferredName]);

  async function copyReport() {
    if (!comment) return;
    await navigator.clipboard.writeText(comment);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section className="card p-5 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="h-display text-xl">AI report comment</h2>
          <p className="text-sm text-ink/60 mt-1 max-w-2xl">
            Latin Quest generates this from the pupil&apos;s activity, accuracy, mastery and badges for the selected period. No teacher notes are required.
          </p>
        </div>
        {comment && <span className="chip-gold">generated</span>}
      </div>

      {!comment ? (
        <div className="rounded border border-ink/10 bg-ink/5 p-5 text-sm text-ink/60">
          Select <strong>Generate report</strong> to create a comment from the evidence shown above.
        </div>
      ) : (
        <textarea
          className="input min-h-56 leading-6"
          value={comment}
          readOnly
          aria-label={`Generated report comment for ${preferredName}`}
        />
      )}

      {comment && (
        <div className="grid md:grid-cols-2 gap-2">
          {checks.map((check, index) => (
            <div
              key={`${check.message}-${index}`}
              className={`rounded border px-3 py-2 text-xs ${
                check.level === "error" ? "border-wine/40 bg-wine/5 text-wine" :
                check.level === "warning" ? "border-gold/30 bg-gold/5 text-gold" :
                "border-olive/30 bg-olive/5 text-olive"
              }`}
            >
              {check.message}
            </div>
          ))}
        </div>
      )}

      <form action={generateAction} className="flex flex-wrap gap-3 items-center">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="period_id" value={periodId} />
        <input type="hidden" name="student_id" value={studentId} />
        <GenerateButton regenerating={Boolean(comment)} />
        {comment && (
          <button className="btn-gold" type="button" onClick={copyReport}>
            {copied ? "Copied" : "Copy report"}
          </button>
        )}
        {generateState && (
          <p className={`text-sm ${generateState.ok ? "text-olive" : "text-wine"}`} role="status">
            {generateState.message}
          </p>
        )}
      </form>

      <p className="text-xs text-ink/50">
        Copy the generated text into the school reporting system. Latin Quest cannot observe classroom conduct or pastoral circumstances, so it will not invent them.
      </p>
    </section>
  );
}
