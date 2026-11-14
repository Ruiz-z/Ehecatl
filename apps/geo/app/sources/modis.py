"""MOD13Q1, escala NDVI y calidad; máximo diez fechas por petición ORNL."""
import asyncio
import math
from collections import defaultdict
from datetime import date, datetime
from statistics import mean

import httpx

BASE_URL = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"


class ModisRows(list):
    """Observaciones conservadas y fallos de lote para el estado de la fuente."""

    def __init__(self, rows, failed_batches=0):
        super().__init__(rows)
        self.failed_batches = failed_batches


def normalize_modis(payload: dict) -> list[dict]:
    groups = defaultdict(list)
    subsets = payload.get("subset", [])
    quality = {row["modis_date"]: row["data"] for row in subsets
               if row.get("band") == "250m_16_days_pixel_reliability"}
    for row in subsets:
        if row.get("band") != "250m_16_days_NDVI":
            continue
        stamp = row.get("calendar_date") or datetime.strptime(row["modis_date"], "A%Y%j").date().isoformat()
        qc = quality.get(row.get("modis_date"))
        valid = [v * .0001 for i, v in enumerate(row.get("data", []))
                 if isinstance(v, (int, float)) and math.isfinite(v) and -2000 <= v <= 10000
                 and (qc is None or (i < len(qc) and qc[i] in (0, 1)))]
        if valid:
            groups[stamp[:7]].append(mean(valid))
    return [dict(variable="NDVI", date=f"{month}-01", value=mean(values), unit="index",
                 source="MODIS MOD13Q1 / ORNL DAAC", resolution="250 m")
            for month, values in sorted(groups.items())]


async def fetch_modis(client: httpx.AsyncClient, lat: float, lon: float, start: date, end: date) -> list[dict]:
    point = dict(latitude=lat, longitude=lon)
    response = await client.get(f"{BASE_URL}/dates", params=point)
    response.raise_for_status()
    payload = response.json()
    available = payload.get("dates", []) if isinstance(payload, dict) else payload
    dates = sorted((row for row in available if start.isoformat() <= row["calendar_date"] <= end.isoformat()),
                   key=lambda row: row["calendar_date"])
    semaphore = asyncio.Semaphore(3)

    async def batch(rows):
        async with semaphore:
            res = await client.get(f"{BASE_URL}/subset", params=point | dict(
                startDate=rows[0]["modis_date"], endDate=rows[-1]["modis_date"], kmAboveBelow=0, kmLeftRight=0))
            res.raise_for_status()
            return res.json().get("subset", [])

    chunks = await asyncio.gather(*(batch(dates[i:i+10]) for i in range(0, len(dates), 10)),
                                  return_exceptions=True)
    failures = sum(isinstance(chunk, Exception) for chunk in chunks)
    rows = normalize_modis({"subset": [row for chunk in chunks if not isinstance(chunk, Exception) for row in chunk]})
    return ModisRows(rows, failed_batches=failures)
