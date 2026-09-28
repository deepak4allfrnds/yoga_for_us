import { useMemo, useState } from "react";
import { isoDate, monthCells, weekdayIso } from "../scheduleUtils";

export default function AttendanceCalendar({
  slots = [],
  records = [],
  onToggle,
  disabled,
  viewOnly = false,
  startDate,
  endDate,
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const windowEnd = endDate ? new Date(`${endDate}T00:00:00`) : null;
  const initial = windowStart && windowStart > today ? windowStart : today;
  const [cursor, setCursor] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1)
  );
  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );
  const scheduledDays = new Set(
    slots.map((s) => Number(s.day_of_week)).filter((n) => n >= 1 && n <= 7)
  );
  const [localMarks, setLocalMarks] = useState({});
  const byDate = Object.fromEntries(
    records.map((r) => [String(r.session_date).slice(0, 10), r])
  );

  function recordFor(key) {
    return localMarks[key] || byDate[key] || null;
  }

  function inPaidWindow(date) {
    if (windowStart && date < windowStart) return false;
    if (windowEnd && date > windowEnd) return false;
    return true;
  }

  function isClassDay(date) {
    if (!inPaidWindow(date)) return false;
    if (scheduledDays.size === 0) return true;
    return scheduledDays.has(weekdayIso(date));
  }

  const minMonth = windowStart
    ? new Date(windowStart.getFullYear(), windowStart.getMonth(), 1)
    : null;
  const maxMonth = windowEnd
    ? new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1)
    : null;

  return (
    <div>
      <div className="cal-nav">
        <button
          type="button"
          className="btn btn-outline"
          disabled={minMonth && cursor <= minMonth}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
        >
          Prev
        </button>
        <strong>
          {cursor.toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </strong>
        <button
          type="button"
          className="btn btn-outline"
          disabled={maxMonth && cursor >= maxMonth}
          onClick={() =>
            setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
        >
          Next
        </button>
      </div>
      <div className="cal-grid cal-head">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="cal-cell empty" />;
          const key = isoDate(date);
          const inWindow = inPaidWindow(date);
          const scheduled = isClassDay(date);
          const found = inWindow ? recordFor(key) : null;
          const rec = found && !found.cleared ? found : null;
          const isToday = date.getTime() === today.getTime();
          const isPresent = rec?.present === true;
          const isAbsent = rec && rec.present === false;
          const cls = [
            "cal-cell",
            scheduled ? "scheduled" : "",
            !inWindow ? "empty" : "",
            isToday ? "today" : "",
            isPresent ? "present" : "",
            isAbsent ? "absent" : "",
          ]
            .filter(Boolean)
            .join(" ");
          // Any class day from the start date to the due date can be marked or
          // changed, including past days; days after the due date stay locked.
          const canToggle = !viewOnly && !disabled && scheduled;
          return (
            <button
              key={key}
              type="button"
              className={cls}
              disabled={viewOnly ? !rec : !canToggle}
              title={
                canToggle
                  ? isPresent
                    ? "Present — click to change to Absent"
                    : isAbsent
                      ? "Absent — click to clear"
                      : "Click to mark Present"
                  : undefined
              }
              onClick={() => {
                if (!canToggle || !onToggle) return;
                // Cycle: not marked -> Present -> Absent -> not marked
                const next = !rec || rec.cleared ? true : isPresent ? false : null;
                setLocalMarks((prev) => ({
                  ...prev,
                  [key]:
                    next === null
                      ? { session_date: key, cleared: true }
                      : { session_date: key, present: next },
                }));
                onToggle(key, next);
              }}
            >
              <span>{date.getDate()}</span>
              {inWindow && isPresent ? <small>Present</small> : null}
              {inWindow && isAbsent ? <small>Absent</small> : null}
              {canToggle && !rec ? <small>Mark</small> : null}
              {endDate && key === endDate ? <small className="cal-due">Due</small> : null}
            </button>
          );
        })}
      </div>
      <p className="muted">
        {viewOnly
          ? "Green is present. Red is absent. Use Prev/Next to see other months."
          : startDate && endDate
            ? `Mark attendance from ${startDate} to your due date ${endDate}. Click a class day to mark Present, click again for Absent, and once more to clear it. Days after the due date unlock when you renew.`
            : "Green days are class days. Click a class day to mark attendance."}
      </p>
    </div>
  );
}
