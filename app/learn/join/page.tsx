import { joinClass } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Please enter a code.",
  invalid: "That code isn't valid or has expired. Ask your teacher for the latest one.",
  ratelimited: "Too many attempts. Wait a minute and try again.",
  // legacy keys kept so old bookmarked URLs still show something sensible
  notfound: "That code isn't valid or has expired. Ask your teacher for the latest one.",
};

export default function JoinPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorKey = searchParams?.error;
  const msg = errorKey ? (ERROR_MESSAGES[errorKey] ?? "That code isn't valid. Please try again.") : null;
  return (
    <div className="max-w-md mx-auto card p-6 mt-12">
      <p className="h-display text-sky text-xs tracking-[0.3em] mb-2">Enrol</p>
      <h1 className="h-display text-2xl">Join a class</h1>
      <p className="text-sm text-ink/60 mb-4">Enter the code your teacher gave you.</p>
      {msg && <p className="text-wine text-sm mb-3">{msg}</p>}
      <form action={joinClass} className="space-y-3">
        <input
          className="input uppercase tracking-widest text-center text-lg font-mono"
          name="code"
          maxLength={12}
          placeholder="ABCD234XYZ"
          required
          autoComplete="off"
        />
        <button className="btn-primary w-full">Join class</button>
      </form>
    </div>
  );
}
