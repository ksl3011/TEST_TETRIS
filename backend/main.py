from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from auth import create_token, get_current_user_id, hash_password, verify_password
from database import get_db, init_db
from schemas import LoginRequest, RegisterRequest, ScoreCreate, ScoreEntry, TokenResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Tetris API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth ───────────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
def register(req: RegisterRequest):
    with get_db() as conn:
        if conn.execute("SELECT id FROM users WHERE email=?", (req.email,)).fetchone():
            raise HTTPException(400, "이미 가입된 이메일입니다")
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (req.email, hash_password(req.password)),
        )
    return {"message": "가입이 완료됐습니다"}


@app.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email=?", (req.email,)
        ).fetchone()
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(401, "이메일 또는 비밀번호가 올바르지 않습니다")
    return TokenResponse(
        access_token=create_token(row["id"]),
        email=row["email"],
    )


# ── Scores ─────────────────────────────────────────────────

@app.post("/scores", status_code=201)
def post_score(body: ScoreCreate, user_id: int = Depends(get_current_user_id)):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO scores (user_id, score) VALUES (?, ?)", (user_id, body.score)
        )
    return {"message": "점수가 저장됐습니다"}


@app.get("/scores/top", response_model=List[ScoreEntry])
def top_scores(limit: int = 10):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.email, s.score, s.played_at
            FROM scores s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.score DESC
            LIMIT ?
            """,
            (min(limit, 100),),
        ).fetchall()
    return [
        ScoreEntry(rank=i + 1, email=r["email"], score=r["score"], played_at=r["played_at"])
        for i, r in enumerate(rows)
    ]


@app.get("/scores/me/best")
def my_best(user_id: int = Depends(get_current_user_id)):
    with get_db() as conn:
        row = conn.execute(
            "SELECT MAX(score) AS best FROM scores WHERE user_id=?", (user_id,)
        ).fetchone()
    return {"best": row["best"] or 0}
