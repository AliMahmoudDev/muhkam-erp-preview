---
name: Vitest mock queue isolation
description: vi.clearAllMocks() vs mockReset() — preventing cross-test queue pollution in hoisted mocks
---

## The Rule
In every `beforeEach`, call `mockFn.mockReset()` on hoisted mocks (not just `vi.clearAllMocks()`).

**Why:** `vi.clearAllMocks()` = `mockClear()` = clears call history only. It does NOT clear the `mockResolvedValueOnce` implementation queue. Queued once-values bleed into later tests, causing wrong responses (e.g. a 201 when a 403 is expected).

**How to apply:**
1. Define a `resetMocks()` helper that calls `.mockReset()` on each hoisted `vi.fn()` control.
2. Call `resetMocks()` at the top of every `beforeEach`.
3. After reset, set the default `mockResolvedValue(...)` for the happy-path baseline.
4. Use `mockResolvedValueOnce(...)` ONLY inside individual `it()` tests, never in `beforeEach`, so each test owns its own sequence without queue build-up.
