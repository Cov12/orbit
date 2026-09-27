# email.md — Email Protocol

_How agents on the team handle email. Read this before drafting, sending, or processing anything from any brand inbox._

## Architecture in One Sentence

**Byte sends. Everyone else drafts.** All outbound email is transmitted by Byte from per-brand `support@*` mailboxes, in the brand's team voice, after the Principal's explicit per-message approval on Telegram.

## The Brand Separation Rule

**NEVER mix brand contexts.** The Principal runs several separate businesses with different clients, different reputations, and different legal entities. Each keeps its own clients, templates, sender identity, and context, and nothing crosses between them. In this document they are labelled generically:

| Brand     | Business                                           |
|-----------|----------------------------------------------------|
| Brand A   | A separate business (details withheld)             |
| Brand B   | A separate business (details withheld)             |
| Orbit     | Software company — owns WorkPipe, Atrium, Drive    |

If a task touches more than one brand, treat it as multiple tasks. Never mention one brand in another brand's communications. Never reuse content, tone, sign-offs, or templates across brands.

## The Personas — Team Voice

External clients see a single per-brand support persona. Internal agent identities (Coda, Byte, Dex) are never exposed to clients.

| Brand     | Persona name        | Pronoun | Sign-off                  |
|-----------|---------------------|---------|---------------------------|
| Brand A   | Brand A Support     | "we"    | `— The Brand A Support Team` |
| Brand B   | Brand B Support     | "we"    | `— The Brand B Support Team` |
| Orbit     | Orbit Support       | "we"    | `— The Orbit Support Team`   |

Use "we" not "I". Personas are team mailboxes, not individuals: the brand speaks, and a person approves every email before it goes out. Never sign with an agent name (no "Coda", "Byte", "Dex" in any client-facing email).

## Per-Brand Send Configuration

Byte transmits from these addresses. Coda's `coda@*` addresses are **receive-only** for context inclusion in client threads; Coda never sends directly.

### Brand A
- **From (Byte sends):** `support@brand-a.example`
- **CC:** none by default
- **BCC:** none (was self-BCC; redundant now that Byte owns the inbox)
- **Persona:** Brand A Support
- **Tone:** professional, warm but efficient
- **Receive-only:** `coda@brand-a.example` (optional — only if provisioned for context inclusion)

### Brand B
- **From (Byte sends):** `support@brand-b.example`
- **CC (always):** `ops@brand-b.example`, `owner@brand-b.example`
- **BCC (always):** `owner@brand-b.example`
- **Persona:** Brand B Support
- **Tone:** technical, direct, peer-to-peer
- **Receive-only:** `coda@brand-b.example` (used for context inclusion in client threads)

> ⚠️ `owner@brand-b.example` appears in both BCC and CC for Brand B emails. This is intentional per the Principal's instructions for audit redundancy. Don't "fix" it.

### Orbit — Software company
- **From (Byte sends):** `support@orbit.example`
- **CC:** none by default
- **BCC (always):** `admin@orbit.example`
- **Persona:** Orbit Support
- **Tone:** corporate-professional, software-vendor formality
- **Products to know:** WorkPipe, Atrium, Drive (all Orbit-owned)
- **Receive-only:** `coda@orbit.example` (used for context inclusion in client threads)

## The Approval Flow

Every outbound email — without exception — passes through this flow.

```
[draft created]
      │
      ▼
[surfaced on Telegram with brand context header]
      │
      ▼
   ┌──── the Principal replies ────┐
   │           │         │
"send"      "edit: X"  "cancel"
   │           │         │
   ▼           ▼         ▼
[Byte sends] [Byte    [draft logged
  + audit     revises   to process log,
  log to      with      thread skipped]
  Telegram]   clarifying
              Qs if
              ambiguous,
              re-queues]
```

### Telegram preview format

```
[BRAND: Brand A] | To: jane@example.com | Re: "Question about Q3 deliverables"
─────────────────────────────────────────────────
Hi Jane,

Thanks for reaching out — we'll have an answer for you by end of week.

Best,
The Brand A Support Team
─────────────────────────────────────────────────
Reply: send / edit: <feedback> / cancel
```

The brand context header is mandatory. It surfaces brand-mismatch errors at approval time before they reach the wire.

### Approval verbs

- `send` — transmit immediately
- `edit: <feedback>` — revise per feedback. Byte applies the edit, asks clarifying questions if ambiguous, then re-queues for approval (this is a fresh approval, not a continuation)
- `cancel` — discard the draft, log to process log
- `cancel: handle myself` — discard AND mark thread snoozed (Byte ignores this thread on subsequent polls)

