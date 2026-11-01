//! Exact native projection of the existing Store, not a second repository.
use super::*;
use serde_json::{json, Value};
use zt_core::{load_local_research_source, LocalResearchSource};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExactUnits {
    pub price_step: String,
    pub quantity_step: String,
}

pub fn units(value: &str, step: &str, quantity: bool) -> Result<i64> {
    let v = Decimal::from_str_exact(value).map_err(err)?;
    let s = Decimal::from_str_exact(step).map_err(err)?;
    if s <= Decimal::ZERO
        || (quantity && v < Decimal::ZERO)
        || v.checked_rem(s) != Some(Decimal::ZERO)
    {
        return Err("Invalid exact increment or negative quantity".into());
    }
    v.checked_div(s)
        .and_then(|n| n.to_i64())
        .ok_or("Exact units exceed i64".into())
}

impl Store {
    pub fn import_native(
        &mut self,
        id: &str,
        revision: u64,
        input: Import,
        exact: ExactUnits,
    ) -> Result<Workspace> {
        for s in [&exact.price_step, &exact.quantity_step] {
            if s.len() > 20 || s.contains(['e', 'E', '+', '-']) {
                return Err("Use a positive plain decimal increment".into());
            }
            units(s, s, true)?;
        }
        self.import_with_units(id, revision, input, Some(exact))
    }

    /// A bar becomes available at completion. Filtering occurs in Rust before any
    /// value, scale, hover or accessibility payload reaches the presentation.
    pub fn native_scene(&self, id: &str, expected: u64, cutoff: Option<u64>) -> Result<Value> {
        let w = self.load(id)?;
        if w.document.revision != expected {
            return Err("Stale scene revision".into());
        }
        let d = w.dataset.as_ref().ok_or("No imported historical data available")?;
        let store = SegmentStore::open(self.root.join(&d.segment.sha256)).map_err(err)?;
        let key = SegmentKey {
            symbol_id: 1,
            interval_ns: d
                .interval_ms
                .checked_mul(1_000_000)
                .ok_or("Interval overflow")?,
            start_ns: d
                .from_ms
                .checked_mul(1_000_000)
                .ok_or("Timestamp overflow")?,
        };
        let (_, bytes) = store.read(key).map_err(err)?;
        if hash(&bytes) != d.segment.sha256 {
            return Err("Segment integrity failed".into());
        }
        let bars = match load_local_research_source(
            &store,
            key,
            d.imported_at_ms
                .checked_mul(1_000_000)
                .ok_or("Timestamp overflow")?
                .checked_add(1)
                .ok_or("Timestamp overflow")?,
            u64::MAX,
        )
        .map_err(err)?
        {
            LocalResearchSource::Available { bars, .. } => bars,
            LocalResearchSource::Withheld { .. } => {
                return Err("Verified history unavailable".into())
            }
        };
        let end = bars
            .last()
            .ok_or("Empty history")?
            .open_time_ns
            .checked_add(key.interval_ns)
            .ok_or("Completion overflow")?;
        let replay_cutoff = w
            .chart
            .replay
            .as_ref()
            .and_then(|r| u64::try_from(r.available_through_ms).ok())
            .and_then(|ms| ms.checked_mul(1_000_000));
        let through = match (cutoff, replay_cutoff) {
            (Some(a), Some(b)) => a.min(b).min(end),
            (Some(a), None) | (None, Some(a)) => a.min(end),
            (None, None) => end,
        };
        let exact = d.exact_units.clone().unwrap_or(ExactUnits {
            price_step: d.tick_size.to_string(),
            quantity_step: d.quantity_step.to_string(),
        });
        let completed: Vec<&Bar> = bars
            .iter()
            .filter(|b| {
                b.open_time_ns
                    .checked_add(b.interval_ns)
                    .is_some_and(|t| t <= through)
            })
            .collect();
        let available: Vec<Value> = completed
            .iter()
            .map(|b| {
                json!({
                    "timeNs": b.open_time_ns.to_string(),
                    "open": b.open_ticks.to_string(),
                    "high": b.high_ticks.to_string(),
                    "low": b.low_ticks.to_string(),
                    "close": b.close_ticks.to_string(),
                    "volume": b.volume.to_string()
                })
            })
            .collect();
        let closes: Vec<f64> = completed.iter().map(|b| b.close_ticks as f64).collect();
        let indicators: Vec<Value> = w
            .chart
            .indicators
            .iter()
            .map(|ind| {
                let period = ind.period as usize;
                let values = evaluate_indicator(&ind.kind, &closes, period);
                json!({"id": ind.id, "kind": ind.kind, "period": ind.period, "values": values})
            })
            .collect();
        let drawings: Vec<Value> = self
            .drawings_for(&w)?
            .into_iter()
            .filter(|dr| {
                !dr.hidden
                    && dr
                        .anchors
                        .iter()
                        .all(|a| {
                            a.time_ms
                                .saturating_mul(1_000_000)
                                .saturating_add(key.interval_ns)
                                <= through
                        })
            })
            .map(|dr| serde_json::to_value(dr).unwrap())
            .collect();
        Ok(
            json!({"version":2,"workspaceId":w.document.id,"chartId":w.chart.id,"revision":expected.to_string(),"datasetRevision":w.chart.dataset.as_ref().ok_or("Dataset reference missing")?.revision.to_string(),"datasetHash":d.segment.sha256,"sourceHash":d.source.sha256,"instrument":format!("csv:{}:spot",d.symbol),"priceStep":exact.price_step,"quantityStep":exact.quantity_step,"intervalNs":key.interval_ns.to_string(),"availableThroughNs":through.to_string(),"availability":"verified imported history","bars":available,"indicators":indicators,"drawings":drawings}),
        )
    }
}

