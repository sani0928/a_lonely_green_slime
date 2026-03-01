/** 점수 제출·리더보드 API */
const API_BASE_URL =
  window.GAME_API_BASE_URL || "http://localhost:8000";

export async function submitScore(nickname, score) {
  const url = `${API_BASE_URL}/api/scores/`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nickname, score }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      data && data.detail ? data.detail : "점수 등록에 실패했습니다.";
    throw new Error(message);
  }

  return response.json();
}

export async function fetchLeaderboard(limit = 10, period = "30d") {
  const params = new URLSearchParams({ limit: String(limit), period });
  const url = `${API_BASE_URL}/api/scores/?${params}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("리더보드 불러오기 실패");
  }
  return response.json();
}

export async function submitFeedback(content) {
  const response = await fetch(`${API_BASE_URL}/api/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.detail || "피드백 전송에 실패했습니다.";
    throw new Error(message);
  }
  return response.json();
}

