//! Internal opt-in finite public Binance ingestion command.
//!
//! This executable opens a direct public connection only after a complete explicit
//! request. It performs no reconnect, fallback, cloud synchronization, credential
//! use, account access, broker execution, scheduler, or background processing.

use std::collections::BTreeMap;
use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

use zt_adapters::live_public::{
    ingest_binance_aggregate_trade_probe_locally, BoundedLocalIngestionRequest,
    LocalIngestionError, LocalIngestionFlushOutcome, MAXIMUM_PUBLIC_INGESTION_EVENTS,
};
use zt_adapters::{PublicProvider, PublicTradeSubscription};
use zt_storage::SegmentStore;

#[derive(Clone, Debug, Eq, PartialEq)]
struct Request {
    root: PathBuf,
    provider_symbol: String,
    symbol_id: u32,
    price_scale: i64,
    quantity_scale: i64,
    stream_id: u32,
    interval_ns: u64,
    maximum_bars: usize,
    maximum_events: usize,
    captured_at_ns: u64,
    access_time: u64,
    flush: bool,
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let result = match parse_request(env::args().skip(1).collect()) {
        Ok(request) => run_request(request).await,
        Err(error) => Err(error),
    };
    match result {
        Ok((request, result)) => {
            print_result(&request, result);
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("internal direct public ingestion failed: {error}");
            ExitCode::from(2)
        }
    }
}

fn parse_request(arguments: Vec<String>) -> Result<Request, String> {
    let mut values = BTreeMap::new();
    let mut flush = false;
    for argument in arguments {
        if argument == "--flush" {
            if flush {
                return Err("duplicate --flush flag".to_owned());
            }
            flush = true;
            continue;
        }
        let Some((name, value)) = argument.split_once('=') else {
            return Err(format!("unsupported argument: {argument}"));
        };
        if !name.starts_with("--")
            || value.is_empty()
            || values.insert(name.to_owned(), value.to_owned()).is_some()
        {
            return Err(format!("duplicate or invalid argument: {argument}"));
        }
    }
    let provider = required(&mut values, "--provider")?;
    if provider != "binance-spot-aggtrade" {
        return Err("only --provider=binance-spot-aggtrade is supported".to_owned());
    }
    let request = Request {
        root: PathBuf::from(required(&mut values, "--root")?),
        provider_symbol: required(&mut values, "--provider-symbol")?,
        symbol_id: parse_number(&mut values, "--symbol-id")?,
        price_scale: parse_number(&mut values, "--price-scale")?,
        quantity_scale: parse_number(&mut values, "--quantity-scale")?,
        stream_id: parse_number(&mut values, "--stream-id")?,
        interval_ns: parse_number(&mut values, "--interval-ns")?,
        maximum_bars: parse_number(&mut values, "--maximum-bars")?,
        maximum_events: parse_number(&mut values, "--maximum-events")?,
        captured_at_ns: parse_number(&mut values, "--captured-at-ns")?,
        access_time: parse_number(&mut values, "--access-time")?,
        flush,
    };
    if !values.is_empty() {
        return Err(format!(
            "unsupported argument: {}",
            values.keys().next().expect("non-empty map")
        ));
    }
    if request.provider_symbol.is_empty()
        || request.interval_ns == 0
        || request.maximum_bars == 0
        || request.maximum_events == 0
        || request.maximum_events > MAXIMUM_PUBLIC_INGESTION_EVENTS
    {
        return Err("direct ingestion bounds are invalid".to_owned());
    }
    Ok(request)
}

fn required(values: &mut BTreeMap<String, String>, name: &str) -> Result<String, String> {
    values
        .remove(name)
        .ok_or_else(|| format!("missing required argument: {name}"))
}

fn parse_number<T>(values: &mut BTreeMap<String, String>, name: &str) -> Result<T, String>
where
    T: std::str::FromStr,
{
    required(values, name)?
        .parse::<T>()
        .map_err(|_| format!("invalid numeric argument: {name}"))
}

async fn run_request(
    request: Request,
) -> Result<
    (
        Request,
        zt_adapters::live_public::BoundedLocalIngestionResult,
    ),
    String,
> {
    // Open and validate the local store before the explicit public connection.
    let store = SegmentStore::open(&request.root)
        .map_err(|_| format!("local store could not open: {}", request.root.display()))?;
    let subscription = PublicTradeSubscription {
        provider: PublicProvider::BinanceSpot,
        symbol_id: request.symbol_id,
        provider_symbol: Box::leak(request.provider_symbol.clone().into_boxed_str()),
        price_scale: request.price_scale,
        quantity_scale: request.quantity_scale,
        stream_id: request.stream_id,
    };
    let result = ingest_binance_aggregate_trade_probe_locally(
        BoundedLocalIngestionRequest {
            subscription,
            interval_ns: request.interval_ns,
            maximum_bars: request.maximum_bars,
            maximum_events: request.maximum_events,
            captured_at_ns: request.captured_at_ns,
            access_time: request.access_time,
            flush_at_end: request.flush,
        },
        &store,
    )
    .await
    .map_err(ingestion_error)?;
    Ok((request, result))
}

