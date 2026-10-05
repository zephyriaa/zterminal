//! Local execution foundation. No authenticated network transport is enabled.
//!
//! The paper engine consumes observed quotes explicitly. It does not label
//! fixture data live, execute Python, reveal credentials, or place real orders.
#![allow(missing_docs)]

mod journal;
mod model;
mod paper;

pub use journal::{IntentState, Journal, JournalIntent};
pub use model::*;
pub use paper::{PaperConfig, PaperEngine, PaperSnapshot};

/// Deliberately fixed, non-sensitive error categories; never echo raw payloads.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ExecutionError {
    #[error("execution storage unavailable or locked")]
    Storage,
    #[error("execution journal is corrupt or has an unsupported schema")]
    Schema,
    #[error("invalid execution input")]
    InvalidInput,
    #[error("order violates instrument filters")]
    Filter,
    #[error("order violates risk limits")]
    Risk,
    #[error("insufficient unreserved paper balance")]
    Balance,
    #[error("execution is paused or market data is stale")]
    NotReady,
    #[error("invalid journal transition or unresolved order")]
    Transition,
    #[error("live execution is not enabled in this build")]
    LiveDisabled,
    #[error("exact arithmetic overflow")]
    Arithmetic,
}

impl From<rusqlite::Error> for ExecutionError {
    fn from(_: rusqlite::Error) -> Self {
        Self::Storage
    }
}

pub type Result<T> = std::result::Result<T, ExecutionError>;
