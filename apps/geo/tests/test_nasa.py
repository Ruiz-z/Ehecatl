import asyncio
import json
from datetime import date
from pathlib import Path

import httpx
import pytest

from app.sources.power import normalize_power, fetch_power
from app.sources.modis import normalize_modis, fetch_modis
from app.analysis.climatology import climatology, anomalies, trends
from app.analysis.windows import calculate_windows
from app.main import app


def indicator(variable, month, value, year=2020):
    return dict(variable=variable, date=f"{year}-{month:02d}-01", value=value, unit="test")


def normal_series(temps, rain=90):
    return [dict(variable=v, month=m, value=x, samples=10, unit="test")
            for m, t in enumerate(temps, 1)
            for v, x in [("T2M", t), ("T2M_MIN", t-5), ("T2M_MAX", t+5),
                         ("PRECTOTCORR", rain), ("GWETROOT", .1)]]


def test_power_fill_annual_and_leap_month():
    data = json.loads((Path(__file__).parent / "fixtures/power.json").read_text())
    values = normalize_power(data)
    assert len(values) == 4
    assert next(x for x in values if x["variable"] == "PRECTOTCORR")["value"] == 58
    assert next(x for x in values if x["variable"] == "GWETROOT")["value"] is None
    assert all(x["source"] and x["resolution"] for x in values)


def test_recorded_power_response():
    payload = json.loads((Path(__file__).parent / "fixtures/power_recorded_coahuila.json").read_text(encoding="utf8"))
    rows = normalize_power(payload)
    assert len(rows) == 8 * 12
    assert all(row["value"] is None or row["value"] != -999 for row in rows)
    assert next(row for row in rows if row["variable"] == "PRECTOTCORR")["unit"] == "mm/month"


def test_modis_scale_fill_quality_and_monthly_average():
    data = json.loads((Path(__file__).parent / "fixtures/modis.json").read_text())
    values = normalize_modis(data)
    assert values[0]["value"] == pytest.approx(.6)
    assert normalize_modis({"subset": []}) == []


def test_normals_missing_and_anomalies():
    historic = [indicator("T2M", 1, 20, y) for y in range(2010, 2020)]
    historic.append(indicator("T2M", 1, None))
    normals = climatology(historic)
    assert normals[0]["samples"] == 10
    assert anomalies([indicator("T2M", 1, 23)], normals)[0]["value"] == 3


@pytest.mark.parametrize("variable,old,new,kind", [
    ("PRECTOTCORR", 100, 50, "drought"), ("T2M", 20, 23, "heat"),
    ("NDVI", .6, .3, "vegetation_stress")])
def test_trends(variable, old, new, kind):
    normals = [dict(variable=variable, month=m, value=old, samples=10, unit="test") for m in range(1, 13)]
    result = trends([indicator(variable, m, new) for m in range(1, 4)], normals)
    assert next(t for t in result if t["type"] == kind)["active"]


def test_erratic_rain():
    normals = [dict(variable="PRECTOTCORR", month=m, value=100, samples=10, unit="test") for m in range(1, 13)]
    result = trends([indicator("PRECTOTCORR", m, x) for m, x in enumerate([1, 300, 1], 1)], normals)
    assert next(t for t in result if t["type"] == "erratic_rain")["active"]


def test_windows_global_irrigation_and_year_boundary():
    start = date(2025, 1, 1)
    tropical = calculate_windows(normal_series([24]*12), start)
    assert len(tropical) == 1 and tropical[0]["durationDays"] == 730
    dry = normal_series([24]*12, rain=5)
    assert calculate_windows(dry, start) == []
    assert calculate_windows(dry, start, irrigated=True)
    southern = calculate_windows(normal_series([24, 24, 5, 5, 5, 5, 5, 5, 5, 5, 5, 24]), date(2025, 11, 1))
    assert southern[0]["start"] == "2025-12-01"
    assert southern[0]["end"] == "2026-02-28"
    assert calculate_windows([], start, irrigated=True) == []