fn ingestion_error(error: LocalIngestionError) -> String {
    match error {
        LocalIngestionError::InvalidBounds => "direct ingestion bounds are invalid".to_owned(),
        LocalIngestionError::Probe(_) => {
            "selected public provider sample failed without fallback or retry".to_owned()
        }
        LocalIngestionError::Storage(_) => "local immutable segment operation failed".to_owned(),
    }
}

fn flush_name(outcome: LocalIngestionFlushOutcome) -> &'static str {
    match outcome {
        LocalIngestionFlushOutcome::NotRequested => "not_requested",
        LocalIngestionFlushOutcome::Persisted(_) => "persisted",
        LocalIngestionFlushOutcome::Empty => "empty",
        LocalIngestionFlushOutcome::Withheld => "withheld",
        LocalIngestionFlushOutcome::ExistingSegment => "existing_segment",
    }
}

fn print_result(request: &Request, result: zt_adapters::live_public::BoundedLocalIngestionResult) {
    let persisted = match result.flush_outcome {
        LocalIngestionFlushOutcome::Persisted(metadata) => format!(
            "{{\"symbol_id\":{},\"interval_ns\":{},\"start_ns\":{},\"bytes\":{}}}",
            metadata.key.symbol_id, metadata.key.interval_ns, metadata.key.start_ns, metadata.bytes
        ),
        _ => "null".to_owned(),
    };
    println!(
        concat!(
            "{{\n",
            "  \"schema_version\": 1,\n",
            "  \"network_opened\": true,\n",
            "  \"provider\": \"binance-spot-aggtrade\",\n",
            "  \"finite_event_cap\": {event_cap},\n",
            "  \"observed_events\": {observed_events},\n",
            "  \"flush_requested\": {flush_requested},\n",
            "  \"flush_outcome\": \"{flush_outcome}\",\n",
            "  \"local_root\": \"{root}\",\n",
            "  \"segment\": {segment}\n",
            "}}"
        ),
        event_cap = request.maximum_events,
        observed_events = result.observed_events,
        flush_requested = request.flush,
        flush_outcome = flush_name(result.flush_outcome),
        root = json_escape(&request.root.to_string_lossy()),
        segment = persisted,
    );
}

fn json_escape(value: &str) -> String {
    let mut output = String::new();
    for character in value.chars() {
        match character {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            _ if character.is_control() => output.push('?'),
            _ => output.push(character),
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_arguments() -> Vec<String> {
        vec![
            "--provider=binance-spot-aggtrade".to_owned(),
            "--root=local-store".to_owned(),
            "--provider-symbol=btcusdt".to_owned(),
            "--symbol-id=1".to_owned(),
            "--price-scale=100".to_owned(),
            "--quantity-scale=1000".to_owned(),
            "--stream-id=7".to_owned(),
            "--interval-ns=1000000".to_owned(),
            "--maximum-bars=10".to_owned(),
            "--maximum-events=3".to_owned(),
            "--captured-at-ns=3000000".to_owned(),
            "--access-time=9".to_owned(),
        ]
    }

    #[test]
    fn strict_arguments_configure_a_finite_request_without_opening_a_connection() {
        let request = parse_request(valid_arguments()).expect("complete request should parse");
        assert_eq!(request.maximum_events, 3);
        assert!(!request.flush);
        assert_eq!(request.provider_symbol, "btcusdt");
    }

    #[test]
    fn invalid_or_unsupported_arguments_are_rejected_before_transport() {
        let mut invalid = valid_arguments();
        invalid.retain(|argument| !argument.starts_with("--maximum-events="));
        assert!(parse_request(invalid).is_err());

        let mut over_limit = valid_arguments();
        for argument in &mut over_limit {
            if argument.starts_with("--maximum-events=") {
                *argument = format!("--maximum-events={}", MAXIMUM_PUBLIC_INGESTION_EVENTS + 1);
            }
        }
        assert!(parse_request(over_limit).is_err());

        let mut fallback = valid_arguments();
        for argument in &mut fallback {
            if argument.starts_with("--provider=") {
                *argument = "--provider=gate-spot".to_owned();
            }
        }
        assert!(parse_request(fallback).is_err());
    }
}
