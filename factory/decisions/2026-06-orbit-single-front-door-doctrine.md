# Orbit Single Front-Door Doctrine

Date: 2026-06-05
Status: Active
Owner: the Principal / Orbit

## Purpose

This doctrine defines the user-facing conversational surface for the Orbit ecosystem.

It is intentionally separate from, and fully consistent with, Orbit's backend Two-Brain architecture.

## Clarification: Single Front-Door vs Two-Brain

These describe different axes of the system:

- **Single Front-Door** describes the user-facing conversational experience.
- **Two-Brain** describes the backend division of labor.

Both are true at once:

- **User-facing axis:** one conversational front door, the Orbit Assistant.
- **Backend labor axis:** two-brain split, Conductor = Manager and Hermes = Employee.

The single front door is the **Hermes Employee brain**.
**Conductor is coordination infrastructure, not a competing conversational surface.**

## Two-Brain quick reference

- **Conductor = Manager**
  - orchestration
  - sessions
  - tickets
  - persona/hydration
  - dispatch and coordination

- **Hermes = Employee**
  - reasoning / LLM cognition
  - memory
  - tools
  - conversation

## Single Front-Door doctrine

### 1. One conversational front door
- The **Orbit Assistant** is the single user-facing conversational agent.
- It is the permanent front door by design.
- Atrium is a transport/UI surface, not an agent with its own reasoning layer.

### 2. One dispatcher
- The Orbit Assistant does not directly dispatch work to specialists.
- All work routing goes:
  - **User -> Orbit Assistant -> CEO -> specialists**
- CEO is the mandatory dispatcher and owns task delegation.

### 3. No local fallback brain in Atrium
- Atrium should not maintain local model routing, lane routing, intent classification, or Ollama fallback for primary chat behavior.
- Legacy local routing exists only as teardown debt until removed.
- Goal: eliminate dual-brain complexity entirely from the user-facing chat path.

### 4. One tenant key
- The canonical tenant identity is **Conductor companyId**.
- It is derived from **Portal org -> Conductor company** mapping.
- This key propagates across Conductor, Atrium, WorkPipe, and Mem0 memory scope.

### 5. Memory partitioning rule
- Mem0 memory is partitioned by Conductor companyId.
- The mechanism is already correct.
- Current limitation is operational, not architectural:
  - Portal provisioning bug **#60** collapses multiple orgs into the fallback company.

## Current tracked implications

- **#43 / #45**
  - remove Atrium legacy local routing
  - collapse dept picker to the single Orbit Assistant
- **#60**
  - fix Portal org -> company provisioning (GA blocker)
- **#66**
  - replace hardcoded ORBIT_COMPANY_ID with per-org resolution
- **#67**
  - Hermes provider-error wrapping tech debt

## Design intent

This is a deliberate simplification strategy:

- one front door
- one dispatcher
- one tenant key
- one memory partition key
- no competing local inference path in Atrium

Direct specialist chat may exist later for power users, but it is not the primary architecture.
