---
name: testing-workflow
description: "Auto-invoked skill for writing, fixing, and reviewing tests. Triggers on: 'write test', 'add test', 'fix test', 'test coverage', 'edge case', 'unit test', 'hook test', 'renderHook', 'vi.mock', 'test file', 'test suite', 'failing test', 'test error'."
---

# Testing Workflow

This skill enforces consistent, high-quality test authoring for the booking system.

## Project Test Infrastructure

- **Runner:** Vitest 3.x with jsdom environment
- **React testing:** `@testing-library/react` + `renderHook` + `waitFor` + `act`
- **HTTP mocking:** MSW v2 (server in `src/test/server.ts`, setup in `src/test/setup.ts`)
- **Builders:** `src/test/builders.ts` — use for ALL test data construction
- **Config:** `vitest.config.ts` — globals enabled, `@/` alias configured, Istanbul coverage

## Conventions

### File placement
- Co-locate tests next to source: `foo.ts` → `foo.test.ts`
- No separate `__tests__` directories

### Test data
- Always use builders from `src/test/builders.ts` (e.g. `buildReservation()`, `buildRoomType()`, `buildRoom()`)
- Call `resetBuilderSequences()` in `beforeEach` when test assertions depend on specific IDs
- Override only the fields relevant to the test; let builders provide defaults

### Mocking
- `vi.mock()` calls must be at **module level** (top of file, outside `describe`)
- Mock `@/lib/api` functions for anything that hits the database
- Mock `@/integrations/supabase/client` when testing raw Supabase queries
- Mock `@/context/data-context` when testing hooks that consume context
- Use `vi.mocked(fn).mockResolvedValue(...)` inside individual tests

### Hook testing
- Use `renderHook` from `@testing-library/react`
- Wrap state changes in `act()`
- Use `waitFor` for async assertions
- Provide wrapper components for context-dependent hooks

### Type safety
- Never use `any` — use proper types or `as unknown as Type` for test doubles
- All mock return values must match the real function's return type

## Quality Checks

After writing or modifying every test file, run these in order:

```bash
# 1. Tests pass
npx vitest run <file>

# 2. Types correct
npx tsc --noEmit

# 3. Lint clean
npx eslint <file>
```

Fix any failures before moving on.

## Anti-Patterns

- **No smoke tests:** Every test must assert something meaningful about behavior
- **No `any`:** Use typed mocks and builders
- **No mocking what you can test directly:** If a pure function has no side effects, test it without mocks
- **No testing implementation details:** Test observable behavior (return values, state changes), not internal method calls
- **No `test.skip` or `test.todo`:** Either write the test or don't add it
- **No inline test data objects:** Use builders instead

## Patterns Log

_Append new patterns discovered during testing below this line._