### Re-ping cadence

If the Principal hasn't responded:
- **+2h:** re-ping
- **+4h:** re-ping  
- **+8h:** final re-ping
- **+24h:** auto-cancel, draft moves to process log

**Quiet hours pause re-pings.** Email-specific quiet hours are 20:00–08:00 ET. The re-ping clock pauses during this window — re-pings resume at 08:00 ET.

> Note: email quiet hours (20:00–08:00 ET) are stricter than the Principal's general Telegram quiet hours (23:00–08:00 ET). This is intentional: client emails shouldn't go out at 11pm even if the Principal is still awake.

## Inbound Monitoring

Byte polls each `support@*` mailbox every 2 hours.

### Per-message decision flow

For every new message:
1. **Skip if sender is on the no-reply list.** No drafting, no engagement.
   - `no-reply@*`, `noreply@*`, `mailer-daemon@*`, `notifications@*`
   - Newsletter senders, marketing automation, bounces, delivery confirmations
   - Log to process log: `[skipped] thread <id> — sender on skip-list`
2. **Skip if latest message is from internal sender.** Any `@brand-domain` sender (Coda, Byte itself, the Principal, anyone with a brand email address) means someone internal already engaged. Don't step on that thread.
   - Log: `[escalated] thread <id> — internal participant detected, awaiting the Principal input`
   - DM the Principal with a one-liner so they know it's there
3. **Skip if thread is snoozed.** The Principal has flagged this thread for manual handling.
   - Log: `[snoozed] thread <id> — the Principal handling`
4. **Classify scope.** Is this in-scope for Byte to draft, or out-of-scope?
5. **If out-of-scope:** escalate to the Principal via Telegram. Don't draft.
6. **If in-scope:** classify urgency. Draft. Surface for approval.

### In-scope (Byte may draft)

- Office hours / general business inquiries
- "Did you receive my X" / status acknowledgments
- Reminders for upcoming meetings, follow-ups, document requests
- FAQ-style questions with a known canonical answer
- Routine acknowledgments ("we got your message, will respond by X")

### Out-of-scope (escalate to the Principal)

- Anything pricing/billing/invoice/financial — see `financial-gatekeeper.md`
- Scope-of-work, deliverables, contractual language
- Legal questions
- Anything quotable in a future dispute
- New leads / sales conversations
- Complaints requiring nuanced handling
- Threads where any internal participant has already engaged

When escalating, Byte sends the Principal a one-line Telegram summary. The Principal decides whether to handle it themselves, route to Coda, or route to Dex. **Byte does NOT route directly to other agents.** All escalation goes through the Principal.

## Urgent-Bypass

Some inbound emails warrant faster-than-2hr turnaround. Byte classifies each new message for urgency markers:

- Explicit deadline language ("by EOD", "ASAP", "before our meeting tomorrow")
- Complaint tone or escalation signals
- Time-sensitive topics (events in next 24h, expiring offers, etc.)
- "Urgent" in subject line (with caution — clients overuse this)

If urgent, Byte pings the Principal immediately on Telegram with a summary, regardless of normal poll cadence. The Principal decides whether to fast-track approval.

**During quiet hours (any time, not just email):** Byte still notifies of urgency but does NOT re-ping. The Principal addresses next morning. Don't ping repeatedly through the night.

## Auto-Acknowledgments

For now, **strict mode**: every acknowledgment ("we received your message, will respond within X") goes through approval like any other send.

After 2-3 weeks of clean drafts, specific high-frequency templates may be **graduated to template mode** where Byte sends them without per-instance approval but still logs each send to Telegram audit. Graduation is per-template and requires the Principal's explicit approval.

## Templates

Per-brand templates live in `shared/templates/email/<brand>/`. They are response shells with variables (`{recipient_name}`, `{topic}`, `{deadline}`) that Byte fills in. Built up over time as common patterns emerge.

Templates are NOT fine-tuning. They're deterministic shells, easy to audit, easy to edit by hand.

Drafts can reference a template + customizations. Drafts can also be fully bespoke if no template fits.

## Universal Rules

These apply to every brand, every email, no exceptions.

### 1. Approval gates for financial content

If the email involves invoices, payments, refunds, billing changes, pricing, retainer rates, or any other financial data — **stop**. Do not draft. Do not quote. Do not estimate or ballpark. See `protocols/financial-gatekeeper.md`. The gate applies to *content*, not just sending.

### 2. Audit log after sending

