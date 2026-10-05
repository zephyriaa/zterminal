use crate::model::identifier;
use crate::{ExecutionError, ExecutionMode, LimitOrder, Result};
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, TransactionBehavior};
use rust_decimal::Decimal;
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;
use uuid::Uuid;

const APPLICATION_ID: i64 = 0x5a544558;
const SCHEMA_VERSION: i64 = 1;
type IntentRow = (String, String, String, String, Option<String>, i64, i64);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IntentState {
    Prepared,
    Dispatching,
    Acknowledged,
    Rejected,
    Unknown,
    Quarantined,
    Filled,
    Cancelled,
}

impl IntentState {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "prepared" => Ok(Self::Prepared),
            "dispatching" => Ok(Self::Dispatching),
            "acknowledged" => Ok(Self::Acknowledged),
            "rejected" => Ok(Self::Rejected),
            "unknown" => Ok(Self::Unknown),
            "quarantined" => Ok(Self::Quarantined),
            "filled" => Ok(Self::Filled),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(ExecutionError::Schema),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JournalIntent {
    pub client_id: String,
    pub account_id: String,
    pub deployment_id: String,
    pub order: LimitOrder,
    pub state: IntentState,
    pub exchange_id: Option<String>,
    pub ready_ms: i64,
    pub expires_ms: i64,
}

/// Exclusive local owner. Full synchronous WAL commits precede dispatch claims.
/// Public methods accept normalized records only; raw/auth payloads have no column.
pub struct Journal {
    pub(crate) db: Connection,
}

impl Journal {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let db = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        db.busy_timeout(Duration::ZERO)?;
        let application_id: i64 = db.pragma_query_value(None, "application_id", |r| r.get(0))?;
        let version: i64 = db.pragma_query_value(None, "user_version", |r| r.get(0))?;
        let tables: i64 = db.query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='table'",
            [],
            |r| r.get(0),
        )?;
        if (application_id != APPLICATION_ID || version != SCHEMA_VERSION)
            && !(application_id == 0 && version == 0 && tables == 0)
        {
            return Err(ExecutionError::Schema);
        }
        let is_new = application_id == 0 && version == 0 && tables == 0;
        if !is_new {
            // Never silently recreate deleted tables in an established ledger.
            let expected: i64 = db.query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table'
                AND name IN ('intents','paper_balance','paper_fills','connections')",
                [],
                |r| r.get(0),
            )?;
            if expected != 4 || tables != 4 {
                return Err(ExecutionError::Schema);
            }
        }
        db.execute_batch("PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            PRAGMA foreign_keys=ON; PRAGMA trusted_schema=OFF; PRAGMA secure_delete=ON; BEGIN EXCLUSIVE;")?;
        if is_new {
            db.execute_batch("
            CREATE TABLE IF NOT EXISTS intents (
                client_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, deployment_id TEXT NOT NULL,
                order_json TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN
                ('prepared','dispatching','acknowledged','rejected','unknown','quarantined','filled','cancelled')),
                exchange_id TEXT, ready_ms INTEGER NOT NULL, expires_ms INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS paper_balance (id INTEGER PRIMARY KEY CHECK(id=1), config_json TEXT NOT NULL,
                cash TEXT NOT NULL, quantity TEXT NOT NULL, fees TEXT NOT NULL, last_sequence TEXT NOT NULL, last_received_ms INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS paper_fills (client_id TEXT NOT NULL REFERENCES intents(client_id),
                sequence TEXT NOT NULL, quantity TEXT NOT NULL, price TEXT NOT NULL, fee TEXT NOT NULL,
                PRIMARY KEY(client_id, sequence));
            CREATE TABLE IF NOT EXISTS connections (connection_id TEXT PRIMARY KEY, credential_ref TEXT NOT NULL);
            PRAGMA application_id=1515472216; PRAGMA user_version=1;")?;
        }
        db.execute_batch("COMMIT;")?;
        for sql in [
            "SELECT client_id,account_id,deployment_id,order_json,state,exchange_id,ready_ms,expires_ms FROM intents LIMIT 0",
            "SELECT id,config_json,cash,quantity,fees,last_sequence,last_received_ms FROM paper_balance LIMIT 0",
            "SELECT client_id,sequence,quantity,price,fee FROM paper_fills LIMIT 0",
            "SELECT connection_id,credential_ref FROM connections LIMIT 0",
        ] { db.prepare(sql).map_err(|_| ExecutionError::Schema)?; }
        // Values are read back: unknown/ignored PRAGMA or a corrupt ledger cannot proceed.
        let actual: i64 = db.pragma_query_value(None, "application_id", |r| r.get(0))?;
        let sync: i64 = db.pragma_query_value(None, "synchronous", |r| r.get(0))?;
        let check: String = db.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        if actual != APPLICATION_ID || sync != 2 || check != "ok" {
            return Err(ExecutionError::Schema);
        }
        Ok(Self { db })
    }

    /// Opaque local vault reference only. No key/secret parameter exists.
    pub fn set_credential_reference(&mut self, connection: &str, reference: &str) -> Result<()> {
        if !identifier(connection)
            || reference.len() != 32
            || !reference.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err(ExecutionError::InvalidInput);
        }
        self.db.execute(
            "INSERT INTO connections VALUES (?1,?2) ON CONFLICT(connection_id)
            DO UPDATE SET credential_ref=excluded.credential_ref",
            params![connection, reference],
        )?;
        Ok(())
    }

    pub fn remove_credential_reference(&mut self, connection: &str) -> Result<()> {
        if !identifier(connection) {
            return Err(ExecutionError::InvalidInput);
        }
        self.db.execute(
            "DELETE FROM connections WHERE connection_id=?1",
            [connection],
        )?;
        Ok(())
    }

    /// The returned ID exists durably before any caller can claim it for dispatch.
    pub fn prepare(
        &mut self,
        account: &str,
        deployment: &str,
        mode: ExecutionMode,
        order: &LimitOrder,
        ready_ms: i64,
        expires_ms: i64,
    ) -> Result<String> {
        mode.require_enabled()?;
        if !identifier(account)
            || !identifier(deployment)
            || !identifier(&order.symbol)
            || order.price <= Decimal::ZERO
            || order.quantity <= Decimal::ZERO
            || ready_ms < 0
            || expires_ms <= ready_ms
        {
            return Err(ExecutionError::InvalidInput);
        }
        let id = format!("zt{}", Uuid::new_v4().simple());
        let json = serde_json::to_string(order).map_err(|_| ExecutionError::InvalidInput)?;
        let tx = self
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        tx.execute(
            "INSERT INTO intents VALUES (?1,?2,?3,?4,'prepared',NULL,?5,?6)",
            params![id, account, deployment, json, ready_ms, expires_ms],
        )?;
        tx.commit()?;
        Ok(id)
    }

    /// A send claim can be acquired once; uncertain attempts can never be reclaimed.
    pub fn claim_dispatch(&mut self, id: &str) -> Result<()> {
        let changed = self.db.execute(
            "UPDATE intents SET state='dispatching' WHERE client_id=?1 AND state='prepared'",
            [id],
        )?;
        if changed != 1 {
            return Err(ExecutionError::Transition);
        }
        Ok(())
    }

    pub fn record_acknowledgement(&mut self, id: &str, exchange_id: &str) -> Result<()> {
        if !identifier(exchange_id) {
            return Err(ExecutionError::InvalidInput);
        }
        let existing = self.intent(id)?;
        if existing.state == IntentState::Acknowledged
            && existing.exchange_id.as_deref() == Some(exchange_id)
        {
            return Ok(());
        }
        let changed = self.db.execute(
            "UPDATE intents SET state='acknowledged',exchange_id=?2
            WHERE client_id=?1 AND state IN ('dispatching','unknown','quarantined')",
            params![id, exchange_id],
        )?;
        if changed != 1 {
            return Err(ExecutionError::Transition);
        }
        Ok(())
    }

    pub fn record_unknown(&mut self, id: &str) -> Result<()> {
        let changed = self.db.execute(
            "UPDATE intents SET state='unknown' WHERE client_id=?1 AND state='dispatching'",
            [id],
        )?;
        if changed != 1 {
            return Err(ExecutionError::Transition);
        }
        Ok(())
    }

    /// Startup recovery quarantines uncertain transmissions. Never requeue them.
    pub fn quarantine_uncertain(&mut self) -> Result<usize> {
        Ok(self.db.execute(
            "UPDATE intents SET state='quarantined' WHERE state IN ('dispatching','unknown')",
            [],
        )?)
    }

    pub fn intent(&self, id: &str) -> Result<JournalIntent> {
        let row: Option<IntentRow> = self.db.query_row(
            "SELECT account_id,deployment_id,order_json,state,exchange_id,ready_ms,expires_ms FROM intents WHERE client_id=?1",
            [id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?))).optional()?;
        let (account_id, deployment_id, json, state, exchange_id, ready_ms, expires_ms) =
            row.ok_or(ExecutionError::Transition)?;
        Ok(JournalIntent {
            client_id: id.into(),
            account_id,
            deployment_id,
            order: serde_json::from_str(&json).map_err(|_| ExecutionError::Schema)?,
            state: IntentState::parse(&state)?,
            exchange_id,
            ready_ms,
            expires_ms,
        })
    }

    pub(crate) fn active(&self) -> Result<Vec<JournalIntent>> {
        let mut query = self.db.prepare(
            "SELECT client_id FROM intents WHERE state IN
            ('prepared','dispatching','acknowledged','unknown','quarantined') ORDER BY rowid",
        )?;
        let ids = query
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        ids.iter().map(|id| self.intent(id)).collect()
    }

    pub(crate) fn decimal(value: &str) -> Result<Decimal> {
        Decimal::from_str(value).map_err(|_| ExecutionError::Schema)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Side;
    use rust_decimal_macros::dec;

    #[test]
    fn failed_commit_never_returns_dispatchable_intent_or_echoes_error_payload() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut journal = Journal::open(dir.path().join("execution.sqlite3")).unwrap();
        journal
            .db
            .execute_batch(
                "CREATE TRIGGER reject_intents BEFORE INSERT ON intents
            BEGIN SELECT RAISE(ABORT,'SECRET_SENTINEL'); END;",
            )
            .unwrap();
        let order = LimitOrder {
            symbol: "BTCUSDT".into(),
            side: Side::Buy,
            quantity: dec!(1),
            price: dec!(100),
        };
        let result = journal.prepare(
            "account",
            "deployment",
            ExecutionMode::Paper,
            &order,
            0,
            100,
        );
        assert_eq!(result, Err(ExecutionError::Storage));
        assert!(!result.unwrap_err().to_string().contains("SENTINEL"));
        let count: i64 = journal
            .db
            .query_row("SELECT count(*) FROM intents", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
