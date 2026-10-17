Plan first, before acting.

The scaffold plus `add` and `list` are written and committed, but I couldn't run the code. I only have file and git tools here, so none of it has been tested.

**What exists**
- **`todo-app/todo.py`**: a command-line app using only the Python standard library.
  - `add <text...>` appends a task and prints `Added #N: ...`.
  - `list` shows pending tasks, and `list --all` includes completed ones.
  - `done` and `delete` are accepted by the argument parser but exit with "not implemented yet".
  - Tasks are stored as `{id, text, done}` in `todo.json`. You can change the file with `--file` or `$TODO_FILE`.
- **`todo-app/README.md`**: usage, the data file format, and a table of which commands are implemented.

**Bookkeeping**
- **`PLAN_LOG.md`**: the plan was written before any code, and every step is marked done except the commit step, which still reads "in progress".
- **`PROJECT_STATE.md`**: goal, current status including the untested caveat, and the next step.
- **`CHECKPOINTS.md`**: Checkpoint 1.
- **`DECISIONS.md`**:
  - D2: store a JSON list of tasks, give each new task the highest existing id plus one, and write via a temp file so a crash can't corrupt the data.
  - D3: use argparse subcommands, with `done` and `delete` registered now as stubs.
- **Commit**: `0479a7f` "Session 1: todo-app scaffold with add and list".

**Next session:** implement `done <id>` and `delete <id>`, with a clear error for unknown ids. Update the README table and run all four commands to verify. Any session with a way to run code should also test `add` and `list`.