import pytest_asyncio
from httpx import AsyncClient

from conftest import auth_headers, create_work


# ── Tests ──────────────────────────────────────────────────────────────────


async def test_share_status_default(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    resp = await client.get(f"/works/{work_id}/share", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["share_enabled"] is False
    assert data["share_token"] is None


async def test_enable_sharing(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    resp = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["share_enabled"] is True
    assert data["share_token"] is not None
    assert len(data["share_token"]) == 36


async def test_disable_sharing_preserves_token(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r1 = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token = r1.json()["share_token"]

    r2 = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": False})
    assert r2.json()["share_enabled"] is False
    assert r2.json()["share_token"] == token


async def test_reuse_token_on_reenable(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r1 = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token1 = r1.json()["share_token"]

    await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": False})
    r3 = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    assert r3.json()["share_token"] == token1


async def test_public_preview_success(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r_share = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token = r_share.json()["share_token"]

    resp = await client.get(f"/public/{token}/preview")
    assert resp.status_code == 200
    data = resp.json()
    assert "work" in data
    assert data["work"]["title"] == "雾港纪事"
    assert isinstance(data["chapters"], list)


async def test_public_preview_disabled_returns_404(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r_share = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token = r_share.json()["share_token"]

    await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": False})

    resp = await client.get(f"/public/{token}/preview")
    assert resp.status_code == 404


async def test_public_preview_wrong_token_returns_404(client: AsyncClient) -> None:
    resp = await client.get("/public/00000000-0000-0000-0000-000000000000/preview")
    assert resp.status_code == 404


async def test_public_preview_no_auth_required(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r_share = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token = r_share.json()["share_token"]

    resp = await client.get(f"/public/{token}/preview")
    assert resp.status_code == 200


async def test_share_status_requires_owner(client: AsyncClient) -> None:
    h1 = await auth_headers(client, "owner@example.com")
    h2 = await auth_headers(client, "other@example.com")
    work_id = await create_work(client, h1)

    resp = await client.get(f"/works/{work_id}/share", headers=h2)
    assert resp.status_code == 404


async def test_share_toggle_requires_owner(client: AsyncClient) -> None:
    h1 = await auth_headers(client, "owner2@example.com")
    h2 = await auth_headers(client, "other2@example.com")
    work_id = await create_work(client, h1)

    resp = await client.patch(f"/works/{work_id}/share", headers=h2, json={"share_enabled": True})
    assert resp.status_code == 404


async def test_public_work_info(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    r_share = await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})
    token = r_share.json()["share_token"]

    resp = await client.get(f"/public/{token}/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "雾港纪事"
    assert data["short_intro"] == "港城故事"


async def test_workspace_bootstrap_includes_share_fields(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)

    await client.patch(f"/works/{work_id}/share", headers=headers, json={"share_enabled": True})

    resp = await client.post(f"/works/{work_id}/workspace-bootstrap", headers=headers)
    assert resp.status_code == 200
    work = resp.json()["work"]
    assert "share_enabled" in work
    assert work["share_enabled"] is True
    assert "share_token" in work
