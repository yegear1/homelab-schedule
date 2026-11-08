"""Exercise the actual TypeScript transport with Node's native type stripping."""

import json
import re
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
API_FILE = REPO_ROOT / "web/src/lib/api.ts"
HARNESS = """
import assert from 'node:assert/strict';
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const {api, ApiClientError} = await import(API_URL);
const operations = [
  () => api.getContacts(),
  () => api.downloadCsv('/jobs/export.csv', new URLSearchParams()),
  () => api.downloadDatabase(),
];
""".replace("API_URL", json.dumps(API_FILE.as_uri()))


def _run_client(script: str) -> None:
    result = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module"],
        input=HARNESS + script,
        text=True,
        capture_output=True,
        cwd=REPO_ROOT,
        timeout=15,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_no_embedded_browser_credential() -> None:
    for path in (REPO_ROOT / "web/src").rglob("*"):
        if path.is_file():
            assert re.search(rb"hl_prod_[a-zA-Z0-9]+", path.read_bytes()) is None


def test_key_and_base_url_storage_survive_client_reload() -> None:
    _run_client("""
assert.equal(api.getApiKey(), '');
delete globalThis.window;
assert.equal(api.getApiKey(), '');
globalThis.window = {};
api.setApiKey('synthetic-test-key');
api.setBaseUrl('https://example.invalid///');
const reloaded = await import(`${API_URL}?reload=1`);
assert.equal(reloaded.api.getApiKey(), 'synthetic-test-key');
globalThis.fetch = async (url, options) => {
  assert.equal(url, 'https://example.invalid/contacts');
  assert.equal(options.headers.get('x-api-key'), 'synthetic-test-key');
  return Response.json({contacts: []});
};
await reloaded.api.getContacts();
""".replace("API_URL", json.dumps(API_FILE.as_uri())))


@pytest.mark.parametrize("key", ["", "synthetic-test-key"])
def test_all_transports_use_only_operator_credentials(key: str) -> None:
    _run_client("const key = " + json.dumps(key) + ";" + """
api.setApiKey(key);
const responses = [
  Response.json({contacts: []}),
  new Response('title\\r\\n', {headers: {'content-type': 'text/csv'}}),
  new Response('sqlite', {headers: {'content-type': 'application/x-sqlite3'}}),
];
let calls = 0;
globalThis.fetch = async (url, options) => {
  assert.ok(url.startsWith('/'));
  assert.equal(options.headers.get('x-api-key'), key || null);
  assert.equal(options.headers.has('Authorization'), false);
  assert.equal(options.cache, 'no-store');
  return responses[calls++];
};
for (const operation of operations) await operation();
assert.equal(calls, 3);
api.setApiKey('');
globalThis.fetch = async (_url, options) => {
  assert.equal(options.headers.has('x-api-key'), false);
  return Response.json({contacts: []});
};
await api.getContacts();
""")


def test_no_content_response_and_request_body() -> None:
    _run_client("""
globalThis.fetch = async (url, options) => {
  assert.equal(url, '/contacts/a%2Fb');
  assert.equal(options.method, 'DELETE');
  return new Response(null, {status: 204});
};
assert.equal(await api.deleteContact('a/b'), undefined);
globalThis.fetch = async (_url, options) => {
  assert.equal(options.headers.get('Content-Type'), 'application/json');
  assert.deepEqual(JSON.parse(options.body), {name: 'Test', phone: 'test-recipient'});
  return Response.json({id: 'c1', name: 'Test', phone: 'test-recipient'}, {status: 201});
};
assert.equal((await api.createContact({name: 'Test', phone: 'test-recipient'})).id, 'c1');
""")


@pytest.mark.parametrize("status", [401, 404, 409, 422, 502])
def test_http_errors_are_explicit_for_every_transport(status: int) -> None:
    _run_client(f"const status = {status};" + """
globalThis.fetch = async () => Response.json({detail: 'Synthetic failure'}, {status});
for (const operation of operations) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, status);
    assert.equal(error.detail, 'Synthetic failure');
    return true;
  });
}
globalThis.fetch = async () => new Response('<html>failure</html>', {status});
await assert.rejects(operations[0], (error) =>
  error instanceof ApiClientError && error.status === status);
""")


def test_network_errors_are_structured_for_every_transport() -> None:
    _run_client("""
globalThis.fetch = async () => { throw new TypeError('synthetic network failure'); };
for (const operation of operations) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof ApiClientError);
    assert.equal(error.status, 0);
    assert.match(error.detail, /Falha de rede/);
    return true;
  });
}
""")


def test_wrong_media_and_malformed_json_are_rejected() -> None:
    _run_client("""
globalThis.fetch = async () => new Response('<html>fallback</html>', {
  headers: {'content-type': 'text/html'},
});
for (const operation of operations) {
  await assert.rejects(operation, (error) =>
    error instanceof ApiClientError && error.status === 200);
}
globalThis.fetch = async () => new Response('{', {headers: {'content-type': 'application/json'}});
await assert.rejects(operations[0], (error) =>
  error instanceof ApiClientError && /JSON/.test(error.detail));
""")


def test_validation_details_are_narrowed_from_untrusted_json() -> None:
    _run_client("""
globalThis.fetch = async () => Response.json({detail: [
  null, 12, {msg: 42}, {msg: 'Field required', loc: ['body', 'title']},
]}, {status: 422});
await assert.rejects(operations[0], (error) => {
  assert.equal(error.detail, 'title: Campo obrigatório');
  return error instanceof ApiClientError && error.status === 422;
});
""")
