"""Non-executable, self-contained evidence exports. Hashes prove identity only."""
import copy
import json
import time

from archive import Archive, digest, encode

MAX_BYTES = 32_000_000
LIMITATIONS = [
    "Hashes identify canonical JSON content and exact source; they do not attest execution, profitability or causal strategy logic.",
    "Recipient computation has not been reproduced. Independently rerun exact source, dataset, configuration and recorded runtime.",
    "User Python runs with local user permissions; inspecting or verifying this bundle never executes its source.",
    "Standalone optional ResearchRun Monte Carlo attachments are outside the core run hash and omitted; validation Monte Carlo remains in the hashed report.",
]


def manifest(report, runs):
    return {"validationId": report["id"], "validationHash": report["resultHash"], "validationFingerprint": report["provenance"]["fingerprint"],
            "sourceRunId": report["sourceRunId"], "sourceRunFingerprint": report["provenance"]["sourceRunFingerprint"],
            "validationConfigHash": report["provenance"]["validationConfigHash"],
            "runs": [{"id": run["id"], "resultHash": run["resultHash"], "sourceHash": run["sourceHash"], "datasetHash": run["dataset"]["hash"], "payloadHash": digest(run)} for run in runs]}


def make_bundle(report, runs):
    bundle = {"version": 1, "kind": "zterminal_research_evidence", "exportedAt": int(time.time() * 1000),
              "validation": copy.deepcopy(report), "runs": sorted((copy.deepcopy(run) for run in runs), key=lambda run: run["id"]),
              "limitations": list(LIMITATIONS)}
    bundle["manifest"] = manifest(bundle["validation"], bundle["runs"])
    bundle["graphFingerprint"] = digest(bundle["manifest"])
    bundle["bundleHash"] = digest(bundle)
    verify_bundle(bundle)
    return bundle


def verify_bundle(bundle):
    """Offline identity verification only. No execution and no archive admission."""
    if not isinstance(bundle, dict) or type(bundle.get("version")) is not int or bundle["version"] != 1 or bundle.get("kind") != "zterminal_research_evidence":
        raise ValueError("Unsupported evidence bundle")
    if set(bundle) != {"version", "kind", "exportedAt", "validation", "runs", "limitations", "manifest", "graphFingerprint", "bundleHash"} or bundle.get("limitations") != LIMITATIONS:
        raise ValueError("Unsupported evidence bundle fields or interpretation limits")
    if len(encode(bundle).encode("utf-8")) > MAX_BYTES:
        raise ValueError("Evidence bundle exceeds 32 MB; a larger streaming format is required")
    if bundle.get("bundleHash") != digest({key: value for key, value in bundle.items() if key != "bundleHash"}):
        raise ValueError("Evidence bundle hash mismatch")
    runs, report = bundle.get("runs"), bundle.get("validation")
    if not isinstance(runs, list) or not 1 <= len(runs) <= 200 or not isinstance(report, dict) or report.get("version") != 4:
        raise ValueError("Invalid evidence graph")
    if report.get("resultHash") != digest({key: value for key, value in report.items() if key != "resultHash"}):
        raise ValueError("Validation artifact hash mismatch")
    provenance = report.get("provenance", {})
    if provenance.get("validationConfigHash") != digest(report.get("config")) or provenance.get("fingerprint") != digest({"sourceRunFingerprint": provenance.get("sourceRunFingerprint"), "config": report.get("config"), "engineVersion": provenance.get("engineVersion")}):
        raise ValueError("Validation configuration or fingerprint mismatch")
    identities = {}
    for run in runs:
        Archive.validate_result(run)
        if run["id"] in identities or "monteCarlo" in run:
            raise ValueError("Duplicate run or detached analysis in evidence graph")
        identities[run["id"]] = run
    if [run["id"] for run in runs] != sorted(identities):
        raise ValueError("Evidence runs must be ordered by identity")
    if not isinstance(report.get("evidenceRuns"), dict) or not report["evidenceRuns"] or "parent" in report["evidenceRuns"]:
        raise ValueError("Invalid evidence references")
    references = {**report["evidenceRuns"], "parent": {"id": report["sourceRunId"], "resultHash": provenance["sourceRunFingerprint"]}}
    required = set()
    active = set()
    def require(identifier):
        if identifier in active:
            raise ValueError("Cyclic reproduction lineage")
        if identifier in required:
            return
        if identifier not in identities:
            raise ValueError("Evidence graph is missing a linked ResearchRun")
        active.add(identifier)
        run = identities[identifier]
        parent_id = run.get("reproducedFrom")
        if parent_id:
            require(parent_id)
            parent = identities[parent_id]
            if any(run[key] != parent[key] for key in ("source", "sourceHash", "config", "params", "dataset")):
                raise ValueError("Reproduction graph input mismatch")
            comparison = run.get("reproduction")
            if comparison and comparison["parentResultHash"] != parent["resultHash"]:
                raise ValueError("Reproduction graph parent hash mismatch")
        active.remove(identifier)
        required.add(identifier)
    for reference in references.values():
        if not isinstance(reference, dict) or not isinstance(reference.get("id"), str) or not isinstance(reference.get("resultHash"), str):
            raise ValueError("Invalid evidence reference")
        require(reference["id"])
        if identities[reference["id"]]["resultHash"] != reference["resultHash"]:
            raise ValueError("Evidence graph result linkage mismatch")
    if required != set(identities):
        raise ValueError("Evidence graph contains unrelated ResearchRuns")
    expected = manifest(report, runs)
    if bundle.get("manifest") != expected or bundle.get("graphFingerprint") != digest(expected):
        raise ValueError("Evidence manifest mismatch")
    return {"status": "identity_verified_computation_not_reproduced", "validationId": report["id"], "runCount": len(runs), "graphFingerprint": bundle["graphFingerprint"]}


def verify_file(path):
    """Bound reads before JSON parsing and reject ambiguous duplicate keys."""
    def unique(pairs):
        value = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("Duplicate JSON key in evidence bundle")
            value[key] = item
        return value
    with open(path, "rb") as stream:
        raw = stream.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Evidence bundle exceeds 32 MB")
    return verify_bundle(json.loads(raw, object_pairs_hook=unique))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Verify evidence identities offline. Never executes retained strategy source or imports results into an archive.")
    parser.add_argument("bundle", help="Path to exported JSON evidence bundle")
    args = parser.parse_args()
    try:
        print(encode(verify_file(args.bundle)))
    except (ValueError, KeyError, TypeError, OSError, RecursionError) as error:
        parser.exit(1, f"Evidence verification failed: {error}\n")
