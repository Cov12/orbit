# verify-before-claim.md — Don't Assert What You Haven't Read

_How agents on the team handle technical claims. Read this before stating any specific file path, function name, or root cause._

## The Rule

**If you haven't read the code, you don't know.** Any technical assertion — file path, function name, endpoint URL, env var name, root-cause narrative, "the bug is in X" — must come from actually reading the relevant file in the current state of the repo. Pattern matching from training, prior conversations, or plausible-sounding inference does not count.

This applies to every agent. It became a team-wide rule on 2026-05-07 after a 2.5-hour incident where Coda asserted a JWT mismatch in a specific endpoint that didn't exist in the codebase, leading the Principal to debug a fictional problem.

## Why This Rule Exists

Modern LLMs are pattern-completion engines. When asked "where's the auth bug?" without scope, they will generate a plausible-sounding answer that looks like an auth bug location, even if no such file exists in the actual repo. This is *fabrication*, not hallucination — the output is internally coherent, just not connected to ground truth.

Operator agents are especially prone to this because:
- Conversational pressure to give a confident answer
- No friction between "what's plausible" and "what's actual"
- Loss of trust compounds over time — every fictional assertion makes the whole team less useful

The cost of a small verification step is seconds. The cost of debugging a fictional bug is hours and a trust hit.

## What "Verify" Means in Practice

Before asserting any of these, the relevant file must have been *read* in the current session, OR the assertion must explicitly be flagged as an unverified hypothesis:

- "The bug is in `<file:line>`"
- "The endpoint `<path>` does X"
- "The env var `<NAME>` controls Y"
- "Function `<name>` calls function `<other>`"
- "Commit `<sha>` introduced this"
- "The fix is to change `<line>` to `<new>`"
- "This was working before commit `<sha>`"

### Verification methods (in order of strength)

1. **Read the file directly** with the Read tool / `cat` / `view`. Quote the line number. This is ground truth.
2. **Grep for the term** across the repo. Either find it (with file+line) or confirm zero hits.
3. **Check git log** for specific commits/SHAs before referencing them.
4. **For external state** (deployed env vars, running processes, etc.), use the appropriate tool — don't guess.

### When you can't verify (and what to say instead)

Sometimes verification isn't immediately possible — a service is down, a repo isn't checked out locally, you don't have access. In those cases, **say so explicitly**:

- ✅ *"My hypothesis is that the JWT secret is mismatched between portal and atrium. I haven't verified — the portal repo isn't checked out here. Want me to check it out, or is this hypothesis enough to act on?"*
- ❌ *"The JWT secret is mismatched between portal and atrium."*

The first is honest hedging. The second is fabrication when you haven't read both files.

## How to Use `claude-delegate` for Verification

When a task requires technical assertion and you can't reliably verify yourself (e.g., Coda on Codex on operator-level work), **delegate the verification step**:

```bash
ops/claude-delegate.sh "Verify whether endpoint /api/v1/auths/portal-exchange exists in this codebase. Grep for portal-exchange, portal_exchange, and /api/v1/auths/portal across all files. Return: list of hits with file:line, OR 'no hits found'." /path/to/repo
```

Claude Code will:
- Actually read files
- Return ground-truth findings
- Decline to make claims it can't substantiate

Then you can build your operator response on top of *verified* facts. This costs nothing on the Principal's Max subscription and prevents downstream rework.

## Before Claiming "I Can't Do X" — Check the Skills Directory

This is a sibling of the rule above: not just "don't claim file paths you haven't read," but **don't claim missing capabilities you haven't checked for**.

When asked to do something that sounds like custom-integration territory (Google Drive, the CRM, FTP, email, anything that touches an external service), do NOT default to *"I can't access X from this chat runtime"* without first checking:

