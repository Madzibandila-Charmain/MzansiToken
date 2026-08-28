"""main.py - single entry point for the MzansiToken backend

Run it from the `backend` folder:
    uvicorn main:app --reload --port 8000

Then open http://localhost:8000/docs to see and test every endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Each person imports only their own router, so two people editing the backend at the same time touch different files and git has nothing to conflict on.
from app.routers.tokenizer_router import router as tokenizer_router
from app.routers.metrics_router import router as metrics_router
from app.routers.inspect_router import router as inspect_router
from app.routers.example_router import router as example_router


# Ethan's routers go here too, e.g.:
# from app.routers.mbi_router import router as mbi_router
# from app.routers.nchlt_router import router as nchlt_router

app = FastAPI(title="MzansiToken API")

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
    allow_methods=["GET", "POST"],
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

# Ethans 
# app.include_router(mbi_router)
# app.include_router(nchlt_router)