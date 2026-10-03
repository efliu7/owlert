# Owlert product direction

Owlert needs a reason to install beyond duplicating Brightspace's assignment list,
calendar, and existing reminders. Assignment retrieval is the foundation for
helping students notice consequential changes and resolve uncertainty about their
coursework.

## Core value

1. **Explain changes since the last check.** Keep assignment history and show
   before/after deadlines, changed requirements, and relevant instruction or
   attachment updates. Link to the source and let students acknowledge changes.
2. **Find missing or conflicting deadlines.** Investigate dates in announcements,
   assignment instructions, and course outlines. Show source evidence and ask
   students to confirm ambiguous dates before using them for reminders. Do not
   present inferred dates as confirmed deadlines.
3. **Support starting work in time.** Combine deadlines with student-provided
   effort estimates, progress, and milestones to identify workload conflicts.
   Do not assume assignment effort from a title alone.

These features are central to the product's usefulness. Course colors, exclusions,
and pinning remain useful supporting preferences.

## Chrome notifications

Provide minimally invasive Chrome notifications for upcoming assignments and
meaningful changes. Make reminders configurable and make notifications actionable:
open the relevant assignment or change details.

Design priorities:

- Show the course, assignment, and the reason for the alert.
- Explain a changed deadline with its old and new values.
- Avoid repeating acknowledged changes or the same reminder.
- Batch simultaneous alerts where appropriate instead of producing a burst.
- Allow notification controls, including disabling reminders or change alerts.
- Account for completed work and excluded courses when those preferences exist.

Delivery must reflect browser and operating-system notification settings. Local
scheduled reminders can use stored data; new-change alerts require a successful
sync. Do not promise continuous monitoring while Chrome is closed or a Brightspace
session has expired.

## Next meaningful milestone

Retain normalized assignment snapshots, compare successful syncs, and build a
"Since your last check" feed with exact deadline changes and source links.
Preserve actual API timestamps rather than comparing formatted date labels.
Do not treat a failed or incomplete scan as evidence of an assignment deletion.
Add configurable Chrome notifications on top of reliable change detection and
deadline scheduling.

Validate with real student examples: did Owlert surface information that changed
what the student did, which they would otherwise have missed or spent time checking?
