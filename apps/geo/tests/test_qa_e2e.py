"""Pruebas QA E2E y casos límite para apps/geo (spec-003 y docs/contracts.md)."""
import math
import os
from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from app.analysis.climatology import anomalies, climatology, trends
from app.analysis.windows import calculate_windows
from app.main import app
from app.sources.modis import fetch_modis
from app.sources.power import PARAMETERS, normalize_power


def _indicator(variable: str, month: int, value: float | None, year: int = 2024) -> dict:
    return {
        "variable": variable,
        "date": f"{year}-{month:02d}-01",
        "value": value,
        "unit": "test",
        "source": "test",
        "resolution": "test",
    }


def test_qa_invalid_coordinates_dates_and_nan_return_400():
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            base = {"lat": "25.4", "lon": "-101.0", "start": "2024-01-01", "end": "2024-12-31"}
            bad_cases = [
                {"lat": "nan"},
                {"lat": "inf"},
                {"lon": "-180.01"},
                {"lon": "180.01"},
                {"lat": "-90.01"},
                {"lat": "90.01"},
                {"start": "2024-06-01", "end": "2024-05-01"},
                {"start": "2010-01-01", "end": "2020-02-01"},  # > 3660 días
                {"end": (datetime.now(timezone.utc).date() + timedelta(days=2)).isoformat()},
                {"baselineYears": "1"},
                {"baselineYears": "31"},
                {"irrigated": "yes"},
                {"start": ""},
                {"end": ""},
            ]
            for patch in bad_cases:
                res = await client.get("/indicators", params=base | patch)
                assert res.status_code == 400, f"Se esperaba 400 para {patch}, llegó {res.status_code}"

    import asyncio
    asyncio.run(run())


def test_qa_zero_normal_anomaly_does_not_divide_by_zero():
    normals = [{"variable": "PRECTOTCORR", "month": 1, "value": 0.0, "samples": 10, "unit": "mm/month"}]
    recent = [_indicator("PRECTOTCORR", 1, 15.0)]
    result = anomalies(recent, normals)
    assert len(result) == 1
    assert result[0]["value"] == 15.0
    assert result[0]["percent"] is None


def test_qa_power_rejects_unknown_rain_unit_and_handles_missing_metadata():
    with pytest.raises(ValueError, match="Unsupported precipitation unit"):
        normalize_power({
            "parameters": {"PRECTOTCORR": {"units": "in/day"}},
            "properties": {"parameter": {"PRECTOTCORR": {"202401": 1.0}}},
        })

    rows = normalize_power({
        "header": {"fill_value": -999},
        "properties": {"parameter": {"T2M": {"202401": 20.5, "202413": 21.0, "202402": -999}}},
    })
    assert len(rows) == 2
    assert rows[0]["value"] == 20.5
    assert rows[1]["value"] is None


def test_qa_windows_require_water_unless_irrigated():
    # Solo T2M presente sin lluvia ni humedad de suelo -> sin riego no debe abrir ventanas
    only_temp = [
        {"variable": "T2M", "month": m, "value": 24.0, "samples": 10, "unit": "C"}
        for m in range(1, 13)
    ]
    assert calculate_windows(only_temp, date(2025, 1, 1), irrigated=False) == []
    irrigated = calculate_windows(only_temp, date(2025, 1, 1), irrigated=True)
    assert len(irrigated) == 1
    assert irrigated[0]["precipitationMm"] is None


def test_qa_current_month_only_range_should_not_report_power_fault_as_partial(monkeypatch):
    """QA: si el rango solo toca el mes en curso sin meses completos, POWER no falló, pero hoy se marca partial."""
    async def power(client, lat, lon, start, end):
        return [_indicator("T2M", m, 20.0, 2024) for m in range(1, 13)]

    async def modis(*args):
        return [_indicator("NDVI", 1, 0.5, 2024)]

    monkeypatch.setattr("app.routes.indicators.fetch_power", power)
    monkeypatch.setattr("app.routes.indicators.fetch_modis", modis)

    today = datetime.now(timezone.utc).date()
    first_of_month = today.replace(day=1).isoformat()

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get(
                "/indicators",
                params={"lat": "25.4", "lon": "-101.0", "start": first_of_month, "end": today.isoformat()},
            )
            assert res.status_code == 200
            body = res.json()
            assert body["monthly"] == []
            assert body["sources"]["power"]["status"] == "available"

    import asyncio
    asyncio.run(run())