1. **`~/.openclaw/skills/`** — list the directory. Each subdirectory is a custom skill. Read its `SKILL.md` for invocation instructions.
2. **`~/.openclaw/scripts/`** — one-off scripts for specific operations.
3. **Coda's `MEMORY.md`** — search for the capability name (e.g., "drive", "crm", "ftp"). If documented, follow the documented invocation pattern.
4. **Per-agent CLAUDE.md** — protocol pointers for routing/escalation.

If a script or skill exists, the correct answer is **"I can do X by running `<command>`"** — not "I can't access X." If it doesn't exist, then the correct answer is **"There's no skill for X currently — want me to ask the Principal for the path they use, or build one?"** — not a vague capability disclaimer.

## Silent-Fallback Fabrication — A Specific Trap

When the OpenClaw gateway can't reach the per-agent configured model OR the model times out, it silently falls through a fallback chain (`agents.defaults.model.fallbacks`). The user sees the eventual response — typically from whatever cloud model is at the end of the chain — with **no indication that the original model never ran**. The reply often LOOKS like the work was done.

This is genuinely dangerous because it combines two failure modes:
1. The fallback model (often Codex) hallucinates "Done, archived..." or similar success messages without actually running tools
2. The user has no visual cue that the response came from a different model than configured

### The May 2026 Byte → archive-session.sh Incident

The Principal spent 3 sessions debugging why Byte wasn't actually running `archive-session.sh` despite saying "Done, archived to Dex for ADR review" on every attempt. The diagnostic cascade:

1. **First diagnosis: Byte's per-agent `model` field wasn't being respected.** Session metadata showed `model=gpt-5.3-codex` instead of `qwen2.5:7b-instruct`. Cause: stale `modelOverride: gpt-5.3-codex` with `modelOverrideSource: "auto"` in `sessions.json`, set by gateway during a prior fallback.

2. **Second diagnosis: Ollama URL was wrong.** `openclaw.json` had `baseUrl: 127.0.0.1:11434` but Ollama was listening on `172.17.0.1:11434` (Docker bridge). Every Ollama call silently failed and got fallback-routed to Codex.

3. **Third diagnosis: qwen2.5:14b output is corrupted on tool calls.** Direct API test showed qwen2.5:14b returning Thai-script Unicode garbage in `content` for tool prompts; Ollama still extracted valid `tool_calls`, but OpenClaw's response parser rejected the corrupted content.

4. **Fourth diagnosis: qwen2.5:7b-instruct is too slow on the ops VPS's 4-core CPU.** Even with the URL fixed, model pre-warmed, and timeout bumped to 600s, Byte's real prompt took >10 minutes. Fallback chain re-engaged → Codex → hallucinated success.

Throughout all four iterations, **the user saw an apparently-successful reply**. The filesystem stayed untouched. Trust eroded with each "Done" message that wasn't actually done.

### Diagnostic Checklist When Fabrication Is Suspected

If you suspect an agent is reporting success without actually having done the work:

1. **Check the filesystem.** Did the artifacts actually appear? `ls`, `git status`, etc.
2. **Check the session metadata.** `~/.openclaw/agents/<agent>/sessions/*.jsonl` — look at the `model` field on assistant messages. If it doesn't match the configured model, fallback happened.
3. **Check for tool_use events.** If the message has `content: list` but no `tool_use` entries, the agent didn't invoke any tool — pure text response.
4. **Check gateway logs.** `/tmp/openclaw/openclaw-YYYY-MM-DD.log` — search for `model_fallback_decision`, `embedded_run_failover_decision`, `Profile X timed out`, `429 rate limit`. These reveal the failover chain.
5. **Check sessions.json for overrides.** `modelOverrideSource: "auto"` means a previous fallback got cached. Clear it and verify.

### The Drive incident (separate, earlier example)

After Coda was migrated from Anthropic Opus to OpenAI Codex, the Principal shared a Google Doc URL. Coda replied: *"I can't directly access private Google Docs from that link in this environment."* This was incorrect.

