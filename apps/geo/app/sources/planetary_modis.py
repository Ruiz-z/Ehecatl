"""Respaldo MODIS anónimo: Terra y complemento mensual Aqua con la misma calidad."""
import asyncio
import json
from datetime import date
from urllib.parse import urlsplit

import httpx
import rasterio
from rasterio.warp import transform
from rasterio.windows import Window

from app.sources.modis import ModisRows, normalize_modis

BASE_URL = "https://planetarycomputer.microsoft.com"
COLLECTION = "modis-13Q1-061"
NDVI = "250m_16_days_NDVI"
QUALITY = "250m_16_days_pixel_reliability"


def scene_date(scene: dict) -> str:
    properties = scene["properties"]
    return (properties.get("datetime") or properties["start_datetime"])[:10]


def read_pixel(href: str, lat: float, lon: float) -> float | None:
    # GDAL solicita solo los bloques del píxel y no explora archivos auxiliares.
    # El timeout por transferencia también acota hilos tras una cancelación HTTP.
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_TIMEOUT=10,
                      GDAL_HTTP_CONNECTTIMEOUT=5, GDAL_HTTP_MAX_RETRY=0):
        with rasterio.open(href) as dataset:
            x, y = transform("EPSG:4326", dataset.crs, [lon], [lat])
            row, col = dataset.index(x[0], y[0])
            if not (0 <= row < dataset.height and 0 <= col < dataset.width):
                return None
            pixel = dataset.read(1, window=Window(col, row, 1, 1), masked=True)
            return None if pixel.mask.any() else float(pixel[0, 0])


async def fetch_planetary_modis(client, lat: float, lon: float, start: date, end: date, budget: float = 90) -> ModisRows:
    deadline = asyncio.get_running_loop().time() + budget - .1
    terra = await fetch_product(client, lat, lon, start, end, budget=budget)
    months = set()
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        months.add(cursor.isoformat())
        cursor = date(cursor.year + cursor.month // 12, cursor.month % 12 + 1, 1)
    missing = months - {row["date"] for row in terra}
    if not missing:
        return terra
    remaining = deadline - asyncio.get_running_loop().time()
    if remaining <= .1:
        return terra
    try:
        aqua = await asyncio.wait_for(fetch_product(client, lat, lon, start, end,
            budget=remaining, platform="aqua", months=missing), timeout=remaining)
    except (TimeoutError, httpx.HTTPError, ValueError, KeyError, TypeError, OSError):
        return terra
    additions = {row["date"]: row for row in aqua if row["date"] in missing}
    if not additions:
        return terra
    additions.update({row["date"]: row for row in terra})
    return ModisRows([additions[key] for key in sorted(additions)],
                     failed_batches=terra.failed_batches + aqua.failed_batches)


async def fetch_product(client, lat: float, lon: float, start: date, end: date, budget: float = 90,
                        platform: str = "terra", months: set[str] | None = None) -> ModisRows:
    product = {"terra": "MOD13Q1", "aqua": "MYD13Q1"}[platform]
    deadline = asyncio.get_running_loop().time() + budget - .1
    params = dict(collections=COLLECTION, limit=1000,
                  intersects=json.dumps(dict(type="Point", coordinates=[lon, lat])),
                  datetime=f"{start.isoformat()}T00:00:00Z/{end.isoformat()}T23:59:59Z",
                  query=json.dumps({"platform": {"eq": platform}}))
    url = f"{BASE_URL}/api/stac/v1/search"
    scenes, visited = {}, set()
    while url:
        if url in visited or not url.startswith(f"{BASE_URL}/api/stac/v1/"):
            raise ValueError("Paginación STAC inválida")
        visited.add(url)
        response = await client.get(url, params=params)
        response.raise_for_status()
        page = response.json()
        for scene in page["features"]:
            stamp = scene_date(scene)
            if (scene["properties"].get("platform") == platform and scene["id"].startswith(f"{product}.")
                    and start.isoformat() <= stamp <= end.isoformat()
                    and (months is None or f"{stamp[:7]}-01" in months)):
                scenes[scene["id"]] = scene
        url = next((link["href"] for link in page.get("links", []) if link.get("rel") == "next"), None)
        params = None

    # El token es efímero, anónimo y se reutiliza solo durante esta consulta.
    tokens = {}

    async def signed(href):
        parts = urlsplit(href)
        if parts.scheme != "https" or not parts.hostname or not parts.hostname.endswith(".blob.core.windows.net"):
            raise ValueError("Asset MODIS inválido")
        account = parts.hostname.split(".")[0]
        container = parts.path.strip("/").split("/")[0]
        key = (account, container)

        async def token():
            response = await client.get(f"{BASE_URL}/api/sas/v1/token/{account}/{container}")
            response.raise_for_status()
            return response.json()["token"]

        if key not in tokens:
            tokens[key] = asyncio.create_task(token())
        return f"{href}?{await tokens[key]}"

    semaphore = asyncio.Semaphore(8)

    async def observation(scene):
        async with semaphore:
            try:
                response = await client.get(f"{BASE_URL}/api/data/v1/item/point/{lon},{lat}", params=[
                    ("collection", COLLECTION), ("item", scene["id"]), ("assets", NDVI), ("assets", QUALITY),
                    ("unscale", "false")])
                response.raise_for_status()
                point = response.json()
                values = dict(zip(point["band_names"], point["values"], strict=True))
                value, quality = values[f"{NDVI}_b1"], values[f"{QUALITY}_b1"]
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                ndvi_url = await signed(scene["assets"][NDVI]["href"])
                quality_url = await signed(scene["assets"][QUALITY]["href"])

                def sample():
                    return read_pixel(ndvi_url, lat, lon), read_pixel(quality_url, lat, lon)

                value, quality = await asyncio.to_thread(sample)
            stamp = scene_date(scene)
            modis_date = scene["id"].split(".")[1]
            return [dict(band=NDVI, calendar_date=stamp, modis_date=modis_date, data=[value]),
                    dict(band=QUALITY, modis_date=modis_date, data=[quality])]

    tasks = [asyncio.create_task(observation(scenes[key])) for key in sorted(scenes)]
    if not tasks:
        return ModisRows([])
    try:
        done, pending = await asyncio.wait(tasks, timeout=max(0, deadline-asyncio.get_running_loop().time()))
    except asyncio.CancelledError:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
    chunks = [task.exception() if task.exception() else task.result() for task in tasks if task in done]
    failures = len(pending) + sum(isinstance(chunk, Exception) for chunk in chunks)
    rows = normalize_modis({"subset": [row for chunk in chunks if not isinstance(chunk, Exception) for row in chunk]})
    for row in rows:
        row["source"] = f"MODIS {product} / Microsoft Planetary Computer"
    return ModisRows(rows, failed_batches=failures)
