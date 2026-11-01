//! Non-executable strategy drafts in the existing device-owned repository.
use super::*;
use serde_json::Value;
use zt_domain::StrategyRevisionV2;

pub const MAX_SOURCE_BYTES: usize = 256_000;
pub const MAX_PARAMETER_BYTES: usize = 16_384;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocalStrategy {
    pub document: StrategyRevisionV2,
    pub source: String,
    pub parameters: Value,
}

fn validate_input(source: &str, parameters: &Value) -> Result<Vec<u8>> {
    if source.trim().is_empty() || source.len() > MAX_SOURCE_BYTES || source.contains('\0') {
        return Err("Supply nonempty Python source up to 256,000 UTF-8 bytes, without NUL".into());
    }
    let object = parameters
        .as_object()
        .ok_or("Strategy parameters must be a JSON object")?;
    if object.iter().any(|(key, value)| {
        key.len() > 80 || !matches!(value, Value::String(_) | Value::Bool(_) | Value::Number(_))
    }) {
        return Err(
            "Parameter names must fit 80 bytes; values must be strings, booleans or numbers".into(),
        );
    }
    let bytes = serde_json::to_vec(parameters).map_err(err)?;
    if bytes.len() > MAX_PARAMETER_BYTES {
        return Err("Strategy parameters exceed 16,384 UTF-8 bytes".into());
    }
    Ok(bytes)
}

impl Store {
    pub(crate) fn validate_strategy(&self, strategy: &LocalStrategy) -> Result<()> {
        let parameters = validate_input(&strategy.source, &strategy.parameters)?;
        strategy.document.validate()?;
        if strategy.document.id != "primary-strategy"
            || strategy.document.sdk_version != "1.0.0"
            || self.artifact(&strategy.document.source)? != strategy.source.as_bytes()
            || self.artifact(&strategy.document.parameters)? != parameters
        {
            return Err("Strategy identity or artifact mismatch; source withheld".into());
        }
        Ok(())
    }

    /// Captures exact source bytes without compiling, importing or executing Python.
    /// Chart/data intent stays unchanged. Expected workspace revision prevents stale writes.
    pub fn save_strategy(
        &mut self,
        id: &str,
        revision: u64,
        source: String,
        parameters: Value,
    ) -> Result<Workspace> {
        let parameter_bytes = validate_input(&source, &parameters)?;
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; reopen before saving strategy".into());
        }
        if w.strategy
            .as_ref()
            .is_some_and(|s| s.source == source && s.parameters == parameters)
        {
            return Ok(w);
        }
        let strategy_revision = w.strategy.as_ref().map_or(Ok(1), |s| {
            s.document
                .revision
                .checked_add(1)
                .ok_or("Strategy revision exhausted")
        })?;
        w.strategy = Some(LocalStrategy {
            document: StrategyRevisionV2 {
                version: 2,
                id: "primary-strategy".into(),
                revision: strategy_revision,
                source: self.put_artifact(source.as_bytes())?,
                parameters: self.put_artifact(&parameter_bytes)?,
                // Target SDK contract, not a claim that an interpreter has run.
                sdk_version: "1.0.0".into(),
                created_at_ms: now_ms().try_into().map_err(err)?,
            },
            source,
            parameters,
        });
        w.document.revision = revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        self.commit(w, revision)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn draft_revisions_restore_preserve_chart_and_fail_closed() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        let original = store.create("research".into(), "Research".into()).unwrap();
        // Older workspace payloads have no strategy field and remain readable.
        assert!(!serde_json::to_value(&original)
            .unwrap()
            .as_object()
            .unwrap()
            .contains_key("strategy"));
        let source = "# TEST ONLY — exact source\r\nraise RuntimeError('must never execute')\r\n";
        let w = store
            .save_strategy("research", 1, source.into(), json!({"period": 20}))
            .unwrap();
        assert_eq!(w.document.revision, 2);
        assert_eq!(w.strategy.as_ref().unwrap().document.revision, 1);
        assert_eq!(
            serde_json::to_value(&w.chart).unwrap(),
            serde_json::to_value(&original.chart).unwrap()
        );
        assert!(store
            .save_strategy("research", 1, source.into(), json!({}))
            .is_err());
        assert_eq!(
            store
                .save_strategy("research", 2, source.into(), json!({"period":20}))
                .unwrap()
                .document
                .revision,
            2
        );
        for (bad_source, params) in [
            ("".into(), json!({})),
            ("x".repeat(MAX_SOURCE_BYTES + 1), json!({})),
            (source.into(), json!({"nested":[]})),
            (
                source.into(),
                json!({"large":"x".repeat(MAX_PARAMETER_BYTES)}),
            ),
        ] {
            assert!(store
                .save_strategy("research", 2, bad_source, params)
                .is_err());
        }
        store.conn.execute_batch("CREATE TRIGGER test_abort BEFORE UPDATE ON workspaces BEGIN SELECT RAISE(ABORT,'TEST ONLY interrupted strategy save'); END;").unwrap();
        assert!(store
            .save_strategy("research", 2, source.into(), json!({"period":21}))
            .is_err());
        store
            .conn
            .execute_batch("DROP TRIGGER test_abort;")
            .unwrap();
        drop(store);
        let mut store = Store::open(root.path()).unwrap();
        assert_eq!(
            serde_json::to_value(store.restore().unwrap().unwrap()).unwrap(),
            serde_json::to_value(&w).unwrap()
        );
        let next = store
            .save_strategy("research", 2, source.into(), json!({"period":21}))
            .unwrap();
        assert_eq!(next.strategy.as_ref().unwrap().document.revision, 2);
        let saved = store
            .save("research", 3, "Renamed".into(), None, None)
            .unwrap();
        assert_eq!(
            serde_json::to_value(&saved.strategy).unwrap(),
            serde_json::to_value(&next.strategy).unwrap()
        );
        // Previous exact source/parameter/document artifacts remain retained.
        store
            .artifact(&w.strategy.as_ref().unwrap().document.parameters)
            .unwrap();
        store
            .conn
            .execute(
                "UPDATE artifacts SET bytes=X'00' WHERE hash=?",
                [&next.strategy.unwrap().document.source.sha256],
            )
            .unwrap();
        assert!(store.restore().is_err());
    }
}
