//! Versioned native presentation stored by the existing workspace artifact reference.
//! Web chart v5 is a separate contract; this is not an implicit format conversion.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartSettings {
    pub future_bars: u16,
    pub grid_opacity: f64,
    pub candle_up_color: String,
    pub candle_down_color: String,
    pub candle_border_up_color: String,
    pub candle_border_down_color: String,
    pub candle_wick_up_color: String,
    pub candle_wick_down_color: String,
    pub background_color: String,
    pub show_grid: bool,
    pub show_price_line: bool,
    pub show_crosshair: bool,
    pub show_candle_borders: bool,
    pub show_candle_wicks: bool,
    pub scale_mode: String,
    pub invert_scale: bool,
    pub scale_margin_top: f64,
    pub scale_margin_bottom: f64,
    pub show_strategy_trades: bool,
    pub show_mark_price: bool,
}
impl Default for ChartSettings {
    fn default() -> Self {
        Self {
            future_bars: 24,
            grid_opacity: 0.075,
            candle_up_color: "#34d399".into(),
            candle_down_color: "#ef4444".into(),
            candle_border_up_color: "#34d399".into(),
            candle_border_down_color: "#ef4444".into(),
            candle_wick_up_color: "#34d399".into(),
            candle_wick_down_color: "#ef4444".into(),
            background_color: "#0a0d12".into(),
            show_grid: true,
            show_price_line: true,
            show_crosshair: true,
            show_candle_borders: false,
            show_candle_wicks: true,
            scale_mode: "normal".into(),
            invert_scale: false,
            scale_margin_top: 0.08,
            scale_margin_bottom: 0.18,
            show_strategy_trades: true,
            show_mark_price: true,
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Presentation {
    pub version: u16,
    pub chart_id: String,
    pub chart_type: String,
    pub settings: ChartSettings,
    pub volume_visible: bool,
    pub volume_ratio: f64,
}
impl Default for Presentation {
    fn default() -> Self {
        Self {
            version: 1,
            chart_id: "primary-chart".into(),
            chart_type: "candles".into(),
            settings: ChartSettings::default(),
            volume_visible: true,
            volume_ratio: 0.22,
        }
    }
}
impl Presentation {
    pub fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.chart_id != "primary-chart"
            || !matches!(
                self.chart_type.as_str(),
                "candles" | "bars" | "line" | "area"
            )
        {
            return Err("Unsupported native presentation identity/type/version".into());
        }
        let s = &self.settings;
        if s.future_bars > 200
            || !matches!(
                s.scale_mode.as_str(),
                "normal" | "logarithmic" | "percentage"
            )
            || !s.grid_opacity.is_finite()
            || !(0.0..=1.0).contains(&s.grid_opacity)
            || !s.scale_margin_top.is_finite()
            || !(0.0..=0.4).contains(&s.scale_margin_top)
            || !s.scale_margin_bottom.is_finite()
            || !(0.0..=0.4).contains(&s.scale_margin_bottom)
            || !self.volume_ratio.is_finite()
            || !(0.1..=0.5).contains(&self.volume_ratio)
        {
            return Err("Invalid native chart scale/pane settings".into());
        }
        for value in [
            &s.candle_up_color,
            &s.candle_down_color,
            &s.candle_border_up_color,
            &s.candle_border_down_color,
            &s.candle_wick_up_color,
            &s.candle_wick_down_color,
            &s.background_color,
        ] {
            if value.len() != 7
                || !value.starts_with('#')
                || !value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
            {
                return Err("Chart colors must be #RRGGBB".into());
            }
        }
        Ok(())
    }
}
pub const DRAWING_TYPES: &[&str] = &[
    "trend-line",
    "ray",
    "extended-line",
    "horizontal-line",
    "horizontal-ray",
    "vertical-line",
    "rectangle",
    "arrow",
    "text",
    "price-label",
    "ruler",
    "price-range",
    "date-range",
    "long-position",
    "short-position",
    "fibonacci-retracement",
    "cross-line",
    "parallel-channel",
    "fibonacci-extension",
    "ellipse",
    "polyline",
    "callout",
];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrawingAnchor {
    pub time_ms: u64,
    pub price_ticks: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrawingObject {
    pub id: String,
    pub kind: String,
    pub anchors: Vec<DrawingAnchor>,
    pub color: String,
    pub width: u8,
    pub line_style: String,
    pub opacity: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub levels: Vec<f64>,
    pub locked: bool,
    pub hidden: bool,
    pub z_order: i32,
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

pub fn drawing_anchor_count(kind: &str) -> Option<(usize, usize)> {
    if !DRAWING_TYPES.contains(&kind) {
        return None;
    }
    Some(match kind {
        "horizontal-line" | "vertical-line" | "cross-line" | "text" | "price-label" | "callout" => {
            (1, 1)
        }
        "parallel-channel" | "fibonacci-extension" => (3, 3),
        "polyline" => (2, 500),
        _ => (2, 2),
    })
}

impl DrawingObject {
    pub fn validate(&self) -> Result<()> {
        zt_domain::validate_id(&self.id)?;
        let (min_anchors, max_anchors) =
            drawing_anchor_count(&self.kind).ok_or("Unsupported drawing tool type")?;
        if !(min_anchors..=max_anchors).contains(&self.anchors.len())
            || !valid_hex_color(&self.color)
            || !(1..=4).contains(&self.width)
            || !matches!(self.line_style.as_str(), "solid" | "dashed" | "dotted")
            || !self.opacity.is_finite()
            || !(0.05..=1.0).contains(&self.opacity)
            || !(-10_000..=10_000).contains(&self.z_order)
            || self.levels.len() > 32
            || self
                .levels
                .iter()
                .any(|lvl| !lvl.is_finite() || lvl.abs() > 100.0)
        {
            return Err("Invalid drawing anchors, style, levels or bounds".into());
        }
        if let Some(fill) = &self.fill {
            if !valid_hex_color(fill) {
                return Err("Drawing fill color must be #RRGGBB".into());
            }
        }
        if let Some(text) = &self.text {
            if text.len() > 500 || text.contains('\0') {
                return Err("Drawing text exceeds 500 UTF-8 bytes or contains NUL".into());
            }
        }
        Ok(())
    }
}

impl Store {
    pub(crate) fn presentation_for(&self, w: &Workspace) -> Result<Presentation> {
        let value = if let Some(reference) = &w.document.presentation {
            if reference.bytes > 8192 {
                return Err("Native presentation exceeds 8 KiB".into());
            }
            serde_json::from_slice(&self.artifact(reference)?).map_err(err)?
        } else {
            Presentation::default()
        };
        value.validate()?;
        Ok(value)
    }
    pub(crate) fn drawings_for(&self, w: &Workspace) -> Result<Vec<DrawingObject>> {
        let Some(reference) = &w.chart.drawings else {
            return Ok(vec![]);
        };
        if reference.bytes > 65_536 {
            return Err("Chart drawings exceed 64 KiB".into());
        }
        let drawings: Vec<DrawingObject> =
            serde_json::from_slice(&self.artifact(reference)?).map_err(err)?;
        if drawings.len() > 256 {
            return Err("Chart drawings exceed 256 objects".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for d in &drawings {
            d.validate()?;
            if !ids.insert(&d.id) {
                return Err("Duplicate drawing identifier".into());
            }
        }
        Ok(drawings)
    }
    pub fn chart_drawings(&self, id: &str, revision: u64) -> Result<Vec<DrawingObject>> {
        let w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Stale drawings revision".into());
        }
        self.drawings_for(&w)
    }
    pub fn save_drawings(
        &mut self,
        id: &str,
        revision: u64,
        drawings: Vec<DrawingObject>,
    ) -> Result<Workspace> {
        if drawings.len() > 256 {
            return Err("Chart drawings exceed 256 objects".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for d in &drawings {
            d.validate()?;
            if !ids.insert(&d.id) {
                return Err("Duplicate drawing identifier".into());
            }
        }
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before saving drawings".into());
        }
        if self.drawings_for(&w)? == drawings {
            return Ok(w);
        }
        w.chart.drawings = if drawings.is_empty() {
            None
        } else {
            let encoded = serde_json::to_vec(&drawings).map_err(err)?;
            if encoded.len() > 65_536 {
                return Err("Chart drawings exceed 64 KiB".into());
            }
            Some(self.put_artifact(&encoded)?)
        };
        w.chart.revision = w.chart.revision.checked_add(1).ok_or("Chart revision exhausted")?;
        w.document.revision = revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        self.commit(w, revision)
    }
    pub fn save_indicators(
        &mut self,
        id: &str,
        revision: u64,
        indicators: Vec<zt_domain::IndicatorConfiguration>,
    ) -> Result<Workspace> {
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before saving indicators".into());
        }
        if w.chart.indicators == indicators {
            return Ok(w);
        }
        w.chart.indicators = indicators;
        w.chart.validate()?;
        w.chart.revision = w.chart.revision.checked_add(1).ok_or("Chart revision exhausted")?;
        w.document.revision = revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        self.commit(w, revision)
    }
    pub fn save_replay(
        &mut self,
        id: &str,
        revision: u64,
        replay: Option<zt_domain::ReplayClock>,
    ) -> Result<Workspace> {
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before saving replay state".into());
        }
        if w.chart.replay == replay {
            return Ok(w);
        }
        w.chart.replay = replay;
        w.chart.validate()?;
        w.chart.revision = w.chart.revision.checked_add(1).ok_or("Chart revision exhausted")?;
        w.document.revision = revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        self.commit(w, revision)
    }
    pub fn chart_presentation(&self, id: &str) -> Result<Presentation> {
        self.presentation_for(&self.load(id)?)
    }
    pub fn chart_presentation_at(&self, id: &str, revision: u64) -> Result<Presentation> {
        let w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Stale presentation revision".into());
        }
        self.presentation_for(&w)
    }
    pub fn save_presentation(
        &mut self,
        id: &str,
        revision: u64,
        value: Presentation,
    ) -> Result<Workspace> {
        value.validate()?;
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before applying chart settings".into());
        }
        if self.presentation_for(&w)? == value {
            return Ok(w);
        }
        w.document.presentation =
            Some(self.put_artifact(&serde_json::to_vec(&value).map_err(err)?)?);
        w.document.revision = revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        self.commit(w, revision)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn scoped_settings_roundtrip_and_conflicts_preserve_older_work() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("a".into(), "A".into()).unwrap();
        s.create("b".into(), "B".into()).unwrap();
        let mut p = Presentation::default();
        p.chart_type = "area".into();
        p.settings.invert_scale = true;
        p.settings.candle_up_color = "#aabbcc".into();
        p.volume_visible = false;
        assert_eq!(
            s.save_presentation("a", 1, p.clone())
                .unwrap()
                .document
                .revision,
            2
        );
        assert!(s
            .save_presentation("a", 1, Presentation::default())
            .is_err());
        assert_eq!(s.chart_presentation("b").unwrap(), Presentation::default());
        drop(s);
        let s = Store::open(root.path()).unwrap();
        assert_eq!(s.chart_presentation("a").unwrap(), p);
        let mut invalid = p.clone();
        invalid.settings.scale_margin_top = f64::NAN;
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.settings.background_color = "url(x)".into();
        assert!(invalid.validate().is_err());
        invalid = p.clone();
        invalid.chart_id = "another-chart".into();
        assert!(invalid.validate().is_err());
        let mut unknown = serde_json::to_value(&p).unwrap();
        unknown["webChartVersion"] = serde_json::json!(5);
        assert!(serde_json::from_value::<Presentation>(unknown).is_err());
    }
    #[test]
    fn all_22_drawing_types_indicators_and_replay_roundtrip_with_cas() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("a".into(), "A".into()).unwrap();
        let mut drawings = Vec::new();
        for (idx, kind) in DRAWING_TYPES.iter().enumerate() {
            let (min_anchors, _) = drawing_anchor_count(kind).unwrap();
            let anchors = (0..min_anchors)
                .map(|k| DrawingAnchor {
                    time_ms: 60_000 * (k as u64 + 1),
                    price_ticks: 100 + k as i64,
                })
                .collect();
            drawings.push(DrawingObject {
                id: format!("d-{idx}"),
                kind: (*kind).into(),
                anchors,
                color: "#7dd3fc".into(),
                width: 2,
                line_style: "solid".into(),
                opacity: 0.9,
                fill: Some("#34d399".into()),
                text: Some("Note".into()),
                levels: if kind.starts_with("fibonacci-") {
                    vec![0.0, 0.5, 1.0]
                } else {
                    vec![]
                },
                locked: false,
                hidden: false,
                z_order: idx as i32,
            });
        }
        assert_eq!(drawings.len(), 22);
        let w = s.save_drawings("a", 1, drawings.clone()).unwrap();
        assert_eq!(w.document.revision, 2);
        assert_eq!(s.chart_drawings("a", 2).unwrap(), drawings);
        assert!(s.save_drawings("a", 1, vec![]).is_err());
        let indicators = vec![
            zt_domain::IndicatorConfiguration {
                id: "ema-20".into(),
                kind: "ema".into(),
                period: 2,
            },
            zt_domain::IndicatorConfiguration {
                id: "rsi-14".into(),
                kind: "rsi".into(),
                period: 2,
            },
        ];
        let w = s.save_indicators("a", 2, indicators.clone()).unwrap();
        assert_eq!(w.chart.indicators, indicators);
    }
}
