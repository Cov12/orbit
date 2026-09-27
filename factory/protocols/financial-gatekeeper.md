# financial-gatekeeper.md — Money Touches Need Approval

_Anything involving money stops at this checkpoint until the Principal says go._

## The rule

**For any task involving invoices, payments, refunds, billing changes,
or any other financial data — stop, ask the Principal via Telegram, and wait for
explicit approval before taking action.**

This is a hard rule. It applies to every agent on the team. There are
no exceptions for "small amounts" or "trusted clients" or "obvious
cases." Money has too many ways to go wrong, and the cost of pausing
to confirm is always lower than the cost of acting wrong.

## What counts as "financial"

If you're not sure, assume yes.

### Always counts
- Invoices: drafting, sending, modifying, voiding, reissuing
- Payments: collecting, refunding, scheduling, recording
- Billing changes: rate changes, plan changes, term changes
- Payment methods: adding, removing, updating cards/banks/ACH
- Bank info: account numbers, routing numbers, wire instructions
- Tax info: W-9s, 1099s, sales tax registrations, tax IDs
- Accounting actions: journal entries, reconciliations, write-offs
- Financial statements: P&Ls, balance sheets, cash flow reports
- Quotes and estimates that commit to a price
- Contract terms involving money (deposits, NET terms, late fees)

### Sometimes counts (use judgment, lean toward stopping)
- Discussing pricing in passing with a client
- Looking up an invoice for context
- Mentioning a payment status in a status update
- Internal cost analysis for the Principal

### Doesn't count
- Reading existing financial data for analysis (no action taken)
- Drafting a non-binding proposal for the Principal's review (not sent yet)
- Discussing financial topics in `messages/` between agents
- Talking to the Principal about financials in Telegram

## Automated drafting pipelines (Byte)

Byte's inbound email handler must classify content for financial markers **during scope classification, before any drafting begins**. The threshold for Byte is stricter than the human-judgment "sometimes counts" bucket above:

**For Byte: anything in the "always counts" OR "sometimes counts" lists triggers immediate escalation.** No drafts are generated; no quotes, no ballparks, no tier comparisons, no "rough numbers." The message is logged to the process log as `[escalated] thread <id> — financial content detected` and the Principal is pinged with a one-line Telegram summary.

This is intentional. Byte runs on a smaller model and lacks the human judgment to distinguish a casual mention of pricing from a binding pricing commitment. Better to over-escalate than under-escalate. If the Principal decides the topic is harmless and wants Byte to handle it after all, they can explicitly authorize a one-time draft via Telegram.

The financial gatekeeper applies to **content**, not just sending. Byte refusing to draft is the gate, not Byte refusing to send a finished draft.

## What "stop and ask" looks like

1. **Don't draft.** Don't compose the email, don't fill in the invoice
   form, don't open the payment portal.
2. **Don't queue.** Don't add it to your work queue with a note to
   "do later." It might get done by a future you who didn't read this
   doc.
3. **DM the Principal on Telegram immediately** with:
   - What the request is
   - Who it's for / which client / which brand
   - What action you'd take if approved
   - Any context that matters (amount, deadline, history)
4. **Wait.** Do other work. Don't sit and refresh.
5. **When the Principal replies:**
   - If approved → proceed exactly as discussed
   - If denied → acknowledge, log it, move on
   - If modified → confirm the modification before acting

## Telegram approval format

Make it easy for the Principal to approve or deny in one tap. Example:

```
[BRAND: Brand A] Financial action requires approval

Request: Send invoice #2026-0421 to client@example.com
Amount: $1,234.00
For: March retainer + Q1 ad spend reimbursement
Context: Client is on net-15. Last invoice was paid on time.
         No outstanding balance.

Action I would take: Generate invoice from the invoicing template, send via
the Brand A inbox with the standard 30-day net language and our payment portal link.

Approve? (reply YES / NO / or send modifications)
```

Be specific. The whole point is that the Principal can decide without asking
follow-up questions.

## What "approved" means

Approval is **scoped to the specific action you described**. It is not
a blanket approval for the client, the brand, or the type of action.

- Approval to send invoice #2026-0421 today is NOT approval to send
  invoice #2026-0422 next week without asking.
- Approval to refund $50 to client X is NOT approval to refund any
  amount to any client.
- Approval to add a payment method for client Y is NOT approval to
  modify it later.

If anything changes between approval and action — amount, recipient,
timing, terms, anything — re-ask.

## After the action

Every approved financial action gets two records:

### 1. Telegram audit log

After completing the action, post a one-line confirmation to Telegram:

```
[BRAND: Brand A] ✓ Sent invoice #2026-0421 to client@example.com — $1,234.00
```

### 2. HEARTBEAT entry

Log it in your `HEARTBEAT.md` under "Recent activity":

```
- 2026-04-09 14:30 UTC — [financial] Brand A invoice #2026-0421 sent
  to client@example.com for $1,234.00 (approved by the Principal 14:22)
```

This gives the Principal a paper trail they can scan in two places.

## When the Principal is unreachable

If the Principal isn't responding on Telegram and the financial action has a
deadline:

1. **Do not act.** Missing a deadline is recoverable. Sending money
   to the wrong place is not.
2. Log the attempt in HEARTBEAT with type `[blocked]`
3. If the deadline passes, write a `fyi` to whichever teammate is
   most likely to brief the Principal when they're back, explaining what was
   blocked and why
4. When the Principal reconnects, brief them immediately on the missed deadline
   and let them decide next steps

## The principle

Financial mistakes are often irreversible. Wire transfers can't be
clawed back. Sent invoices live in client inboxes forever. Refunded
charges can't be un-refunded without a new transaction.

The cost of pausing to confirm is a few minutes of latency. The cost
of acting wrong is anything from awkward to catastrophic. **Always
take the latency.**
