"""Ventanas climatológicas continuas, sin calendarios por hemisferio."""
import calendar
from datetime import date
from statistics import mean


def add_months(value: date, count: int) -> date:
    index = value.year * 12 + value.month - 1 + count
    return date(index // 12, index % 12 + 1, 1)


def calculate_windows(normals: list[dict], start: date, irrigated: bool = False, horizon: int = 24) -> list[dict]:
    lookup = {(r["variable"], r["month"]): r["value"] for r in normals}
    groups, current = [], []
    for offset in range(horizon):
        day = add_months(start, offset)
        temp = lookup.get(("T2M", day.month))
        rain = lookup.get(("PRECTOTCORR", day.month))
        wet = lookup.get(("GWETROOT", day.month))
        valid = temp is not None and 10 <= temp <= 35 and (
            irrigated or (rain is not None and rain >= 40) or (wet is not None and wet >= .4))
        if valid:
            current.append(day)
        elif current:
            groups.append(current)
            current = []
    if current:
        groups.append(current)
    result = []
    for i, days in enumerate(groups):
        last = days[-1]
        end = date(last.year, last.month, calendar.monthrange(last.year, last.month)[1])
        def aggregate(variable, fn, fallback=None):
            values = [lookup[(variable, d.month)] for d in days if lookup.get((variable, d.month)) is not None]
            return fn(values) if values else fallback
        result.append(dict(id=f"window-{i+1}", start=days[0].isoformat(), end=end.isoformat(),
                           months=[d.month for d in days], durationDays=(end-days[0]).days+1,
                           temperatureMin=aggregate("T2M_MIN", min), temperatureMax=aggregate("T2M_MAX", max),
                           meanTemperature=aggregate("T2M", mean), precipitationMm=aggregate("PRECTOTCORR", sum),
                           irrigated=irrigated))
    return result
