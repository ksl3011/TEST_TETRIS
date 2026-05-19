/* TetrisAPI — 전역 API 클라이언트 */
const TetrisAPI = (() => {
  const BASE = 'http://localhost:8000';

  let token = localStorage.getItem('tetris_token');
  let user  = JSON.parse(localStorage.getItem('tetris_user') || 'null');

  // ── 에러 메시지 추출 ──────────────────────────────────────
  function parseError(data) {
    if (!data) return '요청에 실패했습니다';
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      // Pydantic v2: [{msg: "Value error, ...", ...}, ...]
      return data.detail
        .map(e => (e.msg || '').replace(/^Value error,\s*/i, ''))
        .filter(Boolean)
        .join(' / ') || '요청에 실패했습니다';
    }
    return '요청에 실패했습니다';
  }

  // ── 내부 fetch 헬퍼 ───────────────────────────────────────
  async function req(method, path, body, auth) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      _logout();
      throw new Error('인증이 필요합니다. 다시 로그인해 주세요.');
    }
    if (!res.ok) throw new Error(parseError(data));
    return data;
  }

  function _logout() {
    token = null;
    user  = null;
    localStorage.removeItem('tetris_token');
    localStorage.removeItem('tetris_user');
  }

  // ── 공개 API ─────────────────────────────────────────────
  async function register(email, password) {
    return req('POST', '/auth/register', { email, password });
  }

  async function login(email, password) {
    const data = await req('POST', '/auth/login', { email, password });
    token = data.access_token;
    user  = { email: data.email };
    localStorage.setItem('tetris_token', token);
    localStorage.setItem('tetris_user', JSON.stringify(user));
    return data;
  }

  function logout() { _logout(); }

  async function submitScore(score) {
    if (!token) return null;
    return req('POST', '/scores', { score }, true);
  }

  async function getTopScores(limit = 5) {
    return req('GET', `/scores/top?limit=${limit}`);
  }

  async function getMyBest() {
    if (!token) return null;
    return req('GET', '/scores/me/best', undefined, true);
  }

  return {
    register,
    login,
    logout,
    submitScore,
    getTopScores,
    getMyBest,
    isLoggedIn: () => !!token,
    getUser:    () => user,
  };
})();
