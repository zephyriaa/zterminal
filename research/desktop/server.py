"""Loopback-only private preview API. Browser access requires exact origin + pairing."""
import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import platform
import secrets
import threading
import time
from urllib.parse import urlsplit

from archive import Archive, encode
from controller import Controller

PORT = 47321
ORIGINS = frozenset(["https://zterminal.onrender.com", "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:3100"])


class Service:
    def __init__(self, root, origins=ORIGINS):
        self.root, self.origins = Path(root), origins
        self.root.mkdir(parents=True, exist_ok=True)
        self.archive = Archive(self.root / "research.sqlite3")
        self.controller = Controller(self.archive, self.root / "jobs")
        self.pair_lock = threading.Lock()
        self.code = f"{secrets.randbelow(100_000_000):08d}"
        self.expires, self.attempts = time.monotonic() + 600, 0
        self.token_path = self.root / "paired-clients.json"
        self.tokens = json.loads(self.token_path.read_text(encoding="utf-8")) if self.token_path.exists() else {}
        (self.root / "pairing.json").write_text(encode({"code": self.code, "expiresAt": int(time.time() * 1000) + 600_000, "pid": os.getpid(), "port": PORT}), encoding="utf-8")

    def pair(self, origin, code):
        with self.pair_lock:
            if time.monotonic() > self.expires or self.attempts >= 5:
                raise PermissionError("Pairing code expired or locked. Restart the helper to request a new code.")
            self.attempts += 1
            if not isinstance(code, str) or not secrets.compare_digest(self.code, code):
                raise PermissionError("Incorrect pairing code")
            token = secrets.token_urlsafe(32)
            # Keep a bounded number of clients; a new pairing for this origin replaces its token.
            self.tokens[origin] = hashlib.sha256(token.encode()).hexdigest()
            temporary = self.token_path.with_suffix(".tmp")
            temporary.write_text(encode(self.tokens), encoding="utf-8")
            os.replace(temporary, self.token_path)
            self.expires = 0
            return {"token": token, "protocol": 1, "scope": "local-research"}

    def authorized(self, origin, header):
        if not header or not header.startswith("Bearer "):
            return False
        expected = self.tokens.get(origin)
        return bool(expected and secrets.compare_digest(expected, hashlib.sha256(header[7:].encode()).hexdigest()))


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, address, service):
        self.service = service
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.slots.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "ZTerminalLocal/1"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *_args):
        pass  # Never log source, tokens, pairing codes or URLs with user parameters.

    def respond(self, status, value):
        body = encode(value).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in self.server.service.origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def gate(self, authenticate=True):
        origin = self.headers.get("Origin")
        if self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}" or origin not in self.server.service.origins or self.client_address[0] != "127.0.0.1":
            raise PermissionError("Host or origin is not authorized")
        if authenticate and not self.server.service.authorized(origin, self.headers.get("Authorization")):
            raise PermissionError("Pair this browser with the local helper")
        return origin

    def payload(self):
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json" or self.headers.get("Transfer-Encoding"):
            raise ValueError("Use a bounded JSON request")
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 32_000_000:
            raise ValueError("Request size must be between 1 byte and 32 MB")
        body = self.rfile.read(size)
        if len(body) != size:
            raise ValueError("Request body was interrupted")
        result = json.loads(body, parse_constant=lambda _value: (_ for _ in ()).throw(ValueError("Non-finite JSON value")))
        if not isinstance(result, dict):
            raise ValueError("Request must be a JSON object")
        return result

    def do_OPTIONS(self):
        try:
            origin = self.gate(False)
            if self.headers.get("Access-Control-Request-Method") not in ("GET", "POST", "DELETE"):
                raise PermissionError("Unsupported method")
            requested = {h.strip().lower() for h in self.headers.get("Access-Control-Request-Headers", "").split(",") if h.strip()}
            if not requested <= {"authorization", "content-type"}:
                raise PermissionError("Unsupported request headers")
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "300")
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", "0")
            self.end_headers()
        except PermissionError as error:
            self.respond(403, {"error": str(error)})

    def dispatch(self, method):
        try:
            parts = urlsplit(self.path).path.strip("/").split("/")
            if len(self.path) > 1024 or len(parts) < 2 or parts[0] != "v1":
                raise KeyError("Unknown endpoint")
            route = parts[1]
            public = (method == "GET" and route == "capabilities") or (method == "POST" and route == "pair")
            origin = self.gate(not public)
            service, archive = self.server.service, self.server.service.archive
            body = self.payload() if method == "POST" else {}
            identifier = parts[2] if len(parts) >= 3 else None
            if method == "GET" and route == "capabilities":
                return self.respond(200, {"protocol": 1, "version": "1.0.0-preview.1", "platform": "windows-x64", "scope": "local-research", "python": platform.python_version(), "sdk": "1.0.0", "vectorbt": "0.28.1", "activeJob": service.controller.active["id"] if service.controller.active else None, "execution": "local-user-permissions", "maxBars": 100000})
            if method == "POST" and route == "pair":
                return self.respond(200, service.pair(origin, body.get("code")))
            if method == "POST" and route == "datasets":
                return self.respond(200, archive.find_dataset(body))
            if route == "scripts":
                if method == "GET":
                    return self.respond(200, archive.revisions(identifier) if identifier else archive.scripts())
                if method == "POST":
                    return self.respond(200, archive.save_script(body))
                if method == "DELETE" and identifier:
                    archive.delete_script(identifier)
                    return self.respond(200, {"deleted": True})
            if route == "jobs":
                if method == "POST" and not identifier:
                    if body.get("operation"):
                        raise ValueError("Use the analysis endpoint for archived results")
                    return self.respond(202, service.controller.create(body))
                if method == "GET" and identifier:
                    return self.respond(200, service.controller.status(identifier))
                if method == "DELETE" and identifier:
                    return self.respond(200, service.controller.cancel(identifier))
            if route == "results":
                if method == "GET":
                    return self.respond(200, archive.result(identifier) if identifier else archive.results())
                if method == "POST" and not identifier:
                    # Import never evaluates retained source. Only canonical v1 envelopes are accepted.
                    archive.save_result(body)
                    return self.respond(201, {"id": body["id"]})
                if method == "POST" and identifier and len(parts) == 4 and parts[3] == "monte-carlo":
                    return self.respond(202, service.controller.create({"operation": "monte_carlo", "result": archive.result(identifier), "simulations": body.get("simulations", 1000), "seed": body.get("seed", 42)}))
            if route == "legacy":
                if method == "POST":
                    return self.respond(201, archive.import_legacy(body))
                if method == "GET":
                    return self.respond(200, archive.legacy())
            raise KeyError("Unknown endpoint")
        except PermissionError as error:
            self.respond(403, {"error": str(error), "code": "pairing_required"})
        except KeyError as error:
            self.respond(404, {"error": str(error)})
        except (ValueError, TypeError) as error:
            self.respond(400, {"error": str(error)})
        except Exception:
            self.respond(500, {"error": "Local storage or helper operation failed. Check available disk space and restart the helper; no success is assumed."})

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_DELETE(self):
        self.dispatch("DELETE")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default=str(Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "ZTerminal" / "ResearchPreview"))
    args = parser.parse_args()
    if os.name != "nt" or platform.machine().lower() not in ("amd64", "x86_64"):
        raise RuntimeError("Private preview requires Windows x64")
    service = Service(args.data_dir)
    server = Server(("127.0.0.1", PORT), service)
    try:
        server.serve_forever(poll_interval=.2)
    finally:
        if service.controller.active:
            service.controller.cancel(service.controller.active["id"])
        server.server_close()


if __name__ == "__main__":
    main()