def test_power_request_uses_years_and_filters_months():
    def handle(req):
        assert req.url.params["start"] == "2024"
        return httpx.Response(200, json={"properties": {"parameter": {"T2M": {"202401": 20, "202402": 21}}}})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_power(client, 0, 0, date(2024, 2, 1), date(2024, 2, 29))
    assert len(asyncio.run(run())) == 1


def test_modis_paginates_ten_dates():
    calls = []
    def handle(req):
        if req.url.path.endswith("dates"):
            return httpx.Response(200, json={"dates": [{"calendar_date": f"2024-01-{d:02d}", "modis_date": f"A2024{d:03d}"} for d in range(1, 24)]})
        calls.append(req)
        return httpx.Response(200, json={"subset": []})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_modis(client, 0, 0, date(2024, 1, 1), date(2024, 1, 31))
    asyncio.run(run())
    assert len(calls) == 3


def test_endpoint_partial_and_invalid(monkeypatch):
    async def power(*args):
        return [indicator("T2M", 1, 24, 2024)]
    async def modis(*args):
        raise httpx.ReadTimeout("test")
    monkeypatch.setattr("app.routes.indicators.fetch_power", power)
    monkeypatch.setattr("app.routes.indicators.fetch_modis", modis)
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            good = await client.get("/indicators", params=dict(lat=0, lon=0, start="2024-01-01", end="2024-12-31"))
            for change in [dict(lat=91), dict(start="2025-01-01"), dict(end="2099-01-01"), dict(start="bad")]:
                params = dict(lat=0, lon=0, start="2024-01-01", end="2024-12-31") | change
                assert (await client.get("/indicators", params=params)).status_code == 400
            return good
    response = asyncio.run(run())
    assert response.status_code == 200
    body = response.json()
    assert body["sources"]["modis"]["status"] == "unavailable"
    assert body["monthly"] and body["origin"] == "live"


@pytest.mark.parametrize("fail_all", [False, True])
def test_modis_endpoint_shares_dates_and_reports_failed_batches(monkeypatch, fail_all):
    calls = []

    def handle(req):
        calls.append(req)
        if req.url.path.endswith("dates"):
            return httpx.Response(200, json={"dates": [
                {"calendar_date": f"{year}-01-{day:02d}", "modis_date": f"A{year}{day:03d}"}
                for year in [2015, 2025] for day in range(1, 12)
            ]})
        stamp = req.url.params["startDate"]
        if fail_all or stamp == "A2015001":
            return httpx.Response(503)
        return httpx.Response(200, json={"subset": [dict(
            band="250m_16_days_NDVI", modis_date=stamp, data=[5000]
        )]})

    async def modis(_client, lat, lon, start, end):
        async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
            return await fetch_modis(client, lat, lon, start, end)

    async def power(*args):
        return [indicator(variable, 1, 20, 2024) for variable in
                ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M",
                 "ALLSKY_SFC_SW_DWN", "GWETTOP", "GWETROOT"]]

    monkeypatch.setattr("app.routes.indicators.fetch_modis", modis)
    monkeypatch.setattr("app.routes.indicators.fetch_power", power)

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            return await client.get("/indicators", params=dict(lat=0, lon=0, start="2025-01-01", end="2025-01-31"))

    response = asyncio.run(run())
    assert response.status_code == 200
    body = response.json()
    assert len([req for req in calls if req.url.path.endswith("dates")]) == 1
    assert body["sources"]["modis"]["status"] == ("unavailable" if fail_all else "partial")
    assert "lotes MODIS fallidos" in body["sources"]["modis"]["reason"]
    ndvi_recent = [row for row in body["monthly"] if row["variable"] == "NDVI"]
    ndvi_historic = [row for row in body["climatology"] if row["variable"] == "NDVI"]
    assert bool(ndvi_recent) is not fail_all
    assert bool(ndvi_historic) is not fail_all
    assert body["sources"]["power"]["status"] == "available"
