use serde::Deserialize;

use crate::calendar;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDraft {
    title: String,
    start_utc: String,
    end_utc: String,
    location: Option<String>,
    details: Option<String>,
}

#[tauri::command]
pub fn calendar_open_event(draft: EventDraft) -> Result<(), String> {
    let url = calendar::build_eventedit_url(
        &draft.title,
        &draft.start_utc,
        &draft.end_utc,
        draft.location.as_deref(),
        draft.details.as_deref(),
    );
    calendar::open_eventedit_url(&url)
}