def test_qa_modis_single_batch_503_should_not_discard_other_9_years(monkeypatch):
    """QA: si 1 de 3 lotes de MODIS /subset falla con 503, se pierden todos los lotes exitosos."""
    def handle(req: httpx.Request):
        if req.url.path.endswith("dates"):
            return httpx.Response(
                200,
                json={
                    "dates": [
                        {"calendar_date": f"2024-01-{d:02d}", "modis_date": f"A2024{d:03d}"}
                        for d in range(1, 22)
                    ]
                },
            )
        if req.url.params.get("startDate") == "A2024011":
            return httpx.Response(503, text="ORNL transient failure")
        return httpx.Response(
            200,
            json={
                "subset": [
                    {
                        "band": "250m_16_days_NDVI",
                        "modis_date": req.url.params.get("startDate"),
                        "calendar_date": "2024-01-01",
                        "data": [5000],
                    }
                ]
            },
        )

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            rows = await fetch_modis(client, 25.4, -101.0, date(2024, 1, 1), date(2024, 1, 31))
            assert len(rows) >= 1

    import asyncio
    asyncio.run(run())


live_geo = pytest.mark.skipif(not os.getenv("QA_GEO_URL"), reason="Requiere servicio geo vivo en QA_GEO_URL")


@live_geo
@pytest.mark.parametrize(
    "name,lat,lon,irrigated",
    [
        ("coahuila", 25.4, -101.0, False),
        ("nevada", 39.5, -119.8, True),
        ("mendoza", -33.0, -68.8, True),
        ("veracruz_nuevo_punto", 19.1738, -96.1342, False),
    ],
)
def test_qa_live_geo_real_nasa_power_and_modis(name, lat, lon, irrigated):
    base_url = os.environ["QA_GEO_URL"]
    res = httpx.get(
        f"{base_url}/indicators",
        params={
            "lat": lat,
            "lon": lon,
            "start": "2025-11-01",
            "end": "2026-10-31",
            "irrigated": str(irrigated).lower(),
            "baselineYears": "10",
        },
        timeout=130.0,
    )
    assert res.status_code == 200, f"{name}: HTTP {res.status_code} {res.text}"
    body = res.json()
    assert body["version"] == 1
    assert body["origin"] == "live"
    assert body["sources"]["power"]["status"] == "available"

    variables = {row["variable"] for row in body["monthly"]}
    assert set(PARAMETERS).issubset(variables), f"{name}: faltan variables POWER: {set(PARAMETERS) - variables}"
    for row in body["monthly"]:
        if row["value"] is not None:
            assert row["value"] != -999
            assert math.isfinite(row["value"])
        if row["variable"] == "PRECTOTCORR":
            assert row["unit"] == "mm/month"

    # Spec 003 RF-2: MODIS NDVI debe obtenerse en puntos terrestres reales
    assert body["sources"]["modis"]["status"] == "available", (
        f"{name}: MODIS no disponible en vivo ({body['sources']['modis']})"
    )


@live_geo
def test_qa_live_geo_ocean_point_graceful_without_500():
    base_url = os.environ["QA_GEO_URL"]
    res = httpx.get(
        f"{base_url}/indicators",
        params={
            "lat": 0.0,
            "lon": -140.0,
            "start": "2025-11-01",
            "end": "2026-10-31",
            "irrigated": "false",
        },
        timeout=130.0,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sources"]["modis"]["status"] in ("unavailable", "partial")
    assert body["sources"]["power"]["status"] in ("available", "partial", "unavailable")
