# School Data Processing Agreement — Review Template

This template requires legal and school-DPO review. It is not a signed contract.

## Parties

Controller: [SCHOOL LEGAL NAME AND ADDRESS]  
Processor: [LATIN QUEST OPERATOR LEGAL NAME AND ADDRESS]  
Effective date and term: [DETAILS]

## Processing instructions

The processor will process personal data only to provide Latin Quest under the
controller's documented instructions, including account administration, class
enrolment, exercise delivery and marking, progress reporting, support, security,
return and deletion. The processor must notify the controller if an instruction
appears unlawful, unless prohibited by law.

| Required schedule item | Description |
|---|---|
| Subject matter | Online Latin practice and teacher reporting |
| Duration | Contract term plus agreed return/deletion period |
| Nature | Collection, storage, retrieval, marking, organisation, disclosure to authorised users, export and deletion |
| Purpose | Deliver and secure the school-selected learning service |
| Data subjects | Pupils, teachers and nominated administrators |
| Personal data | Name, email, ID, role, class, answers, scores, mastery, badges, auth and security records |
| Special categories | Not intended or requested; controller must not instruct routine collection without a revised agreement/DPIA |

## Processor obligations

The processor shall:

1. act only on documented instructions and ensure authorised personnel are bound
   by confidentiality;
2. implement appropriate technical and organisational security measures;
3. ensure teachers are restricted to their own classes and administrators are
   limited to authorised support/administration;
4. assist with data-subject rights, security, breach assessment, DPIAs and prior
   consultation as reasonably required;
5. notify the controller of a personal data breach without undue delay and provide
   available facts, consequences and mitigation;
6. maintain records required of processors and provide compliance information;
7. return or delete personal data at contract end as instructed, unless law
   requires retention, and confirm completion;
8. permit proportionate audits or provide suitable independent assurance; and
9. not sell data, advertise to pupils or use school data for unrelated product
   development or model training.

## Subprocessors and transfers

Approved initial subprocessors are listed in `VENDORS_AND_TRANSFERS.md`. The
processor will give reasonable advance notice of additions/replacements, impose
equivalent Article 28 obligations and remain responsible for their performance.
Restricted international transfers require a documented UK GDPR mechanism and,
where required, a data protection test/transfer risk assessment.

## Controller responsibilities

The school will provide lawful, fair and transparent instructions; identify its
lawful basis; supply pupil/parent notices; manage authorised users; avoid entering
unnecessary or special-category data; respond to rights requests as controller;
configure class/leaderboard use appropriately; protect downloaded exports; notify
leavers; and inform the processor promptly of incidents or incorrect data.

## Security schedule

- TLS, vendor encryption at rest and protected deployment secrets.
- Supabase RLS, role checks and class-owner access controls.
- Server-authoritative marking and transactional progress updates.
- Expiring/rotatable class codes and abuse rate limiting.
- Backups, monitoring and supplier incident procedures.
- Vulnerability remediation, access reviews and automated security regression tests.

## Signatures

Controller signatory: [NAME / ROLE / DATE]  
Processor signatory: [NAME / ROLE / DATE]
