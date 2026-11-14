import asyncio
import json
import time
from datetime import date

import httpx
import numpy as np
import pytest
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from rasterio.warp import transform

from app.sources.modis import ModisRows, fetch_modis
from app.sources.planetary_modis import BASE_URL, NDVI, QUALITY, fetch_planetary_modis, read_pixel


def scene(day, platform="terra", stamp=None):
    prefix = "MOD13Q1" if platform == "terra" else "MYD13Q1"
    identifier = f"{prefix}.A2024{day:03d}.test"
    return dict(id=identifier, properties=dict(platform=platform, datetime=None,
                start_datetime=stamp or f"2024-01-{day:02d}T00:00:00Z"),
                assets={band: dict(href=f"https://modiseuwest.blob.core.windows.net/modis-061-cogs/{identifier}/{band}.tif")
                        for band in [NDVI, QUALITY]})


def test_read_pixel_reprojects_and_rejects_nodata_and_outside():
    x, y = transform("EPSG:4326", "EPSG:3857", [25], [10])
    with MemoryFile() as memory:
        with memory.open(driver="GTiff", width=2, height=1, count=1, dtype="int16", nodata=-3000,
                         crs="EPSG:3857", transform=from_origin(x[0]-5, y[0]+5, 10, 10)) as dataset:
            dataset.write(np.array([[5000, -3000]], dtype="int16"), 1)
        assert read_pixel(memory.name, 10, 25) == 5000
        lon, lat = transform("EPSG:3857", "EPSG:4326", [x[0]+10], [y[0]])
        assert read_pixel(memory.name, lat[0], lon[0]) is None
        assert read_pixel(memory.name, -10, -25) is None


def test_stac_pages_terra_sas_container_quality_scale_and_monthly_mean(monkeypatch):
    calls = []
    first, last = date(2024, 1, 1), date(2024, 1, 31)

    def handle(request):
        calls.append(request)
        assert "authorization" not in request.headers
        if request.url.path.endswith("search"):
            assert json.loads(request.url.params["query"]) == {"platform": {"eq": "terra"}}
            assert json.loads(request.url.params["intersects"])["coordinates"] == [-101, 25.4]
            return httpx.Response(200, json=dict(features=[scene(1), scene(2), scene(3, "aqua")],
                links=[dict(rel="next", href=f"{BASE_URL}/api/stac/v1/page2")]))
        if request.url.path.endswith("page2"):
            return httpx.Response(200, json=dict(features=[scene(4), scene(5), scene(6), scene(7),
                scene(8, stamp="2024-02-01T00:00:00Z")], links=[]))
        if "/point/" in request.url.path:
            return httpx.Response(503)
        assert request.url.path == "/api/sas/v1/token/modiseuwest/modis-061-cogs"
        return httpx.Response(200, json=dict(token="test-ephemeral-sas"))

    def pixel(href, lat, lon):
        assert (lat, lon) == (25.4, -101)
        assert href.endswith("?test-ephemeral-sas")
        day = int(href.split(".A2024")[1][:3])
        if QUALITY in href:
            return {1: 0, 2: 1, 4: 3, 5: 0, 6: None, 7: 0}[day]
        return {1: 4000, 2: 6000, 4: 8000, 5: -3000, 6: 5000, 7: 10001}[day]

    monkeypatch.setattr("app.sources.planetary_modis.read_pixel", pixel)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_planetary_modis(client, 25.4, -101, first, last)

    rows = asyncio.run(run())
    assert rows.failed_batches == 0
    assert len(rows) == 1
    assert rows[0] == dict(variable="NDVI", date="2024-01-01", value=.5, unit="index",
                          source="MODIS MOD13Q1 / Microsoft Planetary Computer", resolution="250 m")
    assert len([call for call in calls if "/sas/" in call.url.path]) == 1


