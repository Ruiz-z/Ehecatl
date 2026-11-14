import asyncio
import calendar
import os
from datetime import date, datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, HTTPException

from app.analysis.climatology import anomalies, climatology, trends
from app.analysis.windows import add_months, calculate_windows
from app.sources.power import fetch_power, PARAMETERS
from app.sources.modis import fetch_modis

router = APIRouter()


@router.get("/indicators")
async def indicators(lat: str = "", lon: str = "", start: str = "", end: str = "",
                     irrigated: str = "false", baselineYears: str = "10"):
    try:
        latitude, longitude = float(lat), float(lon)
        first, last = date.fromisoformat(start), date.fromisoformat(end)
        years = int(baselineYears)
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180 and
                first <= last <= datetime.now(timezone.utc).date() and 2 <= years <= 30
                and (last-first).days <= 3660 and irrigated.lower() in ("true", "false")):
            raise ValueError()
        baseline_start, baseline_end = date(first.year-years, 1, 1), date(first.year-1, 12, 31)
    except (ValueError, OverflowError):
        raise HTTPException(400, "Coordenadas, rango de fechas o configuración inválidos") from None
    # Excluir el mes actual y los meses que no terminaron dentro del rango.
    complete_end = min(last, datetime.now(timezone.utc).date().replace(day=1)-timedelta(days=1))
    if complete_end.day != calendar.monthrange(complete_end.year, complete_end.month)[1]:
        complete_end = complete_end.replace(day=1)-timedelta(days=1)
    recent_start = first if first.day == 1 else add_months(first, 1)
    timeout = max(.1, float(os.getenv("NASA_TIMEOUT_SECONDS", "30")))
    budget = max(.1, float(os.getenv("NASA_TOTAL_TIMEOUT_SECONDS", "120")))
    sources, monthly, history, warnings = {}, [], [], []
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async def source(name, fetcher):
            async def load():
                return await asyncio.gather(
                    fetcher(client, latitude, longitude, recent_start, complete_end) if recent_start <= complete_end else asyncio.sleep(0, result=[]),
                    fetcher(client, latitude, longitude, baseline_start, baseline_end), return_exceptions=True)
            try:
                recent, historic = await asyncio.wait_for(load(), timeout=budget)
                failures = [x for x in (recent, historic) if isinstance(x, Exception)]
                recent = [] if isinstance(recent, Exception) else recent
                historic = [] if isinstance(historic, Exception) else historic
                status = "available" if recent and historic and not failures else "partial" if recent or historic else "unavailable"
                reason = "Fuente incompleta o sin cobertura" if status != "available" else None
                if name == "power" and status == "available" and any(
                    not any(r["variable"] == v and r["value"] is not None for r in recent) for v in PARAMETERS):
                    status, reason = "partial", "Variables POWER faltantes"
            except (TimeoutError, httpx.HTTPError, ValueError, KeyError, TypeError):
                recent, historic, status, reason = [], [], "unavailable", "Timeout o respuesta inválida de la fuente"
            return name, recent, historic, status, reason
        loaded = await asyncio.gather(source("power", fetch_power), source("modis", fetch_modis))
    for name, recent, historic, status, reason in loaded:
        sources[name] = dict(status=status, reason=reason)
        monthly.extend(recent)
        history.extend(historic)
        if reason:
            warnings.append(f"{name}: {reason}")
    normals = climatology(history)
    if any(row["samples"] < years for row in normals):
        warnings.append("Climatología con años faltantes; interpretar con menor confianza")
    return dict(version=1, point=dict(lat=latitude, lon=longitude), period=dict(start=start, end=end),
                origin="live", fetchedAt=datetime.now(timezone.utc).isoformat(), sources=sources,
                monthly=sorted(monthly, key=lambda r: (r["date"], r["variable"])), climatology=normals,
                anomalies=anomalies(monthly, normals), trends=trends(monthly, normals),
                windows=calculate_windows(normals, add_months(last, 1), irrigated.lower() == "true"), warnings=warnings)
