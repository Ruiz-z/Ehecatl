from fastapi import FastAPI

from app.routes.health import router as health_router
from app.routes.indicators import router as indicators_router

app = FastAPI(title="Ehécatl Geo")
app.include_router(health_router)
app.include_router(indicators_router)
