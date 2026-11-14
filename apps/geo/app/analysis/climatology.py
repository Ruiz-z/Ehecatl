"""Heurísticas explicables contra normales del mismo punto y mes."""
from collections import defaultdict
from statistics import mean, pstdev


def climatology(series: list[dict]) -> list[dict]:
    grouped = defaultdict(list)
    for row in series:
        if row["value"] is not None:
            grouped[(row["variable"], int(row["date"][5:7]), row["unit"])].append(row["value"])
    return [dict(variable=v, month=m, value=mean(values), samples=len(values), unit=unit)
            for (v, m, unit), values in sorted(grouped.items())]


def anomalies(recent: list[dict], normals: list[dict]) -> list[dict]:
    lookup = {(r["variable"], r["month"]): r["value"] for r in normals}
    result = []
    for row in recent:
        normal = lookup.get((row["variable"], int(row["date"][5:7])))
        if row["value"] is None or normal is None:
            continue
        diff = row["value"] - normal
        result.append(dict(variable=row["variable"], date=row["date"], value=diff,
                           percent=100 * diff / abs(normal) if normal != 0 else None))
    return result


def trends(recent: list[dict], normals: list[dict]) -> list[dict]:
    # Últimos tres meses disponibles por variable: no mezclamos toda la década.
    changes = anomalies(recent, normals)
    def values(variable, field):
        rows = sorted((r for r in changes if r["variable"] == variable), key=lambda r: r["date"])[-3:]
        return [r[field] for r in rows if r[field] is not None]
    definitions = [("drought", "PRECTOTCORR", "percent", lambda x: mean(x) <= -25, "Lluvia >=25% bajo la normal"),
                   ("heat", "T2M", "value", lambda x: mean(x) >= 2, "Temperatura >=2 C sobre la normal"),
                   ("vegetation_stress", "NDVI", "percent", lambda x: mean(x) <= -20, "NDVI >=20% bajo la normal")]
    result = []
    for kind, variable, field, predicate, evidence in definitions:
        sample = values(variable, field)
        active = bool(sample) and predicate(sample)
        result.append(dict(type=kind, active=active, evidence=[f"{evidence}; {mean(sample):.2f}"] if active else []))
    ratios = [1 + p/100 for p in values("PRECTOTCORR", "percent")]
    active = len(ratios) >= 3 and mean(ratios) > 0 and pstdev(ratios) / mean(ratios) >= .75
    result.append(dict(type="erratic_rain", active=active,
                       evidence=["CV de lluvia/normal >=0.75 en tres meses"] if active else []))
    return result
