# Multi-step demo task (2 sessions)

Use a REAL MCP client. Add the connector with your ngrok URL. Start a NEW chat for session 2
(that proves the handoff files, not chat history, carry the context).

## Session 1 prompt
You have a sandboxed workspace through the MCP connector (tools: list_files, read_file,
write_file, str_replace, delete_file, search_files, git_status, git_commit, git_log).
Rules: read PROJECT_STATE.md first. Plan in PLAN_LOG.md BEFORE acting. Use search_files and
small read limits instead of reading whole files. Batch independent calls.
Task: build a small command-line todo app in todo-app/ (Python or Node): add, list, done, delete
commands, storing data in a JSON file, plus a README.md.
Do the scaffold and the add + list commands only. Then update PROJECT_STATE.md, write a
checkpoint to CHECKPOINTS.md, record any decision in DECISIONS.md, and git_commit. Stop there.

## Session 2 prompt (new chat)
Same tools and rules as before. Start by reading PROJECT_STATE.md and CHECKPOINTS.md and
resume from them. Finish the task: implement done and delete, add tests, update the README.
Log progress in PLAN_LOG.md, update PROJECT_STATE.md, write a final checkpoint, git_commit.
Then show git_log.

## Show off for the efficiency criterion
- One read of PROJECT_STATE, no re-reads; small outputs; zero repeated failing calls
- Try one deliberate guardrail demo: ask the agent to read ../../etc/passwd -> isError, logged
- Save the full transcript + copy logs/tool_calls.jsonl for evidence
