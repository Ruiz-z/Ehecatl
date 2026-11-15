# Geo

Servicio sin estado con `/health` y `/indicators`: POWER, NDVI MODIS con respaldo Planetary Computer Terra/Aqua, climatología, anomalías y ventanas de cultivo para cualquier lat/lon.

Desde esta carpeta:

- Instalar Python/dependencias bloqueadas: `uv sync --frozen`.
- Desarrollo: `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`.
- Tests: `uv run python -m pytest`.
- Verificación sintáctica (sin linter adicional): `uv run python -m compileall -q app tests`.

`.python-version` fija Python 3.12 para desarrollo y Docker usa `python:3.12-slim`. `pyproject.toml` admite Python 3.11+. El Dockerfile instala las dependencias Python de ejecución mediante `uv.lock` y `libexpat1` del sistema, necesaria para cargar `rasterio`. Durante el build comprueba `import rasterio` para detectar bibliotecas faltantes antes de arrancar.

Compose fija `HOST`/`PORT`; el `.env.example` de esta app documenta los mismos valores para ejecución independiente. No requiere base de datos ni credenciales NASA.
