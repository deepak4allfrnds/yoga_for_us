import { DAYS, weekTeacherSummary } from "../scheduleUtils";

export default function WeeklySchedule({
  slots = [],
  title = "Weekly studio schedule",
}) {
  return (
    <div>
      {title ? (
        <h3 className="serif" style={{ color: "var(--green-dark)", marginTop: 0 }}>
          {title}
        </h3>
      ) : null}
      {slots.length ? (
        <p className="muted">{weekTeacherSummary(slots)}</p>
      ) : (
        <p className="muted">No classes scheduled for this selection.</p>
      )}
      <div className="week-grid">
        {DAYS.map((day) => {
          const daySlots = slots.filter((s) => Number(s.day_of_week) === day.id);
          return (
            <div className="week-col" key={day.id}>
              <strong>{day.label}</strong>
              {daySlots.length === 0 ? (
                <p className="muted">Rest</p>
              ) : (
                daySlots.map((s) => (
                  <div className="week-slot" key={s.id}>
                    <div>
                      {s.start_time}–{s.end_time}
                    </div>
                    <div>{s.class_title}</div>
                    <div className="muted">{s.trainer_name}</div>
                    <span className="badge paid">{s.mode}</span>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
