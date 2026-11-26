use windows::core::{w, HSTRING};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

const EVENTEDIT_BASE: &str = "https://calendar.google.com/calendar/r/eventedit";
const HEX: &[u8; 16] = b"0123456789ABCDEF";

fn percent_encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len() * 3);
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            _ => {
                encoded.push('%');
                encoded.push(HEX[(byte >> 4) as usize] as char);
                encoded.push(HEX[(byte & 0x0F) as usize] as char);
            }
        }
    }
    encoded
}

pub fn build_eventedit_url(
    title: &str,
    start_utc: &str,
    end_utc: &str,
    location: Option<&str>,
    details: Option<&str>,
) -> String {
    let mut url = format!(
        "{EVENTEDIT_BASE}?text={}&dates={}/{}",
        percent_encode(title),
        percent_encode(start_utc),
        percent_encode(end_utc),
    );
    if let Some(location) = location.filter(|value| !value.is_empty()) {
        url.push_str("&location=");
        url.push_str(&percent_encode(location));
    }
    if let Some(details) = details.filter(|value| !value.is_empty()) {
        url.push_str("&details=");
        url.push_str(&percent_encode(details));
    }
    url
}

pub fn open_eventedit_url(url: &str) -> Result<(), String> {
    let url_hstring = HSTRING::from(url);
    let instance =
        unsafe { ShellExecuteW(None, w!("open"), &url_hstring, None, None, SW_SHOWNORMAL) };
    if instance.0 as usize > 32 {
        Ok(())
    } else {
        Err(format!(
            "failed to open browser (ShellExecute error {})",
            instance.0 as usize
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::build_eventedit_url;

    #[test]
    fn builds_eventedit_url_with_utc_dates_and_location() {
        let url = build_eventedit_url(
            "team meeting",
            "20261130T033000Z",
            "20261130T043000Z",
            Some("the office"),
            None,
        );
        assert_eq!(
            url,
            "https://calendar.google.com/calendar/r/eventedit?text=team%20meeting&dates=20261130T033000Z/20261130T043000Z&location=the%20office"
        );
    }

    #[test]
    fn omits_empty_location_and_details() {
        let url = build_eventedit_url(
            "lunch with mom",
            "20261126T033000Z",
            "20261126T043000Z",
            Some(""),
            None,
        );
        assert_eq!(
            url,
            "https://calendar.google.com/calendar/r/eventedit?text=lunch%20with%20mom&dates=20261126T033000Z/20261126T043000Z"
        );
    }
}
