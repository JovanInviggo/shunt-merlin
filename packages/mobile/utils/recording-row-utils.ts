import { useI18n } from "@/locales/i18n";
import { AnalysisStatus, RecordingStatus } from "./recordings-service";

export const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Format timestamp to relative time
export const formatRelativeTime = (timestamp: string): string => {
  const { t } = useI18n();
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  // Calendar-day difference: compare midnight boundaries, not elapsed hours
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const calendarDayDiff = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Format time as HH:MM
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffMins < 1) {
    return t.common.justNow;
  }

  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }

  if (calendarDayDiff === 0) {
    return `Today, ${timeStr}`;
  }

  if (calendarDayDiff === 1) {
    return `Yesterday, ${timeStr}`;
  }

  if (calendarDayDiff < 7) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return `${dayNames[date.getDay()]}, ${timeStr}`;
  }

  // Format as date for older recordings
  const dateStr = date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${dateStr}, ${timeStr}`;
};

// Get status dot color
export const getStatusColor = (status: RecordingStatus): string => {
  switch (status) {
    case "uploaded":
      return "#4CAF50"; // Green
    case "uploading":
      return "#FFC107"; // Yellow/Orange
    case "failed":
      return "#F44336"; // Red
    default:
      return "#9E9E9E"; // Gray
  }
};
