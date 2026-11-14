import asyncio
import json
from datetime import date

import httpx
import pytest

from app.sources.modis import ModisRows
from app.sources.planetary_modis import NDVI, QUALITY, fetch_planetary_modis


def test_aqua_only_fills_missing_months_across_historic_and_recent_years(monkeypatch):
    terra = ModisRows([dict(date="2023-11-01", value=.6, source="Terra"),
                       dict(date="2024-02-01", value=.7, source="Terra")])
    platforms = []

    async def product(client, lat, lon, start, end, budget, platform="terra", months=None):
        assert (lat, lon, start, end) == (19.1738, -96.1342, date(2023, 11, 1), date(2024, 2, 29))
        assert 0 < budget <= 90
        platforms.append(platform)
        if platform == "terra":
            return terra
        assert months == {"2023-12-01", "2024-01-01"}
        # Incluso ante una respuesta con solapamientos, Terra conserva su valor.
        return ModisRows([dict(date="2023-11-01", value=.1, source="Aqua"),
                          dict(date="2023-12-01", value=.4, source="Aqua"),
                          dict(date="2024-01-01", value=.5, source="Aqua"),
                          dict(date="2024-03-01", value=.9, source="Aqua")])

    monkeypatch.setattr("app.sources.planetary_modis.fetch_product", product)
    rows = asyncio.run(fetch_planetary_modis(None, 19.1738, -96.1342, date(2023, 11, 1), date(2024, 2, 29)))
    assert platforms == ["terra", "aqua"]
    assert [row["date"] for row in rows] == ["2023-11-01", "2023-12-01", "2024-01-01", "2024-02-01"]
    assert [row["value"] for row in rows] == [.6, .4, .5, .7]
    assert rows[0] is terra[0] and rows[-1] is terra[-1]
    assert rows.failed_batches == 0


def test_complete_terra_response_does_not_query_aqua(monkeypatch):
    terra = ModisRows([dict(date="2024-01-01", value=.6)])

    async def product(*args, **kwargs):
        assert kwargs.get("platform", "terra") == "terra"
        assert kwargs["budget"] == 90
        return terra

    monkeypatch.setattr("app.sources.planetary_modis.fetch_product", product)
    assert asyncio.run(fetch_planetary_modis(None, 0, 0, date(2024, 1, 1), date(2024, 1, 31))) is terra


@pytest.mark.parametrize("failure", [httpx.ReadTimeout("test"), ValueError("test")])
def test_aqua_failure_does_not_degrade_or_discard_terra(monkeypatch, failure):
    terra = ModisRows([dict(date="2024-01-01", value=.6)], failed_batches=0)

    async def product(*args, **kwargs):
        if kwargs.get("platform") == "aqua":
            raise failure
        return terra

    monkeypatch.setattr("app.sources.planetary_modis.fetch_product", product)
    rows = asyncio.run(fetch_planetary_modis(None, 0, 0, date(2024, 1, 1), date(2024, 2, 29)))
    assert rows is terra
    assert rows.failed_batches == 0


@pytest.mark.parametrize("aqua_quality", [1, 3])
def test_aqua_platform_quality_scale_and_source_without_replacing_terra(aqua_quality):
    reads = []

    def scene(platform, stamp):
        product = "MOD13Q1" if platform == "terra" else "MYD13Q1"
        return dict(id=f"{product}.{stamp}.test", properties=dict(platform=platform, datetime=f"{stamp}T00:00:00Z"))

    def handle(request):
        if request.url.path.endswith("search"):
            platform = json.loads(request.url.params["query"])["platform"]["eq"]
            scenes = [scene(platform, "2024-01-01"), scene(platform, "2024-02-01")]
            if platform == "aqua":
                # No se admite un producto Terra etiquetado como Aqua ni fechas fuera de rango.
                wrong = scene("terra", "2024-02-02")
                wrong["properties"]["platform"] = "aqua"
                scenes.extend([wrong, scene("aqua", "2024-03-01")])
            return httpx.Response(200, json=dict(features=scenes, links=[]))
        assert "/point/" in request.url.path
        identifier = request.url.params["item"]
        reads.append(identifier)
        if identifier.startswith("MYD13Q1"):
            assert "2024-02-01" in identifier
            raw, quality = 4000, aqua_quality
        elif "2024-01-01" in identifier:
            raw, quality = 6000, 0
        else:
            raw, quality = 9000, 3
        return httpx.Response(200, json=dict(band_names=[f"{NDVI}_b1", f"{QUALITY}_b1"], values=[raw, quality]))

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_planetary_modis(client, 0, 0, date(2024, 1, 1), date(2024, 2, 29))

    rows = asyncio.run(run())
    assert rows[0]["value"] == .6
    assert rows[0]["source"] == "MODIS MOD13Q1 / Microsoft Planetary Computer"
    assert len(rows) == (2 if aqua_quality == 1 else 1)
    if aqua_quality == 1:
        assert rows[1]["value"] == .4
        assert rows[1]["source"] == "MODIS MYD13Q1 / Microsoft Planetary Computer"
        assert rows[1]["resolution"] == "250 m"
    assert len(reads) == 3
