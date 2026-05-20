import { joinClass } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Please enter a code.",
  notfound: "We couldn't find a class with that code.",
};

export default function JoinPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorKey = searchParams?.error;
  const msg = errorKey ? (ERROR_MESSAGES[errorKey] ?? decodeURIComponent(errorKey)) : null;
  return (
    <div className="max-w-md mx-auto card p-6 mt-12">
      <h1 className="text-2xl font-bold">Join a class</h1>
      <p className="text-sm text-ink/60 mb-4">Enter the 6-character code your teacher gave you.</p>
      {msg && <p className="text-wine text-sm mb-3">{msg}</p>}
      <form action={joinClass} className="space-y-3">
        <input className="input uppercase tracking-widest text-center text-lg font-mono" name="code" maxLength={6} placeholder="ABC123" required />
        <button className="btn-primary w-full">Join class</button>
      </form>
    </div>
  );
}
