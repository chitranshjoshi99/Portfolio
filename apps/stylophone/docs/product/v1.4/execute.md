# Execute — autonomous build handoff

Read `README.md`, `AUDIT.md`, and the target epic before editing. The pre-build audit is resolved; implement strictly in net-tracker order: EPIC 3 → EPIC 1 → EPIC 2 → EPIC 4.

## Every session

1. Select the earliest unblocked story, mark it In progress in its epic and README.
2. Read the whole epic’s locked contract. Do not re-litigate slot count, document shape, timing, mode mapping, or visual hierarchy.
3. Keep mutation ownership in the designated hook/lib. No Context, state library, backend, accounts, sync, animation dependency, legacy document support, song bank, or AI API.
4. Run typecheck/build and manually execute every acceptance case for the story. Audio changes require a real transport-playback check, not merely a typecheck.
5. Mark Done/Blocked with concrete evidence in both trackers; commit one coherent story. The next session resumes from the tracker.

## Verification gate

Before declaring v1.4 complete, prove: four-slot refresh/import/export round trip; next-boundary latest-wins switching; no audio/grid divergence; mode isolation and Undo expiry; held transpose does not mutate/save notes; no LessonPanel layout shift; reduced motion works; invalid `.beatcoach` input never changes the active beat.
