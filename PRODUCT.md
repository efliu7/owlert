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

The first change-tracking milestone is implemented: per-course sync baselines,
normalized API deadlines, and a "Since your last check" feed for new assignments,
renames, and deadline changes. Changes retain before/after values and source
links; students can acknowledge individual changes or all visible changes and
revisit seen history. The first successful sync establishes a starting point.
Page captures and failed syncs cannot overwrite the baseline, and absent
assignments do not produce deletion alerts.

Next, validate this feed with real course updates and extend collection to
assignment requirements and attachments where useful.
Add configurable Chrome notifications on top of reliable change detection and
deadline scheduling.

Validate with real student examples: did Owlert surface information that changed
what the student did, which they would otherwise have missed or spent time checking?
