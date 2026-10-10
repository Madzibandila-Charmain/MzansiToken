"""main.py - single entry point for the MzansiToken backend

Run it from the `backend` folder:
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs to see and test every endpoint.
"""

import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Each person imports only their own router, so two people editing the backend at the same time touch different files and git has nothing to conflict on.
from db import init_db
from app.routers.tokenizer_router import router as tokenizer_router
from app.routers.metrics_router import router as metrics_router
from app.routers.inspect_router import router as inspect_router
from app.routers.example_router import router as example_router
from app.routers.mbi_router import router as mbi_router
from app.routers.rank_router import router as rank_router

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="MzansiToken API", lifespan=lifespan)


# An unexpected error inside an endpoint used to come back as a bare 500
# from Starlette's outermost layer, which sits OUTSIDE the CORS middleware
# below - so the response had no CORS header, the browser refused to hand
# it to the page, and the page reported "Cannot reach the backend ... Is the
# backend running?" while the backend was running fine. This turns any such
# error into an ordinary JSON 500 from INSIDE the CORS layer (it is
# registered before CORS, and Starlette runs the last-registered middleware
# outermost), so the page can read it and say what actually happened. The
# full traceback still goes to this terminal, which is where to look.
@app.middleware("http")
async def unexpected_errors_reach_the_page(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": "The backend hit an unexpected error while handling this request."},
        )

# CORS: the React dev server runs on 5173 (Vite) or 3000, this backend on 8000.
# Without this the browser blocks requests between the two ports.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    """Confirm that the MzansiToken API is running."""
    return {"message": "MzansiToken API is running"}


app.include_router(tokenizer_router)
app.include_router(metrics_router)
app.include_router(inspect_router)
app.include_router(example_router)
app.include_router(mbi_router)
app.include_router(rank_router)