# Self-test ticket for scripts/check-acceptance-mapping.mjs

A fixture, never a real ticket: the acceptance-mapping check reads it on every run and must reach
known verdicts on it (see the self-test in the script).

## Acceptance criteria

- [ ] [M2-AC99](#) / 1 — its only name belongs to /10, a longer number.
- [ ] [M2-AC99](#) / 2 — its only test is declared test.skip.
- [ ] [M2-AC99](#) / 3 — runs in one Playwright project, skipped in the other.
- [ ] [M2-AC99](#) / 4 — listed, but its file skips at run time.
- [ ] [M2-AC99](#) / 5 — a manual-evidence row only.
- [ ] [M2-AC99](#) / 6 — its only test is test.fixme.
- [ ] [M2-AC99](#) / 10 — a test of its own.
