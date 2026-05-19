import re
from pydantic import BaseModel, field_validator


class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("올바른 이메일 형식이 아닙니다")
        return v.lower().strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("비밀번호는 6자 이상이어야 합니다")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower().strip()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


class ScoreCreate(BaseModel):
    score: int

    @field_validator("score")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("점수는 0 이상이어야 합니다")
        return v


class ScoreEntry(BaseModel):
    rank: int
    email: str
    score: int
    played_at: str
