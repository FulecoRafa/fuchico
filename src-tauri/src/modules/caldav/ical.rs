use chrono::{DateTime, NaiveDate, Utc};
use icalendar::{Calendar, CalendarComponent, Component, Todo, TodoStatus};

/// A task in the shape sync actually cares about -- deliberately narrower
/// than `AgendaItem` (tasks/mod.rs) since VTODO only has room for a subset of
/// what a markdown line can express (no recurrence rule mapping in v1).
#[derive(Debug, Clone, PartialEq)]
pub struct SyncTask {
    pub uid: String,
    pub summary: String,
    pub completed: bool,
    pub due: Option<NaiveDate>,
    pub last_modified: Option<DateTime<Utc>>,
}

/// Wraps a single task as a complete `VCALENDAR` document, the body CalDAV
/// `PUT` expects for one resource.
pub fn to_vtodo_ics(task: &SyncTask) -> String {
    let mut todo = Todo::new();
    todo.uid(&task.uid);
    todo.summary(&task.summary);
    todo.status(if task.completed {
        TodoStatus::Completed
    } else {
        TodoStatus::NeedsAction
    });
    if let Some(due) = task.due {
        todo.due(due);
    }
    todo.last_modified(Utc::now());
    let mut cal = Calendar::new();
    cal.push(todo);
    cal.to_string()
}

/// Parses one CalDAV response body into every `VTODO` it contains. A
/// `calendar-multiget`/`sync-collection` REPORT returns one `VCALENDAR` per
/// resource, but a single `PROPFIND` body can bundle several -- callers pass
/// each resource's raw `calendar-data` through here independently, so in
/// practice this returns 0 or 1 tasks per call.
pub fn parse_vtodos(raw: &str) -> Result<Vec<SyncTask>, String> {
    let calendar: Calendar = raw.parse().map_err(|e| format!("invalid iCalendar: {e}"))?;
    let mut out = Vec::new();
    for component in calendar.components.iter() {
        let CalendarComponent::Todo(todo) = component else {
            continue;
        };
        let Some(uid) = todo.get_uid() else {
            continue;
        };
        let summary = todo.get_summary().unwrap_or_default().to_string();
        let completed = matches!(todo.get_status(), Some(TodoStatus::Completed));
        let due = todo.get_due().map(|d| d.date_naive());
        let last_modified = todo.get_last_modified();
        out.push(SyncTask {
            uid: uid.to_string(),
            summary,
            completed,
            due,
            last_modified,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Phase 0 spike: a representative real-world iCloud Reminders VTODO
    /// (field shape/ordering as observed from an actual iCloud CalDAV
    /// `REPORT` response) -- confirms the `icalendar` crate's parser can
    /// round-trip it before the rest of the sync engine is built on top of
    /// this crate.
    const ICLOUD_SAMPLE: &str = "BEGIN:VCALENDAR\r\n\
        VERSION:2.0\r\n\
        PRODID:-//Apple Inc.//iCloud Calendar//EN\r\n\
        CALSCALE:GREGORIAN\r\n\
        BEGIN:VTODO\r\n\
        UID:3F7B2C1A-9E4D-4A6B-8C2F-1D5E7A9B3C4D\r\n\
        DTSTAMP:20260715T120000Z\r\n\
        CREATED:20260715T110000Z\r\n\
        LAST-MODIFIED:20260715T120500Z\r\n\
        SUMMARY:Buy milk\r\n\
        STATUS:NEEDS-ACTION\r\n\
        DUE;VALUE=DATE:20260720\r\n\
        X-APPLE-SORT-ORDER:1\r\n\
        PRIORITY:0\r\n\
        SEQUENCE:0\r\n\
        END:VTODO\r\n\
        END:VCALENDAR\r\n";

    #[test]
    fn parses_real_shaped_icloud_vtodo() {
        let tasks = parse_vtodos(ICLOUD_SAMPLE).unwrap();
        assert_eq!(tasks.len(), 1);
        let t = &tasks[0];
        assert_eq!(t.uid, "3F7B2C1A-9E4D-4A6B-8C2F-1D5E7A9B3C4D");
        assert_eq!(t.summary, "Buy milk");
        assert!(!t.completed);
        assert_eq!(t.due, Some(NaiveDate::from_ymd_opt(2026, 7, 20).unwrap()));
        assert!(t.last_modified.is_some());
    }

    #[test]
    fn parses_completed_status() {
        let raw = ICLOUD_SAMPLE.replace("STATUS:NEEDS-ACTION", "STATUS:COMPLETED");
        let tasks = parse_vtodos(&raw).unwrap();
        assert!(tasks[0].completed);
    }

    #[test]
    fn round_trips_generated_vtodo_through_the_parser() {
        let task = SyncTask {
            uid: "roundtrip-uid-1".to_string(),
            summary: "Call the vet".to_string(),
            completed: false,
            due: Some(NaiveDate::from_ymd_opt(2026, 8, 1).unwrap()),
            last_modified: None,
        };
        let ics = to_vtodo_ics(&task);
        let parsed = parse_vtodos(&ics).unwrap();
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].uid, task.uid);
        assert_eq!(parsed[0].summary, task.summary);
        assert_eq!(parsed[0].due, task.due);
        assert!(!parsed[0].completed);
    }

    #[test]
    fn ignores_non_todo_components() {
        let raw = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:evt-1\r\nSUMMARY:Standup\r\nDTSTAMP:20260715T120000Z\r\nDTSTART:20260716T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        let tasks = parse_vtodos(raw).unwrap();
        assert!(tasks.is_empty());
    }
}
