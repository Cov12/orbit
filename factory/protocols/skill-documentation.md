# skill-documentation.md — How We Document Custom Skills & Scripts

_The convention for documenting custom skills installed at `~/.openclaw/skills/` and one-off scripts at `~/.openclaw/scripts/` so model swaps don't break operational knowledge. Companion to `verify-before-claim.md`._

## Why This Protocol Exists

In May 2026, Coda was migrated from Anthropic Opus to OpenAI Codex. The custom Google Drive integration appeared to "break" — Coda told the Principal *"I can't access Google Docs from this environment"* even though the credentials, scripts, and skill registration were all completely intact and unchanged.

The actual cause: the operational knowledge of *how to invoke the skill* (which Node script to run, what args to pass, where the impersonated user lives) had only ever existed in Opus's accumulated session context. It was never written into any persistent file. When the model changed, that implicit knowledge went with it. The new model saw the skill files but had no instructions for using them.

This is a **structural risk that affects every custom skill on the system**. This protocol prevents recurrence by enforcing two parallel docs for every skill: a `SKILL.md` that lives with the skill files, and an index entry in the relevant agent's `MEMORY.md`.

## The Two-Doc Rule

Every custom skill at `~/.openclaw/skills/<name>/` MUST have BOTH:

### 1. `SKILL.md` (lives with the skill files)

The canonical reference for invoking the skill. Required sections:

- **Overview** — what the skill does, in 1-3 sentences
- **Auth** — where credentials live, what identity is used (service account email, OAuth user, API key, etc.), what scopes/permissions
- **Primary Interface** — exact invocation syntax (CLI args, function signatures), with examples that can be copy-pasted by an agent without further inference
- **Examples** — at least 2-3 concrete worked examples
- **Rules of Use** — constraints, what NOT to do, links to relevant shared protocols (financial-gatekeeper, tool-confidentiality, etc.)
- **When This Skill Doesn't Cover Your Need** — guidance for the per-task script pattern (if applicable) or how to extend

The audience is "a fresh agent that just woke up with no context beyond what's on disk." Don't assume the reader has chat history. Don't assume they recognize the auth pattern. Spell it out.

### 2. Entry in the agent's `MEMORY.md` "Skills & Scripts Index"

A pointer, not a duplicate. The MEMORY entry should include:
- Skill name
- One-line purpose
- Path to the SKILL.md

The agent reads MEMORY.md every session, sees the skill exists, follows the pointer to SKILL.md when the skill is needed. This way operational knowledge is **discoverable from MEMORY.md** without bloating it.

## One-Off Scripts at `~/.openclaw/scripts/`

Same convention applies to standalone scripts (`*.sh`, `*.py`, `*.js`) that aren't packaged as skills:

- Each should have a clear purpose comment at the top of the file (file-level docstring)
- Each should be referenced in MEMORY.md's Skills & Scripts Index with a one-line description
- If a script is part of an active workflow (e.g., a cron driver), document the trigger/schedule

## Audit Procedure

When adopting a new model, running a doctor pass, or onboarding a new agent, run this check:

```bash
# Every skill should have SKILL.md
for d in ~/.openclaw/skills/*/; do
  [ -f "$d/SKILL.md" ] || echo "MISSING: $d"
done

# Every skill should be referenced in the agent's MEMORY.md
for d in ~/.openclaw/skills/*/; do
  name=$(basename "$d")
  grep -q "$name" ~/dev-ops/coda/MEMORY.md || echo "NOT IN MEMORY: $name"
done
```

(Adjust the agent path for whichever agent owns the skills.)

## When Adding a New Skill

The order of operations:
1. Create the skill files at `~/.openclaw/skills/<name>/`
2. **Write `SKILL.md` BEFORE running the skill in production.** This is non-negotiable. If you build a skill and skip the SKILL.md, the next model swap will lose it.
3. Add an entry to the agent's MEMORY.md Skills & Scripts Index
4. Verify discoverability: ask a fresh agent session "what skills do I have?" — confirm it can find the new one and explain how to use it

## When Removing or Replacing a Skill

If you remove a skill (e.g., as part of a cleanup), also:
- Remove the SKILL.md (skill no longer exists)
- Remove the MEMORY.md entry
- **Search for dangling references** — the May 2026 Atrium env-var incident showed that removing a middleware while leaving env-var references behind creates fabrication-fuel for future sessions. Apply the same hygiene to skills: when you remove one, search the codebase + docs + scripts for references and clean them up.

## Anti-Patterns to Avoid

- **Skill exists, no SKILL.md.** This is the May 2026 Drive failure mode. Don't ship skills without SKILL.md.
- **SKILL.md exists, no MEMORY.md entry.** The skill is discoverable by *exploring* the filesystem, but a fresh model session won't necessarily know to explore. The MEMORY.md index makes it discoverable from session start.
- **Implicit knowledge in chat history.** "We always do X this way" — if it's not in a file, it's about to be lost. When you find yourself explaining the same workflow twice in chat, write it down.
- **Stale legacy references.** Old scripts still in skill dirs without notes that they're legacy. Add a "Legacy" section to SKILL.md if applicable.

## Per-Agent Notes

- **Coda:** highest-risk surface because the operator role exposes the most skills. Coda's MEMORY.md should have the most extensive Skills & Scripts Index.
- **Byte:** sends email + monitors inboxes — the email skill is the load-bearing one. Less surface area to document, but the email-related skills must be air-tight.
- **Dex:** strategist role with tool-calling. Less skill exposure currently, but if/when Dex starts handling specific workflows (e.g., analysis scripts), they need the same treatment.
