//! Versioned local product contracts shared by services and native adapters.
//! Presentation records never own dataset, strategy, execution or archive state.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Bounded validation failure, suitable for a structured IPC error.
pub type ValidationResult = Result<(), String>;

/// Stable identifier: safe as a repository key, never an arbitrary path.
pub fn validate_id(id: &str) -> ValidationResult {
    if id.is_empty() || id.len() > 80 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_') {
        return Err("Invalid document identifier".into());
    }
    Ok(())
}

/// SHA-256 of exact stored bytes, not a claim about exchange authenticity.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArtifactReference {
    pub sha256: String,
    pub bytes: u64,
}
impl ArtifactReference {
    pub fn validate(&self) -> ValidationResult {
        if self.sha256.len() != 64 || !self.sha256.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)) || self.bytes == 0 {
            return Err("Invalid immutable artifact reference".into());
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DocumentReference { pub id: String, pub revision: u64, pub artifact: ArtifactReference }
impl DocumentReference {
    pub fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?;
        if self.revision == 0 { return Err("Document revision must be positive".into()); }
        self.artifact.validate()
    }
}

/// Shared domain records implement validation before persistence or execution.
pub trait ValidatedDocument { fn validate(&self) -> ValidationResult; }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceDocumentV2 {
    pub version: u16,
    pub id: String,
    pub revision: u64,
    pub name: String,
    pub documents: Vec<DocumentReference>,
    pub active_document: Option<String>,
    pub presentation: Option<ArtifactReference>,
}
impl ValidatedDocument for WorkspaceDocumentV2 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?;
        if self.version != 2 || self.revision == 0 || self.name.trim().is_empty() || self.name.len() > 256 || self.documents.len() > 256 { return Err("Invalid workspace header or document bounds".into()); }
        let mut ids = BTreeSet::new();
        for document in &self.documents { document.validate()?; if !ids.insert(&document.id) { return Err("Duplicate document in workspace".into()); } }
        if self.active_document.as_ref().is_some_and(|id| !ids.contains(id)) { return Err("Active document is not in workspace".into()); }
        if let Some(reference) = &self.presentation { reference.validate()?; }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Product { Spot, UsdtPerpetual }

/// Freshness is independent of coverage validity: cached history can be eligible.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Freshness { Live, Cached, Stale, Unavailable }

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstrumentDefinitionV1 {
    pub version: u16, pub id: String, pub provider: String, pub symbol: String,
    pub product: Product, pub settlement_currency: String,
    pub tick_size: f64, pub quantity_step: f64, pub multiplier: f64,
    pub status: String, pub observed_at_ms: i64, pub source: ArtifactReference,
}
impl ValidatedDocument for InstrumentDefinitionV1 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?; self.source.validate()?;
        if self.version != 1 || !["binance", "csv"].contains(&self.provider.as_str()) || self.symbol.is_empty() || self.symbol.len() > 80 || self.observed_at_ms <= 0 || self.status.is_empty() { return Err("Invalid instrument metadata".into()); }
        if ![self.tick_size,self.quantity_step,self.multiplier].iter().all(|x| x.is_finite() && *x > 0.0) { return Err("Invalid instrument precision or multiplier".into()); }
        if self.product == Product::UsdtPerpetual && self.settlement_currency != "USDT" { return Err("Only USDT-settled perpetual instruments are supported".into()); }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Coverage { pub from_ms: i64, pub to_ms: i64, pub interval_ms: u64, pub count: u64, pub gaps: Vec<(i64,i64)> }
