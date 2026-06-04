export const metadata = {
  title: "Privacy Policy — Latin Quest",
  description: "How Latin Quest collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  const updated = "3 June 2026";

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8 text-sm leading-relaxed text-ink/80">
      <div>
        <h1 className="h-display text-3xl text-gold mb-2">Privacy Policy</h1>
        <p className="text-ink/50 text-xs">Last updated: {updated}</p>
      </div>

      <Section title="1. Who we are">
        <p>
          Latin Quest is an online Latin learning platform built around the <em>de Romanis</em> curriculum.
          It is operated by James Rooke ("we", "us", "our").
        </p>
        <p className="mt-2">
          For the purposes of UK GDPR, we are the <strong>Data Controller</strong> for personal data
          processed through this service.
        </p>
        <p className="mt-2">
          Contact us with any data or privacy questions at:{" "}
          <a href="mailto:[privacy@yourdomain.com]" className="text-gold underline">
            [privacy@yourdomain.com]
          </a>
        </p>
      </Section>

      <Section title="2. What data we collect">
        <p>We collect and store only the minimum data necessary to run the service:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-ink/70">
          <li><strong>Name and email address</strong> — provided at sign-up or via your school's Microsoft account</li>
          <li><strong>School role</strong> — student, teacher, or admin</li>
          <li><strong>Class membership</strong> — which class(es) you are enrolled in</li>
          <li><strong>Learning progress</strong> — exercise attempts, scores, mastery levels, and chapter badges earned</li>
        </ul>
        <p className="mt-2">
          We do not collect date of birth, home address, phone numbers, or any sensitive personal data.
          We do not use cookies for tracking or advertising.
        </p>
      </Section>

      <Section title="3. How we use your data">
        <p>Your data is used solely to provide the Latin Quest service:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-ink/70">
          <li>To authenticate you and maintain your account</li>
          <li>To record and display your learning progress</li>
          <li>To allow teachers to monitor the progress of students in their class</li>
          <li>To display class leaderboards to students within the same class</li>
        </ul>
        <p className="mt-2">
          We do not use your data for marketing, advertising, profiling, or any purpose
          unrelated to Latin Quest.
        </p>
      </Section>

      <Section title="4. Lawful basis for processing">
        <p>
          We process personal data on the basis of <strong>legitimate interests</strong> — specifically,
          delivering an educational service that schools and students have chosen to use.
          Where students are under 13, we rely on the school acting as the appropriate
          authority for consent on behalf of pupils, in line with their own data protection obligations.
        </p>
      </Section>

      <Section title="5. Who can see your data">
        <ul className="space-y-1 list-disc list-inside text-ink/70">
          <li><strong>Students</strong> can see their own progress and the leaderboard within their class (names and scores only)</li>
          <li><strong>Teachers</strong> can see the progress of students in their own class</li>
          <li><strong>Admins</strong> can see all user accounts and progress across the platform</li>
          <li><strong>No one outside the platform</strong> can access your data — we do not sell or share data with third parties</li>
        </ul>
      </Section>

      <Section title="6. Where your data is stored">
        <p>
          Your data is stored in <strong>Supabase</strong>, a database service hosted on Amazon Web
          Services in the <strong>eu-west-2 (London)</strong> region. All data remains within the
          United Kingdom. Supabase acts as a Data Processor under a Data Processing Agreement
          with us.
        </p>
        <p className="mt-2">
          If you sign in using Microsoft, your authentication is handled by
          <strong> Microsoft Entra ID</strong>. Microsoft processes your credentials on your
          school's behalf and returns only your name and email address to Latin Quest.
        </p>
      </Section>

      <Section title="7. How long we keep your data">
        <p>We retain your data for as long as your account is active. Specifically:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-ink/70">
          <li>Student accounts are deleted at the request of the school or the student (if 16+)</li>
          <li>Learning progress records are deleted along with the account</li>
          <li>We do not retain data after an account is deleted</li>
        </ul>
        <p className="mt-2">
          Schools using Microsoft SSO should note that removing a student from the relevant
          Entra group will prevent future sign-ins but will not automatically delete their
          Latin Quest account. Please contact us to request deletion.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p>Under UK GDPR you have the right to:</p>
        <ul className="mt-2 space-y-1 list-disc list-inside text-ink/70">
          <li><strong>Access</strong> — request a copy of the data we hold about you</li>
          <li><strong>Rectification</strong> — ask us to correct inaccurate data</li>
          <li><strong>Erasure</strong> — ask us to delete your account and all associated data</li>
          <li><strong>Restriction</strong> — ask us to stop processing your data while a complaint is investigated</li>
          <li><strong>Portability</strong> — request your data in a machine-readable format</li>
          <li><strong>Object</strong> — object to processing based on legitimate interests</li>
        </ul>
        <p className="mt-2">
          To exercise any of these rights, email us at{" "}
          <a href="mailto:[privacy@yourdomain.com]" className="text-gold underline">
            [privacy@yourdomain.com]
          </a>
          . We will respond within 30 days.
        </p>
        <p className="mt-2">
          If you are not satisfied with our response, you have the right to lodge a complaint
          with the <strong>Information Commissioner's Office (ICO)</strong> at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-gold underline">
            ico.org.uk
          </a>.
        </p>
      </Section>

      <Section title="9. Children's privacy">
        <p>
          Latin Quest is designed for use in secondary schools and may be used by students
          under 16. We do not knowingly collect more data than is necessary for the
          educational service, and we do not use children's data for any commercial purpose.
        </p>
        <p className="mt-2">
          Schools are responsible for ensuring appropriate parental consent or notice is in
          place before enrolling students under 13. If you believe a child's data has been
          collected without appropriate authority, please contact us immediately.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this policy from time to time. We will notify schools of any material
          changes by email. The date at the top of this page shows when it was last updated.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-white mb-2">{title}</h2>
      {children}
    </section>
  );
}
