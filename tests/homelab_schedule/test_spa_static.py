from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from homelab_schedule.config import Settings
from homelab_schedule.main import create_app
from tests.homelab_schedule.fakes import RecordingDispatcher


@pytest.fixture
def mock_dist(tmp_path: Path) -> Path:
    dist = tmp_path / "dist"
    dist.mkdir()
    assets = dist / "assets"
    assets.mkdir()
    (dist / "index.html").write_text("<!DOCTYPE html><html><body>Mock App</body></html>")
    (assets / "bundle.js").write_text("console.log('test');")
    return dist


@pytest.fixture
def spa_app(mock_dist: Path, tmp_path: Path) -> FastAPI:
    settings = Settings(
        schedule_api_key="test-api-key",
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us",
        routines_path=str(tmp_path / "routines.yaml"),
        _env_file=None,
    )
    return create_app(
        settings,
        dispatcher=RecordingDispatcher(),
        dist_dir=mock_dist,
    )


@pytest.fixture
def client(spa_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(spa_app) as test_client:
        yield test_client


def test_root_serves_index_html(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "<!DOCTYPE html>" in response.text
    assert "Mock App" in response.text


def test_assets_served_statically(client: TestClient) -> None:
    response = client.get("/assets/bundle.js")
    assert response.status_code == 200
    assert "console.log('test');" in response.text


def test_browser_navigation_to_auth_route_returns_index_html(client: TestClient) -> None:
    response = client.get("/contacts", headers={"Accept": "text/html,application/xhtml+xml"})
    assert response.status_code == 200
    assert "Mock App" in response.text


def test_browser_navigation_to_unmatched_route_returns_index_html(client: TestClient) -> None:
    response = client.get("/unknown-page", headers={"Accept": "text/html"})
    assert response.status_code == 200
    assert "Mock App" in response.text


def test_api_request_to_auth_route_without_key_returns_401_json(client: TestClient) -> None:
    response = client.get("/contacts", headers={"Accept": "application/json"})
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid or missing api key"}


def test_post_without_key_with_html_accept_returns_401_json(client: TestClient) -> None:
    response = client.post("/contacts", json={"name": "Test"}, headers={"Accept": "text/html"})
    assert response.status_code == 401
    assert response.json() == {"detail": "invalid or missing api key"}


def test_api_request_to_missing_route_returns_404_json(client: TestClient) -> None:
    response = client.get("/unknown-route", headers={"Accept": "application/json"})
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}


def test_favicon_without_file_returns_204(client: TestClient) -> None:
    response = client.get("/favicon.ico")
    assert response.status_code == 204


def test_when_dist_not_found(tmp_path: Path) -> None:
    empty_dist = tmp_path / "non_existent_dist"
    settings = Settings(
        schedule_api_key="test-api-key",
        database_path=str(tmp_path / "schedule.sqlite"),
        whatsapp_aliases="eu=5511999998888@c.us",
        routines_path=str(tmp_path / "routines.yaml"),
        _env_file=None,
    )
    app = create_app(
        settings,
        dispatcher=RecordingDispatcher(),
        dist_dir=empty_dist,
    )
    with TestClient(app) as test_client:
        r_root = test_client.get("/")
        assert r_root.status_code == 404

        r_nav = test_client.get("/contacts", headers={"Accept": "text/html"})
        assert r_nav.status_code == 401
        assert r_nav.json() == {"detail": "invalid or missing api key"}
