# Adding a New Teammate

Spinning up a new agent? Follow this checklist. The whole point of this
directory is that bringing a new teammate online should be a recipe, not
a research project.

## Prereqs

- A clear answer to: **what role on the team does this agent fill that
  isn't already covered?** Don't add an agent that duplicates an existing
  one. Read `TEAM.md` first.
- A decision on **type**: cloud or local. (See step 1 below.)
- A decision on **host**: which existing box, or a new one.
- OpenClaw installed and configured on the chosen host
- For local: enough RAM/cores for the model + the model pulled via Ollama
- For cloud: working auth profile for the provider (API key or OAuth)
- A Telegram bot handle (for private agent ↔ the Principal communication)
- A decision: which Slack channels (if any) the agent joins

## Steps

### 1. Pick a name, role, type, and host

**Name:** short, distinct, easy to say, no collisions with the existing
roster.

**Role:** complementary to what's already on the team — operator,
strategist, researcher, archivist, etc. Don't duplicate.

**Type:** `cloud` or `local`.
- **Cloud** if you want speed, breadth, or capabilities only available
  via a third-party API (e.g., Opus for hard reasoning, Gemini for long
  context, etc.). Trade-off: ongoing cost, rate limits, third-party T&Cs.
- **Local** if you want zero per-token cost, full control, no T&Cs, and
  the option to fine-tune. Trade-off: hardware investment, slower
  inference, model capability ceiling.

**Provider:** which API or runtime — `anthropic`, `google`, `openai`,
`ollama`, etc.

**Host:** which existing VPS, or a new one. Default is "put it on the
box where its purpose fits" — operations agents on the ops VPS,
intelligence agents on the intelligence VPS.

### 2. Create the agent's directory

```bash
mkdir <name>/
mkdir <name>/users/
mkdir <name>/workspace/
```

### 3. Fill in the templates

Copy each template into the agent's directory and replace the
placeholders.

```bash
cp templates/IDENTITY.template.md  <name>/IDENTITY.md
cp templates/SOUL.template.md      <name>/SOUL.md
cp templates/BOOTSTRAP.template.md <name>/BOOTSTRAP.md
cp templates/HEARTBEAT.template.md <name>/HEARTBEAT.md
```

Open each file and fill in:

- `{{AGENT_NAME}}`
- `{{EMOJI}}`
- `{{PRONOUNS}}`
- `{{ROLE_TITLE}}`
- `{{TYPE}}` — `cloud` or `local`
- `{{PROVIDER}}` — `anthropic`, `google`, `openai`, `ollama`, etc.
- `{{MODEL}}`
- `{{HOST}}` — where the harness runs (not where the model runs)
- `{{QUICK_MODEL}}` — local agents only, otherwise `N/A`
- `{{REPO_NAME}}`
- `{{TELEGRAM_HANDLE}}`
- `{{SLACK_CHANNELS}}`

In `BOOTSTRAP.md`, the **Working Discipline** section has two blocks —
one for local agents and one for cloud agents. Delete the one that
doesn't apply to your type.

Then replace every HTML comment block (`<!-- ... -->`) with actual prose.
The comments tell you what each section is for.

Also create an empty `<name>/MEMORY.md` — it'll get filled in over time.

### 4. Create message queues for every existing teammate

For each existing teammate `T` in `TEAM.md`:

```bash
mkdir -p messages/<name>-to-T/{inbox,processing,done}
mkdir -p messages/T-to-<name>/{inbox,processing,done}
```

Add a `.gitkeep` to each empty directory so git tracks it.

### 5. Update `TEAM.md`

Add a row for the new teammate. **This is the moment they "join"** —
once this row exists, every other agent will see them on next bootstrap.

### 6. Configure the agent's OpenClaw instance

- Point its workspace at `<name>/`
- Set up Telegram bot integration (`{{TELEGRAM_HANDLE}}`)
- Set up Slack integration (if applicable)
- Configure the heartbeat cron
- Set up the git sync cron (1-minute interval)
- Add any auth profiles needed for the chosen model

### 7. Smoke test

- Send a message from the Principal via Telegram → verify it reaches the agent
- Drop a test message into `messages/<existing-teammate>-to-<name>/inbox/`
  → verify the new agent picks it up and moves it through
  `processing/` → `done/`
- Have the new agent send a message back the other way
- Verify the heartbeat is updating
- Verify the git sync is working both ways

### 8. Announce

The Principal posts a one-liner in the Slack demo channel. Existing teammates note
the new arrival in their next HEARTBEAT entry under "Recent activity":

```
- YYYY-MM-DD HH:MM UTC — [team] <name> joined the team as <role>
```

## Removing a teammate

Same process in reverse:

1. Remove their row from `TEAM.md`.
2. Archive their directory: `mv <name>/ archive/<name>-<YYYY-MM-DD>/`
3. Archive their message queues the same way.
4. Stop the OpenClaw instance and decommission the host (if dedicated).
5. Existing teammates note the departure in their HEARTBEAT.
