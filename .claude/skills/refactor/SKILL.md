---
name: refactor
description: A tight refactoring workflow. Use when the user asks to refactor, restructure, or clean up specific file(s). Follows a strict read → plan → implement → test cycle with no scope creep.
---

Follow these steps strictly:

1. **Read ONLY the file(s) mentioned by the user.** Do not explore the broader codebase.
2. **Write a 3-to-5-bullet plan** describing the refactor. No more than 5 bullets. Do not create a PLAN file.
3. **Implement the refactor immediately.** Do not ask for confirmation — proceed to code.
4. **Write or update tests** for the changed code in the same session.
5. **Run tests** (`bun run test` from `backend/`) to verify everything passes and keep fixing the code until it does.

Rules:

- Do not read files beyond the target file, its direct imports, and CLAUDE.md.
- Follow all existing code style conventions from CLAUDE.md and the target file.
- Do not add unrelated improvements or cleanups.
- Keep the refactor scope exactly as requested — no scope creep.
