# [ADR-003] Three In-Repo Pens, Single Shared Notebook

- **Status:** Approved (Sanitized 2026-09-12 for public release)
- **Date:** 2026-09-11
- **Author(s):** yegear / design session

---

## 1. Problem Context

Users require multiple input surfaces (AI agent prompt, automation script, declarative git routine) to record reminders without incurring dependencies on external calendar servers, email inboxes, or heavy cloud platforms. Without clear boundaries, each input channel risks expanding into a separate standalone product.

## 2. Decision Taken

Restrict in-repo input interfaces ("pens") to:

1. **MCP (Model Context Protocol):** AI agent stdio pen.
2. **HTTP API:** Machine automation pen and backend target for the MCP server.
3. **YAML (`routines.yaml`):** Declarative infrastructure routine pen.

Explicitly out of scope in this repository: CalDAV, IMAP/SMTP email polling, Telegram bots, WhatsApp socket listeners, or GitHub issues as reminder queues. The operator Web UI was later incorporated into the repository per [ADR-007](007-in-repo-web-ui.md). External chat bots or messaging services interact strictly as external **HTTP callers** (`POST /jobs`). Messaging client protocol code does not reside here.

Destination addressing supports aliases (e.g., `eu`) resolved via `WHATSAPP_ALIASES` (historical env name) with fallback default `to='eu'`.

## 3. Alternatives Considered

- **MCP only:** Unusable from curl, shell scripts, cron jobs, and non-LLM automations.
- **Embedded messaging client in container:** Would duplicate session state, authentication keys, outbound queues, and anti-ban safeguards. The scheduler strictly manages schedule state and issues outbound HTTP `POST /send`.
- **Google Calendar / CalDAV sync:** Involves complex OAuth flows and remote polling; conflicts with local homelab isolation.

## 4. Consequences and Trade-offs

### Positive

- Unified internal job model; three versioned ingestion surfaces within the repository.
- Future integrations act as downstream HTTP API clients rather than competing scheduler instances.

### Negative / Accepted Risks

- Scheduling from mobile devices requires an external caller (e.g., external webhook bot).
- Dual API key management: `SCHEDULE_API_KEY` (secures this API) vs `WHATSAPP_API_KEY` (authenticates outbound dispatch to the gateway).

## 5. References and Links

- `.agent/CHANNELS.md`
- `.agent/skills/whatsapp-dispatch/SKILL.md`
- [ADR-007: Web UI in Repo](007-in-repo-web-ui.md)
