use tauri::State;

use crate::notes::Note;
use crate::storage::Db;

#[tauri::command]
pub fn notes_list(db: State<Db>) -> Result<Vec<Note>, String> {
    let connection = db.0.lock().unwrap();
    crate::notes::list(&connection)
}

#[tauri::command]
pub fn notes_create(db: State<Db>) -> Result<Note, String> {
    let connection = db.0.lock().unwrap();
    crate::notes::create(&connection)
}

#[tauri::command]
pub fn notes_update(
    db: State<Db>,
    id: String,
    title: String,
    body: String,
) -> Result<Note, String> {
    let connection = db.0.lock().unwrap();
    crate::notes::update(&connection, &id, &title, &body)
}

#[tauri::command]
pub fn notes_toggle_pin(db: State<Db>, id: String) -> Result<Note, String> {
    let connection = db.0.lock().unwrap();
    crate::notes::toggle_pin(&connection, &id)
}

#[tauri::command]
pub fn notes_delete(db: State<Db>, id: String) -> Result<(), String> {
    let connection = db.0.lock().unwrap();
    crate::notes::delete(&connection, &id)
}
