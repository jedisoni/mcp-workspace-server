# DECISIONS
_Why we chose X over Y. One entry per decision._

## D1 (template)
- Decision:
- Alternatives considered:
- Reason:

## D2 Storage: JSON list of tasks with monotonically increasing ids
- Decision: store tasks as a JSON list of `{id, text, done}` in `todo.json` (path overridable via `--file` or `$TODO_FILE`); new id = max existing id + 1; writes go to a temp file then `os.replace`.
- Alternatives considered: id = list index (ids shift after delete); dict keyed by id (less readable); SQLite (overkill for the task); plain write (risk of corrupt file on crash).
- Reason: stable ids so `done`/`delete` stay predictable; max+1 never reuses an id within a file's lifetime unless the highest task is deleted; atomic write keeps data safe; stdlib only.

## D3 CLI: argparse subcommands, stubs for later commands
- Decision: use argparse subcommands; register `done` and `delete` now as stubs that exit with an error.
- Alternatives considered: click/typer (third-party dependency); add the subparsers only when implemented.
- Reason: no dependencies; the CLI surface and `--help` are stable from the start, and later sessions only replace the handler.

## D4 done/delete semantics and tests
- Decision: unknown ids exit via `find_task` with `error: no task with id N` (no file write); `done` on an already-done task prints a notice and exits 0; `delete` removes the task and does not renumber. Tests use stdlib `unittest` with temp files, calling `todo.main(argv)` directly.
- Alternatives considered: erroring on repeat `done` (annoying, not harmful); renumbering after delete (breaks stable ids from D2); pytest (third-party dependency).
- Reason: idempotent `done` is friendlier; stable ids per D2; unittest keeps the project dependency-free. Tests are written but unexecuted (no exec tool).
