export function formatPlaySecondsForLeaderboard(value) {
  if (value === null || value === undefined || value === "") return "";
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "";

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const restSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}
