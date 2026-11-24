use tauri::State;

use crate::snippets::Snippet;
use crate::storage::Db;

#[tauri::command]
pub fn snippets_list(db: State<Db>) -> Result<Vec<Snippet>, String> {
    let connection = db.0.lock().unwrap();
    crate::snippets::list(&connection)
}

#[tauri::command]
pub fn snippets_create(
    db: State<Db>,
    label: String,
    content: String,
    category: String,
) -> Result<Snippet, String> {
    let connection = db.0.lock().unwrap();
    crate::snippets::create(&connection, &label, &content, &category)
}

#[tauri::command]
pub fn snippets_update(
    db: State<Db>,
    id: String,
    label: String,
    content: String,
    category: String,
) -> Result<Snippet, String> {
    let connection = db.0.lock().unwrap();
    crate::snippets::update(&connection, &id, &label, &content, &category)
}

#[tauri::command]
pub fn snippets_delete(db: State<Db>, id: String) -> Result<(), String> {
    let connection = db.0.lock().unwrap();
    crate::snippets::delete(&connection, &id)
}

#[tauri::command]
pub fn snippets_clear(db: State<Db>) -> Result<(), String> {
    let connection = db.0.lock().unwrap();
    crate::snippets::clear_all(&connection)
}

#[tauri::command]
pub fn snippets_copy(db: State<Db>, id: String) -> Result<(), String> {
    let connection = db.0.lock().unwrap();
    let content = crate::snippets::content_of(&connection, &id)?;
    drop(connection);
    crate::clipboard::write_clipboard_text(&content)
}
