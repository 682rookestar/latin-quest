"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { checkHallifordStyle } from "@/lib/reporting";
import {
  approveStudentReport,
  generateStudentReport,
  saveStudentReport,
  type ReportActionResult,
} from "../../actions";

type ReportData = {
  bfl_engagement: number | null;
  bfl_classwork: number | null;
  bfl_independent_study: number | null;
  progress_grade: number | null;
  lesson_observations: string;
  strengths: string;
  improvement_targets: string;
  school_values: string;
  bene_notes: string;
  current_comment: string;
  status: string;
};

function SelectGrade({ name, value, max }: { name: string; value: number | null; max: number }) {
  return (
    <select className="input mt-1" name={name} defaultValue={value ?? ""}>
      <option value="">Not set</option>
      {Array.from({ length: max }, (_, index) => index + 1).map((grade) => (
        <option key={grade} value={grade}>{grade}</option>
      ))}
    </select>
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
  const [comment, setComment] = useState(report.current_comment ?? "");
  const [saveState, saveAction] = useFormState<ReportActionResult | null, FormData>(saveStudentReport, null);
  const [generateState, generateAction] = useFormState<ReportActionResult | null, FormData>(generateStudentReport, null);
  const [approveState, approveAction] = useFormState<ReportActionResult | null, FormData>(approveStudentReport, null);
  const checks = useMemo(() => checkHallifordStyle(comment, preferredName), [comment, preferredName]);
  const state = approveState ?? generateState ?? saveState;

  return (
    <form action={saveAction} className="space-y-6">
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="period_id" value={periodId} />
      <input type="hidden" name="student_id" value={studentId} />

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="h-display text-xl">Teacher evidence</h2>
          <p className="text-sm text-ink/60 mt-1">Add observations that Latin Quest cannot measure. Blank fields are never guessed.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-sm">BfL Engagement (1-5)<SelectGrade name="bfl_engagement" value={report.bfl_engagement} max={5} /></label>
          <label className="text-sm">BfL Quality of Classwork (1-5)<SelectGrade name="bfl_classwork" value={report.bfl_classwork} max={5} /></label>
          <label className="text-sm">BfL Independent Study (1-5)<SelectGrade name="bfl_independent_study" value={report.bfl_independent_study} max={5} /></label>
          <label className="text-sm">Progress Grade (1-9)<SelectGrade name="progress_grade" value={report.progress_grade} max={9} /></label>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">Lesson personality and engagement<textarea className="input mt-1 min-h-24" name="lesson_observations" defaultValue={report.lesson_observations} maxLength={4000} /></label>
          <label className="text-sm">Strengths and best work<textarea className="input mt-1 min-h-24" name="strengths" defaultValue={report.strengths} maxLength={4000} /></label>
          <label className="text-sm">Tangible improvement target<textarea className="input mt-1 min-h-24" name="improvement_targets" defaultValue={report.improvement_targets} maxLength={4000} /></label>
          <label className="text-sm">School values demonstrated<textarea className="input mt-1 min-h-24" name="school_values" defaultValue={report.school_values} maxLength={4000} /></label>
          <label className="text-sm md:col-span-2">Bene awards or other relevant achievements<textarea className="input mt-1 min-h-20" name="bene_notes" defaultValue={report.bene_notes} maxLength={4000} /></label>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="h-display text-xl">Report comment</h2>
            <p className="text-sm text-ink/60 mt-1">AI drafts must be reviewed and approved by the teacher.</p>
          </div>
          <span className={report.status === "approved" ? "chip-olive" : report.status === "generated" ? "chip-gold" : "chip-wine"}>
            {report.status}
          </span>
        </div>
        <textarea
          className="input min-h-56 leading-6"
          name="current_comment"
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 1200))}
          maxLength={1200}
          placeholder="Generate a draft or write the report comment here."
        />
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
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" type="submit">Save observations</button>
          <button className="btn-gold" type="submit" formAction={generateAction}>Generate AI draft</button>
          <button className="btn-primary" type="submit" formAction={approveAction} disabled={report.status === "approved"}>
            {report.status === "approved" ? "Approved" : "Approve final comment"}
          </button>
        </div>
        {state && <p className={`text-sm ${state.ok ? "text-olive" : "text-wine"}`} role="status">{state.message}</p>}
      </section>
    </form>
  );
}
