# Retention and Deletion Schedule

Status: Draft — contract periods must be approved by the operator and schools.

| Record | Proposed retention | Trigger/action | Owner |
|---|---|---|---|
| Active pupil/teacher account | Duration of school use | Annual review and school confirmation | School + operator |
| Class membership | Until removal, class closure or contract end | Delete membership; assess linked account | School teacher/admin |
| Answers, attempts, mastery and badges | Duration of school use; delete within 30 days of valid contract-end instruction | Delete account or scoped learning records; verify cascade | Operator |
| Inactive account with no active class | Review after 12 months inactivity | Contact controller; delete unless retention instructed/lawful | Operator |
| Failed join-code attempts | 5 minutes operationally; no longer than 24 hours unless security incident | Automated cleanup | System |
| Join code | Active for 30 days by default | Expire/rotate; retain only class audit metadata if needed | Teacher/system |
| Teacher invitation | 14 days active; delete expired invitation details within 30 days | Scheduled/admin cleanup | Admin |
| Authentication/security logs | 90 days unless required for an incident | Restrict access; delete/archive at expiry | Operator/vendor |
| Support correspondence | 12 months after closure | Delete or anonymise | Operator |
| Rights-request record | 3 years after closure | Retain minimal evidence, then delete | Privacy owner |
| Incident/breach record | 6 years after closure | Retain protected accountability record | Privacy owner |
| Locally downloaded exports | Determined and controlled by school | School secure storage and deletion policy | School |
| Provider backups | Vendor lifecycle after live deletion | Confirm through current DPA/documentation | Vendor |

## Deletion procedure

1. Verify the requesting controller/person and exact scope.
2. Check whether restriction, safeguarding, dispute or legal-retention duties apply.
3. Record approval without copying unnecessary pupil data into the ticket.
4. Export/return data if instructed and lawful.
5. Delete the Supabase Auth user for full-account deletion; foreign-key cascades
   remove the profile, attempts, membership, progress and badges.
6. For scoped deletion, use an approved transactional admin procedure.
7. Confirm deletion from live systems and record expected backup expiry.
8. Notify the school/requester without revealing other people's information.
9. Retain only the minimal request-completion record in the rights log.

Deletion must be tested in staging at least annually and after schema changes.
