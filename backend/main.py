"""main.py - single entry point for the MzansiToken backend"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Each person imports only their own router
from App.Routers.tokenizer_router import router as tokenizer_router
from App.Routers.metrics_router import router as metrics_router
from App.Routers.inspect_router import router as inspect_router
from App.Routers.example_router import router as example_router
# Ethan's imports go here too, e.g.:
# from app.routers.mbi_router import router as mbi_router
# from app.routers.nchlt_router import router as nchlt_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(tokenizer_router)
app.include_router(metrics_router)
app.include_router(inspect_router)
app.include_router(example_router)
# app.include_router(mbi_router)
# app.include_router(nchlt_router)