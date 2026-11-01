//! Local Home records. Deletion is reversible; shared artifacts are retained.
use super::*;
use serde_json::{json, Value};

fn name(value: &str) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 256 || value.contains('\0') {
        return Err("Supply a name of 1–256 UTF-8 bytes without NUL".into());
    }
    Ok(value.into())
}

impl Store {
    pub fn catalog_preview(&self, kind: &str, id: &str, revision: u64) -> Result<Value> {
        if kind == "workspace" {
            let w = self.load(id)?;
            if w.document.revision != revision {
                return Err("Stale preview revision".into());
            }
            return if let Some(d) = w.dataset {
                Ok(
                    json!({"kind":"chart","symbol":d.symbol,"bars":self.scene(id,d.count.saturating_sub(128),d.count.min(128))?}),
                )
            } else {
                Ok(json!({"kind":"empty","text":"No saved dataset"}))
            };
        }
        let v = self.study(id)?;
        if v["revision"].as_u64() != Some(revision) {
            return Err("Stale preview revision".into());
        }
        let source = v["source"].as_str().ok_or("Missing source")?;
        Ok(
            json!({"kind":"source","text":source.lines().take(5).collect::<Vec<_>>().join("\n").chars().take(360).collect::<String>()}),
        )
    }
    pub fn open_tabs(&self) -> Result<Vec<String>> {
        let value: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM state WHERE key='open-tabs-v1'",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(err)?;
        let ids: Vec<String> = value
            .map(|s| serde_json::from_str(&s).map_err(err))
            .transpose()?
            .unwrap_or_default();
        if ids.len() > 16 || ids.iter().any(|id| zt_domain::validate_id(id).is_err()) {
            return Err("Saved tab state is invalid; retained for recovery".into());
        }
        Ok(ids
            .into_iter()
            .filter(|id| {
                self.conn
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?)",
                        [id],
                        |r| r.get::<_, bool>(0),
                    )
                    .unwrap_or(false)
            })
            .collect())
    }
    pub fn set_tab(&self, id: &str, open: bool) -> Result<()> {
        let tx = self.conn.unchecked_transaction().map_err(err)?;
        let mut ids = self.open_tabs()?;
        if open {
            self.load(id)?;
            if !ids.iter().any(|s| s == id) {
                if ids.len() == 16 {
                    return Err("Close a workspace tab before opening another (16 maximum)".into());
                }
                ids.push(id.into());
            }
        } else {
            ids.retain(|s| s != id);
        }
        tx.execute("INSERT INTO state VALUES('open-tabs-v1',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serde_json::to_string(&ids).map_err(err)?]).map_err(err)?;
        tx.commit().map_err(err)?;
        Ok(())
    }
    pub fn navigation(&self) -> Result<Value> {
        let tabs = self.open_tabs()?;
        let mut records = Vec::new();
        for id in &tabs {
            records.push(
                self.conn
                    .query_row("SELECT id,name FROM workspaces WHERE id=?", [id], |r| {
                        Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?}))
                    })
                    .map_err(err)?,
            );
        }
        Ok(json!({"tabs":tabs,"workspaces":records}))
    }
    pub fn trash(&self) -> Result<Value> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id,kind,payload FROM catalog_trash ORDER BY deleted_at_ms DESC LIMIT 100",
            )
            .map_err(err)?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Vec<u8>>(2)?,
                ))
            })
            .map_err(err)?;
        let mut records = Vec::new();
        for row in rows {
            let (key, kind, bytes) = row.map_err(err)?;
            let value: Value = serde_json::from_slice(&bytes).map_err(err)?;
            let title = if kind == "workspace" {
                &value["document"]["name"]
            } else {
                &value["name"]
            };
            records.push(json!({"key":key,"kind":kind,"name":title}));
        }
        Ok(json!(records))
    }
    pub fn restore_catalog(&mut self, key: &str) -> Result<Value> {
        let (kind, bytes): (String, Vec<u8>) = self
            .conn
            .query_row(
                "SELECT kind,payload FROM catalog_trash WHERE id=?",
                [key],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .map_err(err)?;
        if kind == "workspace" {
            return Ok(json!(self.restore_workspace(
                key.strip_prefix("workspace:")
                    .ok_or("Invalid recovery key")?
            )?));
        }
        let v: Value = serde_json::from_slice(&bytes).map_err(err)?;
        let text = |field: &str| v[field].as_str().ok_or("Invalid recovered study");
        let id = text("id")?;
        zt_domain::validate_id(id)?;
        let title = name(text("name")?)?;
        let study_kind = text("kind")?;
        let source = text("source")?;
        if key != format!("study:{id}")
            || !matches!(study_kind, "indicator" | "strategy")
            || source.trim().is_empty()
            || source.len() > strategy::MAX_SOURCE_BYTES
            || source.contains('\0')
        {
            return Err("Invalid recovered study".into());
        }
        let revision = v["revision"]
            .as_u64()
            .ok_or("Missing recovered revision")?
            .checked_add(1)
            .ok_or("Study revision exhausted")?;
        let reference = self.put_artifact(source.as_bytes())?;
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        tx.execute(
            "INSERT INTO studies VALUES(?,?,?,?,?,?,?)",
            params![
                id,
                title,
                study_kind,
                revision,
                reference.sha256,
                reference.bytes,
                now_ms()
            ],
        )
        .map_err(err)?;
        tx.execute("DELETE FROM catalog_trash WHERE id=?", [key])
            .map_err(err)?;
        tx.commit().map_err(err)?;
        self.study(id)
    }
    pub fn study_action(
        &mut self,
        action: &str,
        id: &str,
        revision: u64,
        new_id: &str,
        title: &str,
    ) -> Result<Value> {
        let v = self.study(id)?;
        if v["revision"].as_u64() != Some(revision) {
            return Err("Study changed; refresh before editing".into());
        }
        match action {
            "rename" => self.save_study(
                id,
                revision,
                title,
                v["kind"].as_str().unwrap(),
                v["source"].as_str().unwrap(),
            ),
            "duplicate" => {
                if id == new_id {
                    return Err("Duplicate needs a new identity".into());
                }
                self.save_study(
                    new_id,
                    0,
                    title,
                    v["kind"].as_str().unwrap(),
                    v["source"].as_str().unwrap(),
                )
            }
            "delete" => {
                let tx = self
                    .conn
                    .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                    .map_err(err)?;
                tx.execute("INSERT INTO catalog_trash VALUES(?,'study',?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,deleted_at_ms=excluded.deleted_at_ms",params![format!("study:{id}"),serde_json::to_vec(&v).map_err(err)?,now_ms()]).map_err(err)?;
                if tx
                    .execute(
                        "DELETE FROM studies WHERE id=? AND revision=?",
                        params![id, revision],
                    )
                    .map_err(err)?
                    != 1
                {
                    return Err("Study changed; deletion cancelled".into());
                }
                tx.commit().map_err(err)?;
                Ok(Value::Null)
            }
            _ => Err("Unknown study action".into()),
        }
    }
    /// SQL paging bounds both returned records and UI controls, including large libraries.
    pub fn catalog(&self, kind: &str, search: &str, recent: bool, page: u64) -> Result<Value> {
        if search.len() > 256 || page > 1_000_000 || !matches!(kind, "workspace" | "study") {
            return Err("Invalid catalog query".into());
        }
        let source = if kind == "workspace" {
            "SELECT w.id,w.name,'workspace' AS kind,w.revision,m.updated_at_ms,CAST(o.value AS INTEGER) AS opened_at_ms,w.name||' '||CASE WHEN json_valid(CAST(w.payload AS TEXT)) THEN coalesce(json_extract(CAST(w.payload AS TEXT),'$.dataset.symbol'),'') ELSE '' END AS search_text FROM workspaces w LEFT JOIN workspace_metadata m ON m.id=w.id LEFT JOIN state o ON o.key='opened:'||w.id"
        } else {
            "SELECT id,name,kind,revision,updated_at_ms,NULL AS opened_at_ms,name||' '||kind AS search_text FROM studies"
        };
        let order = if recent {
            "max(coalesce(updated_at_ms,0),coalesce(opened_at_ms,0)) DESC,name COLLATE zt_name,id"
        } else {
            "name COLLATE zt_name,id"
        };
        let filter = " WHERE instr(zt_lower(search_text),zt_lower(?1))>0";
        let count: u64 = self
            .conn
            .query_row(
                &format!("SELECT count(*) FROM ({source}){filter}"),
                [search],
                |r| r.get(0),
            )
            .map_err(err)?;
        let mut stmt = self
            .conn
            .prepare(&format!(
                "SELECT * FROM ({source}){filter} ORDER BY {order} LIMIT 24 OFFSET ?2"
            ))
            .map_err(err)?;
        let items = stmt.query_map(params![search,page*24], |r| Ok(json!({
            "id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"kind":r.get::<_,String>(2)?,
            "revision":r.get::<_,u64>(3)?,"updatedAtMs":r.get::<_,Option<u64>>(4)?,"lastOpenedAtMs":r.get::<_,Option<u64>>(5)?,"storage":"Local"
        }))).map_err(err)?.collect::<std::result::Result<Vec<_>,_>>().map_err(err)?;
        Ok(json!({"items":items,"total":count,"page":page,"pageSize":24}))
    }

    pub fn workspace_action(
        &mut self,
        action: &str,
        id: &str,
        revision: u64,
        new_id: &str,
        new_name: &str,
    ) -> Result<Value> {
        let mut w = self.load(id)?;
        if w.document.revision != revision {
            return Err("Workspace changed; refresh Home before editing".into());
        }
        match action {
            "rename" => {
                w.document.name = name(new_name)?;
                w.document.revision += 1;
                Ok(json!(self.commit(w, revision)?))
            }
            "duplicate" => {
                zt_domain::validate_id(new_id)?;
                if id == new_id {
                    return Err("Duplicate needs a new identity".into());
                }
                w.document.id = new_id.into();
                w.document.name = name(new_name)?;
                w.document.revision = 1;
                Ok(json!(self.commit(w, 0)?))
            }
            "delete" => {
                let tx = self
                    .conn
                    .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                    .map_err(err)?;
                let bytes = serde_json::to_vec(&w).map_err(err)?;
                tx.execute("INSERT INTO catalog_trash VALUES(?,'workspace',?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,deleted_at_ms=excluded.deleted_at_ms",params![format!("workspace:{id}"),bytes,now_ms()]).map_err(err)?;
                if tx
                    .execute(
                        "DELETE FROM workspaces WHERE id=? AND revision=?",
                        params![id, revision],
                    )
                    .map_err(err)?
                    != 1
                {
                    return Err("Workspace changed; deletion cancelled".into());
                }
                tx.execute("DELETE FROM workspace_metadata WHERE id=?", [id])
                    .map_err(err)?;
                tx.execute("DELETE FROM state WHERE key='last' AND value=?", [id])
                    .map_err(err)?;
                tx.commit().map_err(err)?;
                Ok(Value::Null)
            }
            _ => Err("Unknown workspace action".into()),
        }
    }

    pub fn restore_workspace(&mut self, id: &str) -> Result<Workspace> {
        let key = format!("workspace:{id}");
        let bytes: Vec<u8> = self
            .conn
            .query_row(
                "SELECT payload FROM catalog_trash WHERE id=? AND kind='workspace'",
                [&key],
                |r| r.get(0),
            )
            .map_err(err)?;
        let mut w: Workspace = serde_json::from_slice(&bytes).map_err(err)?;
        if w.document.id != id {
            return Err("Recovery identity mismatch".into());
        }
        w.document.revision = w
            .document
            .revision
            .checked_add(1)
            .ok_or("Workspace revision exhausted")?;
        let restored = self.commit(w, 0)?;
        self.conn
            .execute("DELETE FROM catalog_trash WHERE id=?", [key])
            .map_err(err)?;
        Ok(restored)
    }

    /// Exact non-executed Python source uses the existing content-addressed artifacts.
    pub fn save_study(
        &mut self,
        id: &str,
        revision: u64,
        title: &str,
        kind: &str,
        source: &str,
    ) -> Result<Value> {
        zt_domain::validate_id(id)?;
        let title = name(title)?;
        if !matches!(kind, "indicator" | "strategy")
            || source.trim().is_empty()
            || source.len() > strategy::MAX_SOURCE_BYTES
            || source.contains('\0')
        {
            return Err("Invalid study kind or source (maximum 256,000 UTF-8 bytes)".into());
        }
        let reference = self.put_artifact(source.as_bytes())?;
        let tx = self
            .conn
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(err)?;
        let actual: Option<u64> = tx
            .query_row("SELECT revision FROM studies WHERE id=?", [id], |r| {
                r.get(0)
            })
            .optional()
            .map_err(err)?;
        if actual.unwrap_or(0) != revision {
            return Err("Study changed; reopen before saving".into());
        }
        let next = revision.checked_add(1).ok_or("Study revision exhausted")?;
        tx.execute("INSERT INTO studies VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,revision=excluded.revision,source_hash=excluded.source_hash,source_bytes=excluded.source_bytes,updated_at_ms=excluded.updated_at_ms",params![id,title,kind,next,reference.sha256,reference.bytes,now_ms()]).map_err(err)?;
        tx.commit().map_err(err)?;
        self.study(id)
    }

    pub fn study(&self, id: &str) -> Result<Value> {
        let (title,kind,revision,sha256,bytes,updated):(String,String,u64,String,u64,u64)=self.conn.query_row("SELECT name,kind,revision,source_hash,source_bytes,updated_at_ms FROM studies WHERE id=?",[id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))).map_err(err)?;
        let source =
            String::from_utf8(self.artifact(&ArtifactReference { sha256, bytes })?).map_err(err)?;
        Ok(
            json!({"id":id,"name":title,"kind":kind,"revision":revision,"source":source,"updatedAtMs":updated}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn duplicate_and_rename_preserve_data_view_and_source_ownership() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("original".into(), "Original".into()).unwrap();
        s.import(
            "original",
            1,
            Import {
                csv: "t,o,h,l,c,v\n60000,1,2,1,2,10\n120000,2,3,2,3,20".into(),
                source_name: "TEST ONLY.csv".into(),
                symbol: "TEST".into(),
                interval_ms: 60000,
                tick_size: 1.0,
                quantity_step: 1.0,
            },
        )
        .unwrap();
        s.save_strategy(
            "original",
            2,
            "# exact saved source\r\npass\r\n".into(),
            json!({"period":2}),
        )
        .unwrap();
        let original = s
            .save("original", 3, "Original".into(), Some(60000), Some(120000))
            .unwrap();
        s.workspace_action("rename", "original", 4, "", "Renamed")
            .unwrap();
        s.workspace_action("duplicate", "original", 5, "copy", "Copy")
            .unwrap();
        let copy = s.load("copy").unwrap();
        assert_eq!(copy.chart.visible_from_ms, original.chart.visible_from_ms);
        assert_eq!(
            copy.dataset.unwrap().segment.sha256,
            original.dataset.unwrap().segment.sha256
        );
        assert_eq!(
            copy.strategy.unwrap().source,
            original.strategy.unwrap().source
        );
        assert_eq!(
            s.native_scene("copy", 1, None).unwrap()["workspaceId"],
            "copy"
        );
        s.save("copy", 1, "Copy edited".into(), Some(120000), Some(180000))
            .unwrap();
        assert_eq!(
            s.load("original").unwrap().chart.visible_from_ms,
            Some(60000)
        );
        assert_eq!(s.load("original").unwrap().document.revision, 5);
        assert_eq!(
            s.catalog("workspace", "test", false, 0).unwrap()["total"],
            2
        );
    }
    #[test]
    fn additive_upgrade_keeps_old_bytes_and_unknown_times() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        let original = s.create("old".into(), "Old workspace".into()).unwrap();
        let before: Vec<u8> = s
            .conn
            .query_row("SELECT payload FROM workspaces WHERE id='old'", [], |r| {
                r.get(0)
            })
            .unwrap();
        s.conn.execute_batch("DROP TABLE workspace_metadata;DROP TABLE studies;DROP TABLE catalog_trash;PRAGMA user_version=1;").unwrap();
        drop(s);
        let s = Store::open(root.path()).unwrap();
        assert_eq!(
            s.conn
                .query_row::<Vec<u8>, _, _>(
                    "SELECT payload FROM workspaces WHERE id='old'",
                    [],
                    |r| r.get(0)
                )
                .unwrap(),
            before
        );
        assert_eq!(s.load("old").unwrap().document.id, original.document.id);
        assert!(s.list().unwrap()[0].updated_at_ms.is_none());
    }
    #[test]
    fn catalog_paging_ownership_recovery_and_source_integrity() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        for i in 0..1000 {
            s.create(format!("w{i:04}"), format!("Workspace {i:04}"))
                .unwrap();
        }
        let page = s.catalog("workspace", "", false, 0).unwrap();
        assert_eq!(page["total"], 1000);
        assert_eq!(page["items"].as_array().unwrap().len(), 24);
        assert_eq!(
            s.catalog("workspace", "", false, 41).unwrap()["items"]
                .as_array()
                .unwrap()
                .len(),
            16
        );
        assert_eq!(
            s.catalog("workspace", "0099", false, 0).unwrap()["total"],
            1
        );
        assert!(s
            .workspace_action("rename", "w0099", 2, "", "Wrong")
            .is_err());
        s.workspace_action("rename", "w0099", 1, "", "Renamed")
            .unwrap();
        s.workspace_action("duplicate", "w0099", 2, "copy", "Copy")
            .unwrap();
        s.workspace_action("delete", "w0099", 2, "", "").unwrap();
        assert!(s.load("w0099").is_err());
        s.restore_workspace("w0099").unwrap();
        assert_eq!(s.load("w0099").unwrap().document.name, "Renamed");
        assert_eq!(s.load("w0099").unwrap().document.revision, 3);
        assert!(s
            .workspace_action("rename", "w0099", 2, "", "Stale editor")
            .is_err());
        assert_eq!(s.load("copy").unwrap().document.name, "Copy");
        let source = "# exact draft\r\nraise Exception('not executed')\r\n";
        s.save_study("study", 0, "Draft", "indicator", source)
            .unwrap();
        assert!(s
            .save_study("study", 0, "Stale", "indicator", "pass")
            .is_err());
        s.study_action("duplicate", "study", 1, "study-copy", "Copy")
            .unwrap();
        s.study_action("delete", "study-copy", 1, "", "").unwrap();
        assert!(s.study("study-copy").is_err());
        s.restore_catalog("study:study-copy").unwrap();
        assert_eq!(s.study("study-copy").unwrap()["source"], source);
        assert_eq!(s.study("study-copy").unwrap()["revision"], 2);
        assert!(s
            .save_study("study-copy", 1, "Stale editor", "indicator", "pass")
            .is_err());
        s.set_tab("copy", true).unwrap();
        s.set_tab("copy", true).unwrap();
        assert_eq!(s.open_tabs().unwrap(), vec!["copy"]);
        s.set_tab("w0001", true).unwrap();
        s.set_tab("copy", false).unwrap();
        assert_eq!(s.open_tabs().unwrap(), vec!["w0001"]);
        drop(s);
        let s = Store::open(root.path()).unwrap();
        assert_eq!(s.study("study").unwrap()["source"], source);
        s.conn.execute("UPDATE artifacts SET bytes=x'00' WHERE hash=(SELECT source_hash FROM studies WHERE id='study')",[]).unwrap();
        assert!(s.study("study").is_err());
    }
    #[test]
    fn unicode_search_and_open_activity_are_real_metadata() {
        let root = tempfile::tempdir().unwrap();
        let mut s = Store::open(root.path()).unwrap();
        s.create("unicode".into(), "ƏLÇÜ ÖLÇÜ".into()).unwrap();
        s.create("other".into(), "Other".into()).unwrap();
        assert_eq!(
            s.catalog("workspace", "əlçü ölçü", false, 0).unwrap()["total"],
            1
        );
        assert_eq!(
            s.catalog("workspace", "nothing matches", false, 0).unwrap()["total"],
            0
        );
        s.select("unicode").unwrap();
        let v = s.catalog("workspace", "əlçü", true, 0).unwrap();
        assert!(v["items"][0]["lastOpenedAtMs"].as_u64().unwrap() > 0);
        assert_eq!(s.load("unicode").unwrap().document.revision, 1);
    }
}
