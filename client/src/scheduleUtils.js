export const DAYS = [
  { id: 1, label: "Mon" },
  { id: 2, label: "Tue" },
  { id: 3, label: "Wed" },
  { id: 4, label: "Thu" },
  { id: 5, label: "Fri" },
  { id: 6, label: "Sat" },
  { id: 7, label: "Sun" },
];

export function weekTeacherSummary(slots) {
  const names = [...new Set(slots.map((s) => s.trainer_name).filter(Boolean))];
  if (names.length === 1 && slots.length >= 6) {
    return `${names[0]} takes this studio’s classes all week.`;
  }
  if (names.length === 1) {
    return `${names[0]} leads the sessions listed this week.`;
  }
  return `This week’s teachers: ${names.join(", ")}.`;
}

export function monthCells(year, month) {
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(year, month, d));
  }
  return cells;
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekdayIso(date) {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}
