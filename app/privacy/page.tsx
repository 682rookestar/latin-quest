import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — Latin Quest",
  description: "How Latin Quest collects, uses and protects personal data.",
};

const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8 text-sm leading-relaxed text-ink/80">
      <div>
        <h1 className="h-display text-3xl text-gold mb-2">Privacy notice</h1>
        <p className="text-ink/50 text-xs">Last updated: 22 July 2026</p>
        <p className="mt-3">
          This notice explains how personal information is used by Latin Quest.
          A shorter, child-friendly version is available on our{" "}
          <Link href="/privacy/children" className="text-gold underline">
            privacy guide for students
          </Link>.
        </p>
      </div>

      <Section title="1. Who is responsible">
        <p>Latin Quest is operated by Alexandria Rooke.</p>
        <p className="mt-2">
          When a school chooses Latin Quest and determines how pupil information
          is used, the school is normally the controller and Latin Quest acts as
          its processor. Latin Quest may be a controller for limited purposes it
          determines itself, such as account security, administration and meeting
          legal obligations. The applicable roles are confirmed with each school.
        </p>
        <Contact />
      </Section>

      <Section title="2. Information we use">
        <ul className="space-y-1 list-disc list-inside text-ink/70">
          <li>name, email address, account identifier and school role;</li>
          <li>class membership and teacher relationship;</li>
          <li>submitted answers, attempts, scores, mastery and badges;</li>
          <li>authentication events, IP address and technical/security logs; and</li>
          <li>support messages and privacy requests where applicable.</li>
        </ul>
        <p className="mt-2">
          We do not ask for dates of birth, home addresses or health information.
          Schools and users should not enter special-category information into
          class names or exercise answers.
        </p>
      </Section>

      <Section title="3. Why we use it">
        <ul className="space-y-1 list-disc list-inside text-ink/70">
          <li>to create and secure accounts;</li>
          <li>to enrol pupils into the correct class;</li>
          <li>to deliver and mark learning activities;</li>
          <li>to calculate progress, mastery, badges and class rankings;</li>
          <li>to help authorised teachers understand learning needs;</li>
          <li>to provide authorised school reports and exports; and</li>
          <li>to prevent abuse, diagnose faults and protect the service.</li>
        </ul>
        <p className="mt-2">
          Exercise history is used to prioritise areas that may need more
          practice. This is limited educational profiling. It does not make legal
          or similarly significant decisions about pupils.
        </p>
      </Section>

      <Section title="4. Lawful basis">
        <p>
          Where a school is the controller, it decides and communicates its lawful
          basis and Latin Quest processes information on its documented
          instructions. Where Latin Quest acts as controller, the usual basis for
          essential service delivery and security is legitimate interests, after
          considering necessity, proportionality and the particular rights of
          children. Legal obligation may apply where records must be retained or
          disclosed by law.
        </p>
        <p className="mt-2">
          We do not rely on a child&apos;s consent for essential account, teaching or
          progress processing. If optional processing requiring consent is added,
          it will be introduced separately with appropriate age and parental
          safeguards.
        </p>
      </Section>

      <Section title="5. Who can see information">
        <ul className="space-y-1 list-disc list-inside text-ink/70">
          <li>pupils can see their own progress and limited class leaderboard information;</li>
          <li>teachers can see pupils in classes they own;</li>
          <li>authorised platform administrators can support and administer the service; and</li>
          <li>service providers process information only to provide contracted infrastructure and support.</li>
        </ul>
        <p className="mt-2">We do not sell personal information or use it for advertising.</p>
      </Section>

      <Section title="6. Service providers and locations">
        <p>
          Supabase provides authentication and the primary database. The Latin
          Quest database is configured in the AWS London region. Vercel provides
          application hosting and content delivery. AWS and other approved
          subprocessors may support those services.
        </p>
        <p className="mt-2">
          Vercel, Supabase and their subprocessors may process limited information
          outside the UK, including in the United States. Where a restricted
          international transfer occurs, we require an appropriate contractual or
          adequacy safeguard, such as the UK International Data Transfer Addendum,
          Standard Contractual Clauses or an applicable data bridge. Supplier and
          transfer arrangements are reviewed periodically.
        </p>
      </Section>

      <Section title="7. Retention">
        <p>
          Account, class and learning records are normally retained while the
          school uses Latin Quest. They are deleted or returned following a valid
          school instruction or the end of the service, subject to a short period
          needed to complete deletion and any legal requirement to retain a record.
          Expired invitations and security records are kept only for their defined
          operational periods. Provider backups expire according to the relevant
          provider&apos;s documented backup lifecycle.
        </p>
        <p className="mt-2">
          Latin Quest reviews inactive accounts and classes at least annually. The
          detailed schedule is available from the privacy contact or participating
          school.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p>
          Depending on the circumstances, individuals may have rights to access,
          correct, erase, restrict, object to or receive a portable copy of their
          personal information. These rights belong to the child; a parent or
          school may act where authorised and appropriate.
        </p>
        <p className="mt-2">
          If your school provided access, contact the school first because it will
          normally be responsible for the request. You may also contact Latin
          Quest below. Requests are normally answered within one month, subject to
          lawful extensions and identity checks.
        </p>
        <Contact />
        <p className="mt-2">
          You may complain to the{" "}
          <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener noreferrer" className="text-gold underline">
            Information Commissioner&apos;s Office
          </a>.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          Latin Quest uses authentication and security cookies required to sign
          users in and protect their sessions. These are not used for advertising.
          No optional analytics or marketing cookies are currently set by the
          application. If that changes, this notice and any required consent
          controls will be updated before use.
        </p>
      </Section>

      <Section title="10. Children and changes">
        <p>
          Latin Quest is designed for pupils and applies child-focused data
          minimisation, restricted access and privacy-by-default measures. Material
          changes to how pupil information is used will be assessed before release
          and communicated to participating schools and users as appropriate.
        </p>
      </Section>
    </div>
  );
}

function Contact() {
  return PRIVACY_EMAIL ? (
    <p className="mt-2">
      Privacy contact:{" "}
      <a href={`mailto:${PRIVACY_EMAIL}`} className="text-gold underline">
        {PRIVACY_EMAIL}
      </a>
    </p>
  ) : (
    <p className="mt-2 text-wine">
      Privacy contact configuration is pending. Until it is published, please
      contact the school that provided access.
    </p>
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