pub fn evaluate_indicator(kind: &str, closes: &[f64], period: usize) -> Vec<Option<f64>> {
    let mut out = vec![None; closes.len()];
    if closes.is_empty() || period < 2 {
        return out;
    }
    match kind {
        "sma" => {
            let mut sum = 0.0;
            for (i, &c) in closes.iter().enumerate() {
                sum += c;
                if i >= period {
                    sum -= closes[i - period];
                }
                if i + 1 >= period {
                    out[i] = Some(sum / period as f64);
                }
            }
        }
        "ema" => {
            let k = 2.0 / (period as f64 + 1.0);
            let mut prev = closes[0];
            out[0] = Some(prev);
            for (i, &c) in closes.iter().enumerate().skip(1) {
                prev = c * k + prev * (1.0 - k);
                out[i] = Some(prev);
            }
        }
        "rsi" => {
            if closes.len() <= period {
                return out;
            }
            let mut gain = 0.0;
            let mut loss = 0.0;
            for i in 1..=period {
                let d = closes[i] - closes[i - 1];
                if d >= 0.0 {
                    gain += d;
                } else {
                    loss -= d;
                }
            }
            let mut avg_gain = gain / period as f64;
            let mut avg_loss = loss / period as f64;
            let rsi_val = |ag: f64, al: f64| {
                if al == 0.0 {
                    100.0
                } else {
                    100.0 - 100.0 / (1.0 + ag / al)
                }
            };
            out[period] = Some(rsi_val(avg_gain, avg_loss));
            for i in (period + 1)..closes.len() {
                let d = closes[i] - closes[i - 1];
                let (g, l) = if d >= 0.0 { (d, 0.0) } else { (0.0, -d) };
                avg_gain = (avg_gain * (period as f64 - 1.0) + g) / period as f64;
                avg_loss = (avg_loss * (period as f64 - 1.0) + l) / period as f64;
                out[i] = Some(rsi_val(avg_gain, avg_loss));
            }
        }
        _ => {}
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn exact_large_signed_and_zero_units() {
        assert_eq!(
            units("9007199254.740993", "0.000001", false).unwrap(),
            9007199254740993
        );
        assert_eq!(units("-0.75", "0.25", false).unwrap(), -3);
        assert_eq!(units("0", "1", true).unwrap(), 0);
        assert!(units("-1", "1", true).is_err());
        assert!(units("0.3", "0.25", false).is_err());
    }
    #[test]
    fn cutoff_revision_and_retained_exact_data() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("native".into(), "TEST ONLY".into()).unwrap();
        let input=Import{csv:"t,o,h,l,c,v\n60000,9007199254740992,9007199254740993,9007199254740992,9007199254740993,0\n120000,1,999999999999999999,1,1,999999".into(),source_name:"TEST ONLY.csv".into(),symbol:"TEST ONLY".into(),interval_ms:60000,tick_size:1.0,quantity_step:1.0};
        s.import_native(
            "native",
            1,
            input,
            ExactUnits {
                price_step: "1".into(),
                quantity_step: "1".into(),
            },
        )
        .unwrap();
        let scene = s.native_scene("native", 2, Some(120000000000)).unwrap();
        assert_eq!(scene["bars"].as_array().unwrap().len(), 1);
        assert_eq!(scene["bars"][0]["close"], "9007199254740993");
        assert!(s.native_scene("native", 1, None).is_err());
        assert_eq!(
            s.native_scene("native", 2, Some(60000000000)).unwrap()["bars"],
            json!([])
        );
        drop(s);
        assert_eq!(
            Store::open(root.path())
                .unwrap()
                .native_scene("native", 2, Some(120000000000))
                .unwrap(),
            scene
        );
    }
    #[test]
    fn viewport_outside_retained_history_never_commits() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        store.create("range".into(), "TEST ONLY".into()).unwrap();
        store
            .import_native(
                "range",
                1,
                Import {
                    csv: "t,o,h,l,c,v\n60000,100,102,99,101,0\n120000,101,103,100,102,3".into(),
                    source_name: "TEST ONLY.csv".into(),
                    symbol: "TEST ONLY".into(),
                    interval_ms: 60000,
                    tick_size: 0.25,
                    quantity_step: 1.0,
                },
                ExactUnits {
                    price_step: "0.25".into(),
                    quantity_step: "1".into(),
                },
            )
            .unwrap();
        for (from, to) in [(0, 180000), (60000, 240000), (120000, 120000)] {
            assert!(store
                .save("range", 2, "Invalid range".into(), Some(from), Some(to))
                .is_err());
            assert_eq!(store.load("range").unwrap().document.revision, 2);
        }
        let saved = store
            .save(
                "range",
                2,
                "Valid fractional range".into(),
                Some(90000),
                Some(180000),
            )
            .unwrap();
        assert_eq!(saved.chart.visible_from_ms, Some(90000));
        assert_eq!(saved.chart.visible_to_ms, Some(180000));
    }
    #[test]
    fn interrupted_commit_has_no_saved_success_and_keeps_authoritative_revision() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("native".into(), "TEST ONLY".into()).unwrap();
        s.conn.execute_batch("CREATE TRIGGER test_abort BEFORE UPDATE ON workspaces BEGIN SELECT RAISE(ABORT,'TEST ONLY interrupted save'); END;").unwrap();
        assert!(s
            .save("native", 1, "Must not appear".into(), None, None)
            .is_err());
        drop(s);
        let restored = Store::open(root.path())
            .unwrap()
            .restore()
            .unwrap()
            .unwrap();
        assert_eq!(restored.document.revision, 1);
        assert_eq!(restored.document.name, "TEST ONLY");
    }
    #[test]
    fn replay_cutoff_withholds_future_drawings_and_causal_indicators() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("replay".into(), "TEST ONLY".into()).unwrap();
        let input = Import {
            csv: "t,o,h,l,c,v\n60000,10,12,9,10,1\n120000,10,14,10,12,2\n180000,12,200,12,100,3"
                .into(),
            source_name: "TEST ONLY.csv".into(),
            symbol: "TEST".into(),
            interval_ms: 60000,
            tick_size: 1.0,
            quantity_step: 1.0,
        };
        let w = s
            .import_native(
                "replay",
                1,
                input,
                ExactUnits {
                    price_step: "1".into(),
                    quantity_step: "1".into(),
                },
            )
            .unwrap();
        let dataset_ref = w.chart.dataset.clone().unwrap();
        let w = s
            .save_indicators(
                "replay",
                w.document.revision,
                vec![zt_domain::IndicatorConfiguration {
                    id: "sma-2".into(),
                    kind: "sma".into(),
                    period: 2,
                }],
            )
            .unwrap();
        let w = s
            .save_drawings(
                "replay",
                w.document.revision,
                vec![
                    presentation::DrawingObject {
                        id: "past".into(),
                        kind: "horizontal-line".into(),
                        anchors: vec![presentation::DrawingAnchor {
                            time_ms: 60_000,
                            price_ticks: 10,
                        }],
                        color: "#7dd3fc".into(),
                        width: 1,
                        line_style: "solid".into(),
                        opacity: 0.9,
                        fill: None,
                        text: None,
                        levels: vec![],
                        locked: false,
                        hidden: false,
                        z_order: 0,
                    },
                    presentation::DrawingObject {
                        id: "future".into(),
                        kind: "horizontal-line".into(),
                        anchors: vec![presentation::DrawingAnchor {
                            time_ms: 180_000,
                            price_ticks: 100,
                        }],
                        color: "#7dd3fc".into(),
                        width: 1,
                        line_style: "solid".into(),
                        opacity: 0.9,
                        fill: None,
                        text: None,
                        levels: vec![],
                        locked: false,
                        hidden: false,
                        z_order: 1,
                    },
                ],
            )
            .unwrap();
        let w = s
            .save_replay(
                "replay",
                w.document.revision,
                Some(zt_domain::ReplayClock {
                    version: 1,
                    dataset: dataset_ref,
                    from_ms: 60_000,
                    available_through_ms: 180_000,
                    to_ms: 240_000,
                    speed: 1.0,
                    playing: false,
                }),
            )
            .unwrap();
        let scene = s
            .native_scene("replay", w.document.revision, None)
            .unwrap();
        assert_eq!(scene["bars"].as_array().unwrap().len(), 2);
        assert_eq!(scene["drawings"].as_array().unwrap().len(), 1);
        assert_eq!(scene["drawings"][0]["id"], "past");
        assert_eq!(scene["indicators"][0]["values"], json!([null, 11.0]));
    }
}