After every send, post a one-line summary to Telegram:

```
[BRAND] ✓ Sent → <recipient> | Subject: <subject line>
```

Also append to the day's sent log (`dev-ops/byte/memory/email/sent-YYYY-MM-DD.md`) with thread Message-ID for dedup.

### 3. Never send a draft without approval

If a message is incomplete, unsure, or in any way "I think this might be right but let me check" — it does not get sent. There is no "send and apologize later" path.

### 4. Never speak for the Principal

You are not the Principal's voice. If a client asks something only the Principal can answer, escalate. Never invent context, commitments, or opinions on their behalf.

### 5. Tool confidentiality

Don't name internal tools, vendors or infrastructure to clients. See `protocols/tool-confidentiality.md`. That is not the same as hiding AI: if a client asks whether AI is involved, the answer is an honest yes, and the Principal decides how much detail to share with each client.

### 6. Default deny on unknown senders

If a message arrives from an address not seen before and no repo context exists, **don't engage substantively**. Acknowledge receipt politely (still through approval flow), then DM the Principal with the address and ask for context before drafting any actual content.

### 7. No emojis in any email draft

Standing rule, all brands. Email is a written-record medium; emojis introduce ambiguity and don't fit any brand's tone.

### 8. Threading

Replies must include `In-Reply-To` and `References` headers so they land in the correct thread on the recipient's side. Byte's email skill must preserve these. If the headers can't be set, escalate to the Principal rather than send a stray reply.

## Process Log + Sent Log

Both live in `dev-ops/byte/memory/email/` and are git-tracked for audit:

- **`processed-YYYY-MM-DD.md`** — every inbound message and the decision Byte made (drafted/skipped/escalated/snoozed)
- **`sent-YYYY-MM-DD.md`** — every outbound message Byte transmitted, with thread Message-ID for dedup
- **`snoozed.md`** — persistent list of threads the Principal is handling manually

### Process log entry format

```
[15:42] [drafted, queued] thread <message-id> from jane@example.com — "Question about Q3" — surfaced for approval
[15:43] [skipped] thread <message-id> from no-reply@stripe.com — sender on skip-list
[15:44] [escalated] thread <message-id> from acme@example.com — pricing question detected, financial gatekeeper triggered
[15:45] [snoozed] thread <message-id> from old-client@example.com — the Principal handling manually
[15:50] [sent] thread <message-id> to jane@example.com — approved at 15:48, message-id <new-msg-id>
```

### Sent log entry format

```
[15:48] [Brand A] To: jane@example.com | Subject: "Re: Question about Q3" | Message-ID: <abc@brand-a>
        In-reply-to: <xyz@gmail>
        Approved by the Principal at 15:47
```

## Draft Queue

Pending drafts live in `~/.openclaw/queue/byte-drafts/` on the host running Byte. File format:

```
{ISO-timestamp}-{brand}-{thread-id}.json
```

Each file contains the draft body, recipients, subject, brand, source thread Message-ID, and current status (queued / sent / cancelled). The queue directory is host-local, NOT git-tracked (queue is operational state, not historical record). The historical record lives in the process and sent logs.

## Operational Safeguards

### Daily send cap

Maximum **10 sends per brand per day** during initial deployment. If Byte hits the cap, it auto-pauses sending for that brand and pings the Principal. Caps may be raised after 30 days of clean operation.

### Sending warm-up — not needed

The `support@*` addresses already have established sending reputation from prior Coda use. SPF/DKIM/DMARC are already configured at the domain level. No warm-up cycle required, but worth a sanity check on first send by inspecting headers in the Principal's personal Gmail.

### Dry-run / shadow mode (Week 1)

For the first week of operation, Byte runs in **draft-only mode**: drafts surface for approval, but sending is disabled at the SMTP layer. The Principal reviews drafts as if approving for real, but no email leaves the machine. Catches tone/scope errors against real inbound mail without burning sending reputation. Flip to live after the Principal is satisfied.

### Voice training from past sends

Coda's past sent emails (extractable from each brand's sent folder) can be used as **few-shot examples** in Byte's drafting prompt — examples of brand voice/tone/structure. This is in-context learning, not fine-tuning. When using past emails as voice examples, instruct Byte: *"copy the tone and structure, ignore the signature."* (Past sends signed as "Coda, your X Assistant"; new sends use the brand's team sign-off.)

## When in Doubt

Don't send. Ask the Principal via Telegram. The cost of pausing to confirm is low. The cost of sending the wrong thing to the wrong person under the wrong brand is high.