def test_planetary_keeps_successful_scenes_on_io_error_and_deadline(monkeypatch):
    def handle(request):
        if request.url.path.endswith("search"):
            return httpx.Response(200, json=dict(features=[scene(1), scene(2), scene(3)], links=[]))
        if "/point/" in request.url.path:
            return httpx.Response(503)
        return httpx.Response(200, json=dict(token="test-token"))

    def pixel(href, *_):
        if ".A2024002." in href:
            raise OSError("test raster failure")
        if ".A2024003." in href:
            time.sleep(.4)
        return 0 if QUALITY in href else 5000

    monkeypatch.setattr("app.sources.planetary_modis.read_pixel", pixel)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_planetary_modis(client, 0, 0, date(2024, 1, 1), date(2024, 1, 31), budget=.3)

    rows = asyncio.run(run())
    assert rows.failed_batches == 2
    assert rows[0]["value"] == .5


@pytest.mark.parametrize("primary", ["available", "empty", "partial", "timeout"])
def test_fallback_only_on_fault_and_preserves_ornl_months(monkeypatch, primary):
    original = ModisRows([dict(date="2024-01-01", value=.4)] if primary != "empty" else [],
                         failed_batches=1 if primary == "partial" else 0)

    async def ornl(*_):
        if primary == "timeout":
            raise httpx.ReadTimeout("test")
        return original

    async def planetary(*_, **__):
        assert primary in ("partial", "timeout")
        return ModisRows([dict(date="2024-01-01", value=.6), dict(date="2024-02-01", value=.7)])

    monkeypatch.setattr("app.sources.modis.fetch_ornl", ornl)
    monkeypatch.setattr("app.sources.planetary_modis.fetch_planetary_modis", planetary)
    rows = asyncio.run(fetch_modis(None, 0, 0, date(2024, 1, 1), date(2024, 2, 29)))
    assert rows.failed_batches == 0
    if primary in ("available", "empty"):
        assert rows is original
    else:
        assert [row["value"] for row in rows] == ([.4, .7] if primary == "partial" else [.6, .7])


def test_both_providers_fail_preserves_partial_ornl(monkeypatch):
    original = ModisRows([dict(date="2024-01-01", value=.4)], failed_batches=1)

    async def ornl(*_):
        return original

    async def planetary(*_, **__):
        raise httpx.ReadTimeout("test")

    monkeypatch.setattr("app.sources.modis.fetch_ornl", ornl)
    monkeypatch.setattr("app.sources.planetary_modis.fetch_planetary_modis", planetary)
    rows = asyncio.run(fetch_modis(None, 0, 0, date(2024, 1, 1), date(2024, 2, 29)))
    assert rows is original
    assert rows.failed_batches == 1


def test_planetary_ocean_without_scenes_does_not_request_sas(monkeypatch):
    def handle(request):
        assert request.url.path.endswith("search")
        return httpx.Response(200, json=dict(features=[], links=[]))

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_planetary_modis(client, 0, -140, date(2024, 1, 1), date(2024, 2, 29))

    assert asyncio.run(run()) == []


def test_public_point_api_reads_raw_bands_without_sas_or_raster_download(monkeypatch):
    def handle(request):
        if request.url.path.endswith("search"):
            return httpx.Response(200, json=dict(features=[scene(1)], links=[]))
        assert request.url.path == "/api/data/v1/item/point/-101,25.4"
        assert request.url.params.get_list("assets") == [NDVI, QUALITY]
        assert request.url.params["unscale"] == "false"
        # La respuesta puede listar las bandas en un orden distinto.
        return httpx.Response(200, json=dict(band_names=[f"{QUALITY}_b1", f"{NDVI}_b1"], values=[1, 5000]))

    def forbidden(*_):
        raise AssertionError("La lectura puntual HTTP no debe descargar GeoTIFF")

    monkeypatch.setattr("app.sources.planetary_modis.read_pixel", forbidden)

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_planetary_modis(client, 25.4, -101, date(2024, 1, 1), date(2024, 1, 31))

    rows = asyncio.run(run())
    assert rows.failed_batches == 0
    assert rows[0]["value"] == .5


def test_cancelled_request_stops_outstanding_point_reads():
    async def run():
        started, stopped = asyncio.Event(), asyncio.Event()

        async def handle(request):
            if request.url.path.endswith("search"):
                return httpx.Response(200, json=dict(features=[scene(1)], links=[]))
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                stopped.set()

        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            task = asyncio.create_task(fetch_planetary_modis(client, 0, 0, date(2024, 1, 1), date(2024, 1, 31)))
            await asyncio.wait_for(started.wait(), timeout=1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert stopped.is_set()

    asyncio.run(run())
