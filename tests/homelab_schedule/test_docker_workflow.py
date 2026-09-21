from pathlib import Path

import yaml


def test_docker_publish_workflow_contract() -> None:
    workflow_path = Path(".github/workflows/docker-publish.yml")
    assert workflow_path.exists(), "Workflow .github/workflows/docker-publish.yml must exist"

    content = workflow_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)

    assert "name" in data
    # Triggers
    on_triggers = data.get("on") or data.get(True)
    assert on_triggers is not None, "Workflow must define 'on' triggers"
    assert "workflow_dispatch" in on_triggers
    assert "push" in on_triggers
    assert "main" in on_triggers["push"].get("branches", [])
    assert "v*.*.*" in on_triggers["push"].get("tags", [])

    # Jobs & Permissions
    assert "jobs" in data
    assert "build-and-push" in data["jobs"]
    job = data["jobs"]["build-and-push"]

    assert job.get("permissions", {}).get("packages") == "write"
    assert job.get("permissions", {}).get("contents") == "read"

    steps = job.get("steps", [])
    step_uses = [s.get("uses", "") for s in steps]

    assert any(u.startswith("actions/checkout") for u in step_uses)
    assert any(u.startswith("docker/setup-buildx-action") for u in step_uses)
    assert any(u.startswith("docker/login-action") for u in step_uses)
    assert any(u.startswith("docker/metadata-action") for u in step_uses)
    assert any(u.startswith("docker/build-push-action") for u in step_uses)

    # Metadata Action config
    meta_step = next(s for s in steps if s.get("uses", "").startswith("docker/metadata-action"))
    meta_with = meta_step.get("with", {})
    images_str = meta_with.get("images", "")
    assert ("ghcr.io/${{ github.repository_owner }}/homelab-schedule" in images_str or
            "${{ env.REGISTRY }}/${{ github.repository_owner }}/homelab-schedule" in images_str)
    tags_str = meta_with.get("tags", "")
    assert "type=semver" in tags_str
    assert "type=sha" in tags_str
    assert "type=ref,event=branch" in tags_str
    assert "type=raw,value=latest" in tags_str

    # Build and Push Action config
    build_step = next(s for s in steps if s.get("uses", "").startswith("docker/build-push-action"))
    build_with = build_step.get("with", {})
    assert build_with.get("context") == "."
    assert build_with.get("file") == "./Dockerfile"
    assert build_with.get("push") is True
    assert build_with.get("cache-from") == "type=gha"
    assert build_with.get("cache-to") == "type=gha,mode=max"


def test_docker_compose_and_env_contract() -> None:
    compose_path = Path("docker-compose.yml")
    assert compose_path.exists()
    compose_data = yaml.safe_load(compose_path.read_text(encoding="utf-8"))
    service = compose_data.get("services", {}).get("homelab-schedule", {})

    image = service.get("image", "")
    assert "ghcr.io/yegear1/homelab-schedule" in image
    assert "HOMELAB_SCHEDULE_VERSION" in image

    env_example_path = Path(".env.example")
    assert env_example_path.exists()
    env_content = env_example_path.read_text(encoding="utf-8")
    assert "HOMELAB_SCHEDULE_VERSION=" in env_content
