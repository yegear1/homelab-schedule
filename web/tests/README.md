# Browser foundation tests

From the repository root, after `npm --prefix web ci`:

```bash
npm --prefix web exec -- playwright install chromium --only-shell
npm --prefix web run test:e2e
```

Requires Node 22 and Python 3.13+ (standard library only for the disposable API).
Playwright launches Chromium headless shell, a loopback API fixture on port 18003,
and Vite on port 15173. Both ports must be free; existing servers are never reused.
Browser traffic outside the local Vite origin is blocked, including remote fonts.
No production API, database or gateway is used. Credentials are synthetic.

The tests exercise absent/saved/cleared credentials, wrong JSON content type,
all API proxy prefixes, direct entry to the four existing screens, and generated
color/alpha/spacing/radius utilities under both themes. Existing Python source
contract tests remain in place. These tests establish a foundation; they do not
claim full feature, mobile, real-device or production integration coverage.

`npm --prefix web run check:e2e` strictly typechecks configuration and browser tests.
Failed traces/results are written under `/tmp/homelab-schedule-playwright-results`.
Set `PLAYWRIGHT_BROWSERS_PATH` consistently during installation and execution to
use a custom browser cache (this task used `/tmp/homelab-playwright`).

Manual development defaults to `http://localhost:8003`; set `SCHEDULE_DEV_API_URL`
to use another backend. This is a Vite server-only setting, never a browser key.
API requests on contacts/jobs/templates/health/backup/routines/housekeeping are
proxied; document navigations sharing those paths receive the SPA.
