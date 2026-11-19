import { TODAY } from '../config/constants.js';

export const fmt = (d) => {
  if (!d) return "";
  const s = String(d);
  const dt = new Date(s.includes("T") ? s : s + "T00:00");
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleDateString("en-US", { day: "numeric", month: "short" });
};
export const pl = (n) => (n === 1 ? "resource" : "resources");
export const gPl = (n, w) => n + " " + (n === 1 ? w[0] : w[1]);
export const days = (d) => {
  if (!d) return 0;
  const s = String(d);
  const dt = new Date(s.includes("T") ? s : s + "T00:00");
  const base = new Date(TODAY + "T00:00").getTime();
  return Number.isNaN(dt.getTime()) ? 0 : Math.max(0, Math.round((base - dt.getTime()) / 864e5));
};
export const relTime = (ts) => {
  if (!ts) return "";
  const s = String(ts);
  const ms = typeof ts === "number" ? ts : new Date(s.includes("T") ? s : s + "T12:00:00").getTime();
  if (Number.isNaN(ms)) return s;
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return fmt(new Date(ms).toISOString().slice(0, 10));
};
