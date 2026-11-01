//! First-open completion belongs to the existing local repository, not identity.
use super::*;

impl Store {
    pub fn onboarding_complete(&self) -> Result<bool> {
        let value: Option<String> = self
            .conn
            .query_row("SELECT value FROM state WHERE key='onboarding'", [], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        match value {
            None => Ok(false),
            Some(value) => {
                let parsed: serde_json::Value = serde_json::from_str(&value).map_err(|_| "First-open preferences are unreadable; continue offline to recover them without removing workspaces".to_string())?;
                if parsed != serde_json::json!({"version":1,"completed":true}) {
                    return Err("Unsupported first-open preferences; continue offline to preserve and recover them".into());
                }
                Ok(true)
            }
        }
    }

    pub fn complete_onboarding(&mut self) -> Result<()> {
        let tx = self.conn.transaction().map_err(err)?;
        let previous: Option<String> = tx
            .query_row("SELECT value FROM state WHERE key='onboarding'", [], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        if let Some(previous) = previous {
            // Explicit offline/account completion can recover corrupt preferences,
            // retaining their exact bytes and leaving every workspace untouched.
            let key = format!("onboarding-recovery:{}", hash(previous.as_bytes()));
            tx.execute(
                "INSERT OR IGNORE INTO state(key,value) VALUES(?,?)",
                params![key, previous],
            )
            .map_err(err)?;
        }
        tx.execute("INSERT INTO state(key,value) VALUES('onboarding',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [r#"{"version":1,"completed":true}"#]).map_err(err)?;
        tx.commit().map_err(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn completion_survives_process_repository_restart_without_changing_work() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        assert!(!store.onboarding_complete().unwrap());
        let workspace = store
            .create("retained".into(), "Saved work".into())
            .unwrap();
        store.complete_onboarding().unwrap();
        drop(store);
        let store = Store::open(root.path()).unwrap();
        assert!(store.onboarding_complete().unwrap());
        assert_eq!(
            serde_json::to_value(store.load("retained").unwrap()).unwrap(),
            serde_json::to_value(workspace).unwrap()
        );
        let other = tempfile::tempdir().unwrap();
        assert!(!Store::open(other.path())
            .unwrap()
            .onboarding_complete()
            .unwrap());
    }
    #[test]
    fn corrupt_preferences_are_retained_on_explicit_recovery() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(root.path()).unwrap();
        store
            .conn
            .execute("INSERT INTO state VALUES('onboarding','{broken')", [])
            .unwrap();
        assert!(store.onboarding_complete().is_err());
        store.complete_onboarding().unwrap();
        assert!(store.onboarding_complete().unwrap());
        let retained: String = store
            .conn
            .query_row(
                "SELECT value FROM state WHERE key LIKE 'onboarding-recovery:%'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(retained, "{broken");
    }
}
