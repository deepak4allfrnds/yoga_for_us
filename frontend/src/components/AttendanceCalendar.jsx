import { useMemo, useState } from "react";
import { isoDate, monthCells, weekdayIso } from "../scheduleUtils";

export default function AttendanceCalendar({
  slots = [],
  records = [],
  onToggle,
  disabled,
  viewOnly = false,
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );
  const scheduledDays = new Set(slots.map((s) => Number(s.day_of_week)));
  const byDate = Object.fromEntries(
    records.map((r) => [String(r.session_date).slice(0, 10), r])
  );

  return (
    <div>
      <div className="cal-nav">
        <button
          type="button"
          className="btn btn-outline"
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
          const scheduled = scheduledDays.has(weekdayIso(date));
          const rec = byDate[key];
          const cls = [
            "cal-cell",
            scheduled ? "scheduled" : "",
            rec?.present ? "present" : "",
            rec && rec.present === false ? "absent" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const canToggle = !viewOnly && !disabled && scheduled;
          return (
            <button
              key={key}
              type="button"
              className={cls}
              disabled={viewOnly ? !rec : !canToggle}
              onClick={() => {
                if (!canToggle || !onToggle) return;
                onToggle(key, !(rec && rec.present));
              }}
            >
              <span>{date.getDate()}</span>
              {rec?.present ? <small>Present</small> : null}
              {rec && rec.present === false ? <small>Absent</small> : null}
              {!viewOnly && scheduled && !rec ? <small>Mark</small> : null}
            </button>
          );
        })}
      </div>
      <p className="muted">
        {viewOnly
          ? "Green is present. Red is absent. Use Prev/Next to see other months."
          : "Green days are class days. Click a class day to mark attendance."}
      </p>
    </div>
  );
}