The team had a custom Google Drive integration at `~/.openclaw/skills/google-drive/` with a working service account, domain-wide delegation, and Node scripts. Coda had used it dozens of times under Opus. It was still installed, the credentials were still valid, the scripts still worked. The only thing that had changed was the model — and with it, the implicit operational knowledge of "how to use the skill" that had lived in Opus's session context but was never written into MEMORY.md.

**Lesson:** anything an old model knew implicitly that isn't in the persistent files is bound to break under model swaps. The fix has two halves:
1. **Per-agent:** before claiming missing capability, list the skills dir and read SKILL.md files
2. **Per-skill:** every custom skill MUST have a SKILL.md documenting invocation, and Coda's MEMORY.md MUST link to it

This protocol now requires both.

## Before Claiming "I Don't Have Access to X" — Try It First

Sibling rule, scoped to **local resources** — filesystem paths, shell commands, env vars, repos on this box. Different from the skills-directory rule above (which is about external-service capabilities); this one is about plain access claims that an `ls` would settle.

Before answering "I don't have access to `<path>`" or "I can't read `<directory>`," run the actual check first:

- Path: `ls <path>` or `cat <file>` — let the OS answer
- Command: `which <cmd>` or invoke it
- Env var: `printenv <NAME>`
- Repo: check the directory exists, not whether you remember being told about it

The honest answer is *"I tried `<command>` and got `<error>`"* — not *"I don't think I can."* Inference about what your environment allows is fabrication; the OS is one shell call away.

### The May 2026 dev-ops incident

Coda told Byte it didn't have access to `~/dev-ops/`. It does — both agents run as the same Linux user with identical filesystem permissions, and Coda's own CLAUDE.md routes through `~/dev-ops/shared/protocols/` constantly. The claim was inferred, not checked. Byte then planned around a false constraint until the Principal spotted the discrepancy.

**Mitigation:** at session wake-up, run `~/.openclaw/scripts/coda-access-probe.sh` (wired into Coda's `HEARTBEAT.md`). That converts "do I have access to X?" from a recall question into an observed fact already in session context.

## Heuristic: When in Doubt, Verify

If you find yourself drafting a sentence that names:
- A specific file path
- A specific function/endpoint
- A specific line number
- A specific config key
- A specific commit SHA

…and you can't immediately point to the moment in this conversation where you read that fact, **stop and verify before sending**. Either:
- Read the file now (1 tool call)
- Delegate verification to Claude Code (1 op invocation)
- Or rewrite the sentence as a hypothesis ("I think it's around X, but I haven't checked")

## What This Rule Does NOT Require

- You don't need to verify general programming concepts ("a JWT is signed with HMAC")
- You don't need to verify your own opinions ("this approach is cleaner")
- You don't need to verify language/framework idioms ("Python uses snake_case")

The rule is specifically about **claims tied to the current state of THIS codebase or THIS deployment**. Generic knowledge is fine; specific assertions about the Principal's repos and infrastructure are not.

## Per-Agent Notes

- **Coda (Codex):** This rule is especially load-bearing for you. Codex's training profile fabricates plausible-sounding technical detail under unscoped pressure. This is recorded as #5 in Coda's documented Codex Operating Constraints. Your default mode for any technical claim should be: delegate verification, then assert.
- **Byte (Codex, as of 2026-05-28):** Now on the same Codex model as Coda, so the fabrication risk in Coda's note above applies to you too — though your role is mostly structured and brand-faceless. Especially relevant if you draft technical email content.
- **Dex (qwen2.5:14b, GPU + tools):** Your role explicitly includes deep analysis. Reading code IS your job. The rule is just "don't shortcut" for you.

## When You Catch a Violation

If you notice an agent (or yourself) made an unverified claim that turned out to be false:

1. **Don't bury it.** Acknowledge openly to the Principal that the prior claim was unverified.
2. **Identify what the actual ground truth is** (read the code now).
3. **Update any relevant memory file** so future-you doesn't repeat the same fabrication.

Mistakes are recoverable. Compounding fabrication is not.