impl Coverage {
    pub fn validate(&self) -> ValidationResult {
        if self.from_ms < 0 || self.from_ms >= self.to_ms || self.interval_ms == 0 || self.interval_ms > 86_400_000 || self.count == 0 || self.count > 10_000_000 { return Err("Invalid history coverage".into()); }
        let interval = self.interval_ms as i64;
        if self.from_ms % interval != 0 || self.to_ms % interval != 0 || self.count > ((self.to_ms-self.from_ms)/interval) as u64 { return Err("Coverage is not interval-aligned".into()); }
        let mut end = self.from_ms;
        for (start,stop) in &self.gaps {
            if *start < end || start >= stop || *stop > self.to_ms || start % interval != 0 || stop % interval != 0 { return Err("Invalid, overlapping or unordered gaps".into()); }
            end = *stop;
        }
        let missing: u64 = self.gaps.iter().map(|(a,b)| ((b-a)/interval) as u64).sum();
        if self.count + missing != ((self.to_ms-self.from_ms)/interval) as u64 { return Err("Coverage count disagrees with recorded gaps".into()); }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DatasetManifestV3 {
    pub version: u16, pub id: String, pub instrument: InstrumentDefinitionV1,
    pub bars: ArtifactReference, pub coverage: Coverage, pub freshness: Freshness,
    pub retrieved_at_ms: i64, pub original: ArtifactReference, pub timezone: String, pub units: String,
    pub mark_prices: Option<ArtifactReference>, pub mark_coverage: Option<Coverage>,
    pub funding_events: Option<ArtifactReference>, pub funding_from_ms: Option<i64>, pub funding_to_ms: Option<i64>,
}
impl ValidatedDocument for DatasetManifestV3 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?; self.instrument.validate()?; self.bars.validate()?; self.original.validate()?; self.coverage.validate()?;
        if self.version != 3 || self.retrieved_at_ms < self.coverage.to_ms || self.timezone.is_empty() || self.units.is_empty() { return Err("Invalid dataset provenance".into()); }
        if self.mark_prices.is_some() != self.mark_coverage.is_some() || self.funding_events.is_some() != (self.funding_from_ms.is_some() && self.funding_to_ms.is_some()) { return Err("Incomplete perpetual artifact metadata".into()); }
        if let Some(mark) = &self.mark_prices { mark.validate()?; }
        if let Some(mark) = &self.mark_coverage { mark.validate()?; }
        if let Some(funding) = &self.funding_events { funding.validate()?; if self.funding_from_ms >= self.funding_to_ms { return Err("Invalid funding coverage".into()); } }
        Ok(())
    }
}
impl DatasetManifestV3 {
    pub fn validate_research_coverage(&self) -> ValidationResult {
        self.validate()?;
        if !self.coverage.gaps.is_empty() { return Err("Trading history has gaps".into()); }
        if self.instrument.product == Product::UsdtPerpetual {
            let mark = self.mark_coverage.as_ref().ok_or("Mark-price history is required")?;
            if !mark.gaps.is_empty() || mark.from_ms > self.coverage.from_ms || mark.to_ms < self.coverage.to_ms || mark.interval_ms != self.coverage.interval_ms { return Err("Mark-price coverage does not cover the run".into()); }
            if self.funding_events.is_none() || self.funding_from_ms.is_none_or(|x| x > self.coverage.from_ms) || self.funding_to_ms.is_none_or(|x| x < self.coverage.to_ms) { return Err("Funding coverage does not cover the run".into()); }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ChartDocumentV3 {
    pub version: u16, pub id: String, pub revision: u64,
    pub dataset: Option<DocumentReference>, pub interval_ms: u64,
    pub visible_from_ms: Option<i64>, pub visible_to_ms: Option<i64>,
    pub indicators: Vec<IndicatorConfiguration>, pub drawings: Option<ArtifactReference>, pub replay: Option<ReplayClock>,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IndicatorConfiguration { pub id: String, pub kind: String, pub period: u32 }
impl ValidatedDocument for ChartDocumentV3 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?;
        if self.version != 3 || self.revision == 0 || self.interval_ms == 0 || self.indicators.len() > 32 || self.visible_from_ms.is_some() != self.visible_to_ms.is_some() || self.visible_from_ms.zip(self.visible_to_ms).is_some_and(|(a,b)|a>=b) { return Err("Invalid chart document".into()); }
        if let Some(dataset) = &self.dataset { dataset.validate()?; }
        if let Some(drawings) = &self.drawings { drawings.validate()?; }
        let mut ids = BTreeSet::new();
        for indicator in &self.indicators { validate_id(&indicator.id)?; if !ids.insert(&indicator.id) || !["ema","sma","rsi"].contains(&indicator.kind.as_str()) || !(2..=10000).contains(&indicator.period) { return Err("Invalid indicator".into()); } }
        if let Some(replay) = &self.replay { replay.validate()?; }
        Ok(())
    }
}

/// No chart or strategy may expose data after available-through while replaying.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReplayClock {
    pub version: u16, pub dataset: DocumentReference, pub available_through_ms: i64,
    pub from_ms: i64, pub to_ms: i64, pub speed: f64, pub playing: bool,
}
impl ValidatedDocument for ReplayClock {
    fn validate(&self) -> ValidationResult {
        self.dataset.validate()?;
        if self.version != 1 || self.from_ms > self.available_through_ms || self.available_through_ms >= self.to_ms || !self.speed.is_finite() || !(0.25..=64.0).contains(&self.speed) { return Err("Invalid replay boundary or speed".into()); }
        Ok(())
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StrategyRevisionV2 {
    pub version: u16, pub id: String, pub revision: u64, pub source: ArtifactReference,
    pub parameters: ArtifactReference, pub sdk_version: String, pub created_at_ms: i64,
}
impl ValidatedDocument for StrategyRevisionV2 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?; self.source.validate()?; self.parameters.validate()?;
        if self.version != 2 || self.revision == 0 || self.source.bytes > 256000 || self.parameters.bytes > 16384 || self.sdk_version.is_empty() || self.created_at_ms <= 0 { return Err("Invalid strategy revision".into()); }
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunState { Queued, Running, Cancelled, Failed, Interrupted, Completed }
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExperimentRunV2 {
    pub version: u16, pub id: String, pub strategy: DocumentReference, pub dataset: DocumentReference,
    pub configuration: ArtifactReference, pub runtime: ArtifactReference, pub engine_identity: String,
    pub state: RunState, pub result: Option<ArtifactReference>, pub diagnostics: Option<ArtifactReference>,
}
impl ValidatedDocument for ExperimentRunV2 {
    fn validate(&self) -> ValidationResult {
        validate_id(&self.id)?; self.strategy.validate()?; self.dataset.validate()?; self.configuration.validate()?; self.runtime.validate()?;
        if self.version != 2 || self.engine_identity.is_empty() || (self.state == RunState::Completed) != self.result.is_some() { return Err("Only completed runs may publish results".into()); }
        if let Some(result) = &self.result { result.validate()?; }
        if let Some(diagnostics) = &self.diagnostics { diagnostics.validate()?; }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn artifact() -> ArtifactReference { ArtifactReference { sha256: "a".repeat(64), bytes: 10 } }
    fn reference() -> DocumentReference { DocumentReference { id: "chart-1".into(), revision: 1, artifact: artifact() } }
    #[test]
    fn workspace_rejects_dangling_active_and_duplicate_documents() {
        let mut w = WorkspaceDocumentV2 {version:2,id:"workspace-1".into(),revision:1,name:"Research".into(),documents:vec![reference()],active_document:Some("chart-1".into()),presentation:None};
        assert!(w.validate().is_ok()); w.active_document=Some("missing".into()); assert!(w.validate().is_err()); w.active_document=None; w.documents.push(reference()); assert!(w.validate().is_err());
    }
    #[test]
    fn failed_runs_cannot_publish_results() {
        let mut run = ExperimentRunV2 {version:2,id:"run-1".into(),strategy:reference(),dataset:reference(),configuration:artifact(),runtime:artifact(),engine_identity:"legacy-1.1.0".into(),state:RunState::Failed,result:Some(artifact()),diagnostics:None};
        assert!(run.validate().is_err()); run.result=None; assert!(run.validate().is_ok()); run.state=RunState::Completed; assert!(run.validate().is_err()); run.result=Some(artifact()); assert!(run.validate().is_ok());
    }
    #[test]
    fn coverage_must_account_for_every_interval() {
        let mut c=Coverage {from_ms:0,to_ms:240000,interval_ms:60000,count:3,gaps:vec![(60000,120000)]};
        assert!(c.validate().is_ok()); c.gaps.clear(); assert!(c.validate().is_err()); c.count=4; assert!(c.validate().is_ok());
    }
    #[test]
    fn replay_rejects_future_visibility() {
        let mut c=ReplayClock {version:1,dataset:reference(),from_ms:0,to_ms:120000,available_through_ms:60000,speed:1.0,playing:false};
        assert!(c.validate().is_ok()); c.available_through_ms=120000; assert!(c.validate().is_err());
    }
    #[test]
    fn identifiers_cannot_escape_repository() { for id in ["../x","a/b","C:\\x",".",""] {assert!(validate_id(id).is_err());} }
}
