import Link from "next/link";

export const metadata = {
  title: "Your Privacy — Latin Quest",
  description: "A simple guide to privacy for Latin Quest students.",
};

export default function ChildPrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6 text-base leading-relaxed text-ink/80">
      <div>
        <p className="h-display text-gold text-xs tracking-[0.3em] mb-2">Your information</p>
        <h1 className="h-display text-3xl text-white">Your privacy on Latin Quest</h1>
      </div>

      <Card title="What do we know about you?">
        Your name, email, class, answers and learning progress. We also keep
        security information needed to protect your account. We do not need your
        home address, birthday or health information.
      </Card>

      <Card title="Why do we use it?">
        To sign you in, mark activities, show your progress and help your teacher
        see where you may need more practice. Your previous answers can affect
        which questions are shown first. Computers do not make important legal or
        life decisions about you.
      </Card>

      <Card title="Who can see it?">
        You can see your own progress. Your class teacher can see the progress of
        pupils in their class. Classmates see only the limited information shown
        on the class leaderboard. Authorised administrators and hosting providers
        can access information only when needed to run and protect the service.
      </Card>

      <Card title="What choices and rights do you have?">
        You can ask what information is held about you, ask for mistakes to be
        corrected, or ask whether it can be deleted. These rights belong to you,
        even when an adult helps you use them. Speak to your teacher, school
        privacy lead or the Latin Quest privacy contact.
      </Card>

      <p className="text-sm">
        Read the{" "}
        <Link href="/privacy" className="text-gold underline">full privacy notice</Link>{" "}
        for more detail.
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <p>{children}</p>
    </section>
  );
}
