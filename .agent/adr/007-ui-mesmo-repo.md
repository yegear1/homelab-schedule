# [ADR-007] Operator Web UI in Same Repository (`web/` and `proto/`)

- **Status:** Approved
- **Date:** 2026-09-12
- **Author(s):** yegear / design session

---

## 1. Problem Context

The contacts, templates, and jobs endpoints exist and the interface contract [INTERFACE.md](../INTERFACE.md) is approved. Stitch design prototypes exist in `proto/scr-*/code.html`. The repository requires a dedicated location for the web application without polluting `src/homelab_schedule/` and without spinning up a separate runtime container.

## 2. Decision Taken

Incorporate the frontend directly within the repository structure:

- **`proto/`:** Preserved visual design source (Stitch HTML/Tailwind prototypes). Kept intact for reference; never deleted during porting.
- **`web/`:** Single Page Application (SPA) built with Svelte 5 and Vite. Component hierarchy: `web/src/layout/`, `web/src/components/`, `web/src/pages/`.
- **Frontend Stack:** Svelte 5 (Runes), Tailwind CSS (tokens derived from Stitch and Apple HIG design systems). Prohibit React or Vue.
- **Production Runtime:** Served by the existing FastAPI process via `StaticFiles` mounted from `web/dist/`. Authenticated with operator `x-api-key`.
- In-repo pens remain: MCP, HTTP, and YAML are maintained alongside Web UI as the fourth input surface.

This explicitly amends the earlier "no UI in repo" constraint from [ADR-003](003-canetas.md) specifically for the local human operator Web UI. CalDAV, IMAP email, and messaging clients remain strictly out of scope.

## 3. Alternatives Considered

- **Separate frontend repository:** Causes duplicated interface contracts and violates single-container homelab deployment simplicity.
- **Directly serving static HTML from `proto/`:** Fails to provide reactive state bindings, dynamic API synchronization, or type safety.
- **Embedding Svelte source inside `src/homelab_schedule/`:** Conflates Python packaging tooling with Node.js frontend build systems.

## 4. Consequences and Trade-offs

### Positive

- Porting follows the `ui-port` and `component-contract` skills with predictable component layout.
- Prototypes in `proto/` remain accessible side-by-side for visual regression auditing.

### Negative / Accepted Risks

- Production Docker multi-stage build requires an intermediate Node.js build stage.
- Directory artifacts `node_modules/` and `web/dist/` must remain untracked in `.gitignore`.

## 5. References and Links

- `.agent/INTERFACE.md`
- [ADR-003: Three In-Repo Pens](003-canetas.md)
- `proto/scr-*/code.html`
