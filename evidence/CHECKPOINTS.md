# CHECKPOINTS
_Written at the end of each session (and before risky changes). Pair each with a git_commit._

## Checkpoint 0 (template)
- Session: n/a
- Done: -
- Not done: -
- Files touched: -
- Commit: -
- Resume with: -

## Checkpoint 1
- Session: 1 (scaffold + add + list)
- Done: todo-app/todo.py (argparse CLI, JSON storage, `add`, `list [--all]`, stubs for `done`/`delete`); todo-app/README.md; state/plan/decision docs updated
- Not done: `done`, `delete`; no tests; code never executed (no execution tool available)
- Files touched: todo-app/todo.py, todo-app/README.md, PROJECT_STATE.md, PLAN_LOG.md, DECISIONS.md, CHECKPOINTS.md
- Commit: "Session 1: todo-app scaffold with add and list" (see git_log)
- Resume with: implement `done` and `delete` per PROJECT_STATE.md "Next step", then run all commands to verify

## Checkpoint 2
- Session: 2 (done/delete confirmed, tests, docs)
- Done: `done`/`delete` present in todo-app/todo.py (found already implemented; verified by reading); todo-app/test_todo.py (7 tests); README table + usage; PLAN_LOG steps 7-11 marked done; D4 recorded; PROJECT_STATE updated
- Not done: nothing executed (no exec tool), so tests are unverified
- Files touched: todo-app/test_todo.py, todo-app/README.md, PLAN_LOG.md, DECISIONS.md, PROJECT_STATE.md, CHECKPOINTS.md
- Commit: "Session 2: done/delete tests and docs" (see git_log)
- Resume with: run `python -m unittest test_todo -v` in todo-app/ where Python is available and fix any failures
