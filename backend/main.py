from fastapi import FastAPI

app = FastAPI(title="Career Path Knowledge Graph API")


@app.get("/")
def read_root():
    return {"message": "Career Path Knowledge Graph backend placeholder"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
