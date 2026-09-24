# Notice

## This edition

Orbit is a curated public edition of private, production codebases, published so that its
engineering can be reviewed. Business identifiers, customer data, credentials, pricing and
internal planning documents were removed; see the root README for what was changed and how.

## Orbit's own code

Copyright © 2024–2026 Covals D. ([@Cov12](https://github.com/Cov12)). All rights reserved.

The code written for Orbit is **source-available for review**. No license is granted to use,
copy, modify or distribute it, except where an upstream license below governs a portion of the
code.

## Upstream projects

Orbit adopts open-source projects rather than rebuilding them. Their licenses and attribution
are retained.

| Orbit component | Built on | License | Where |
|---|---|---|---|
| Atrium | [Open WebUI](https://github.com/open-webui/open-webui) | BSD-3-Clause with Open WebUI's branding clause | [`apps/atrium/LICENSE`](apps/atrium/LICENSE) |
| Conductor | [Paperclip](https://github.com/paperclipai/paperclip) | MIT | [`apps/conductor/LICENSE`](apps/conductor/LICENSE) |
| Agent runtime | [Hermes Agent](https://github.com/NousResearch/hermes-agent) (Nous Research) | MIT | [`apps/agent-runtime/UPSTREAM-LICENSE`](apps/agent-runtime/UPSTREAM-LICENSE) |

**Open WebUI branding.** Open WebUI's license forbids removing or replacing its branding.
Atrium keeps it: the product displays as "Orbit Atrium (Open WebUI)" — upstream's own mechanism
for custom names — and the upstream logo is unchanged.

Third-party packages installed by each app's package manager are covered by their own licenses.
