use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub artwork_url: Option<String>,
    pub duration_seconds: Option<f64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackUpdate {
    pub track: Option<TrackMetadata>,
    pub is_playing: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressUpdate {
    pub position_seconds: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub is_playing: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub track: Option<TrackMetadata>,
    pub is_playing: bool,
    pub position_seconds: Option<f64>,
}
