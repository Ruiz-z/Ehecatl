"""NASA POWER mensual; no sustituye valores faltantes por observaciones."""
import calendar
import math
from datetime import date

import httpx

URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
PARAMETERS = ("T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M",
              "ALLSKY_SFC_SW_DWN", "GWETTOP", "GWETROOT")
UNITS = dict(T2M="C", T2M_MAX="C", T2M_MIN="C", PRECTOTCORR="mm/day",
             RH2M="%", ALLSKY_SFC_SW_DWN="MJ/m^2/day", GWETTOP="fraction", GWETROOT="fraction")


def normalize_power(payload: dict) -> list[dict]:
    result = []
    fill = payload.get("header", {}).get("fill_value", -999)
    for variable, series in payload.get("properties", {}).get("parameter", {}).items():
        if variable not in PARAMETERS:
            continue
        unit = payload.get("parameters", {}).get(variable, {}).get("units", UNITS[variable])
        for key, raw in sorted(series.items()):
            if len(key) != 6 or not key.isdigit() or not 1 <= int(key[4:]) <= 12:
                continue  # POWER incluye YYYY13: promedio anual, no mes.
            year, month = int(key[:4]), int(key[4:])
            value = float(raw) if isinstance(raw, (int, float)) and math.isfinite(raw) and raw not in (fill, -999) else None
            output_unit = unit
            if variable == "PRECTOTCORR":
                if unit.lower() in ("mm/day", "mm/d", "mm day-1"):
                    value = value * calendar.monthrange(year, month)[1] if value is not None else None
                    output_unit = "mm/month"
                elif unit.lower() not in ("mm/month", "mm"):
                    raise ValueError(f"Unsupported precipitation unit: {unit}")
            result.append(dict(variable=variable, date=f"{year}-{month:02d}-01", value=value,
                               unit=output_unit, source="NASA POWER", resolution="0.5 degrees (meteorology); 1 degree (solar)"))
    return result


async def fetch_power(client: httpx.AsyncClient, lat: float, lon: float, start: date, end: date) -> list[dict]:
    response = await client.get(URL, params=dict(parameters=",".join(PARAMETERS), community="AG",
                               latitude=lat, longitude=lon, start=start.year, end=end.year, format="JSON"))
    response.raise_for_status()
    return [row for row in normalize_power(response.json())
            if start.strftime("%Y-%m") <= row["date"][:7] <= end.strftime("%Y-%m")]
