from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import mimetypes
import re
from collections.abc import Iterator
from email.utils import formatdate
from pathlib import Path
from time import sleep
from typing import BinaryIO
from urllib import error, parse, request


SOCKET_TIMEOUT_SECONDS = 45
MAX_UPLOAD_ATTEMPTS = 3
RETRYABLE_HTTP_STATUSES = {408, 429, 500, 502, 503, 504}
UPLOAD_CHUNK_BYTES = 256 * 1024
PROGRESS_INTERVAL_BYTES = 10 * 1024 * 1024


def normalize_prefix(prefix: str) -> str:
    return prefix.strip("/")


def normalize_endpoint(endpoint: str) -> str:
    return endpoint.removeprefix("https://").removeprefix("http://").rstrip("/")


def normalize_version(version: str) -> str:
    normalized = version.strip("/")
    if not re.fullmatch(r"v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", normalized):
        raise RuntimeError(f"Unsupported version format: {version}. Expected format: v0.0.1")
    return normalized


def detect_content_type(file_name: str) -> str:
    if file_name.endswith(".exe"):
        return "application/vnd.microsoft.portable-executable"
    if file_name.endswith(".zip"):
        return "application/zip"
    return mimetypes.guess_type(file_name)[0] or "application/octet-stream"


def read_upload_chunks(file_stream: BinaryIO, file_name: str, size: int) -> Iterator[bytes]:
    sent = 0
    next_report = PROGRESS_INTERVAL_BYTES
    while chunk := file_stream.read(UPLOAD_CHUNK_BYTES):
        yield chunk
        sent += len(chunk)
        if sent >= next_report or sent == size:
            print(f"Sent {sent:,}/{size:,} bytes for {file_name}", flush=True)
            next_report = sent + PROGRESS_INTERVAL_BYTES


def put_object(
    *,
    access_key_id: str,
    access_key_secret: str,
    bucket: str,
    endpoint: str,
    object_key: str,
    file_path: Path,
) -> None:
    host = f"{bucket}.{normalize_endpoint(endpoint)}"
    content_type = detect_content_type(file_path.name)
    date = formatdate(usegmt=True)
    canonical_resource = f"/{bucket}/{object_key}"
    string_to_sign = f"PUT\n\n{content_type}\n{date}\n{canonical_resource}"
    signature = base64.b64encode(
        hmac.new(access_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    object_path = parse.quote(object_key, safe="/~")
    url = f"https://{host}/{object_path}"
    size = file_path.stat().st_size
    headers = {
        "Authorization": f"OSS {access_key_id}:{signature}",
        "Content-Length": str(size),
        "Content-Type": content_type,
        "Date": date,
    }

    print(f"Uploading {object_key} ({size:,} bytes) to {host}", flush=True)
    with file_path.open("rb") as file_stream:
        body = read_upload_chunks(file_stream, file_path.name, size)
        req = request.Request(url, data=body, headers=headers, method="PUT")
        with request.urlopen(req, timeout=SOCKET_TIMEOUT_SECONDS) as response:
            if response.status not in (200, 201):
                raise RuntimeError(f"OSS upload failed for {file_path.name}: HTTP {response.status}")


def upload_to_oss(
    args: argparse.Namespace, object_key: str, file_path: Path
) -> None:
    for attempt in range(1, MAX_UPLOAD_ATTEMPTS + 1):
        try:
            put_object(
                access_key_id=args.access_key_id,
                access_key_secret=args.access_key_secret,
                bucket=args.bucket,
                endpoint=args.endpoint,
                object_key=object_key,
                file_path=file_path,
            )
        except error.HTTPError as exc:
            with exc:
                try:
                    detail = exc.read(4096).decode("utf-8", errors="replace").strip()
                except OSError:
                    detail = ""
            reason = f"HTTP {exc.code}: {detail or exc.reason}"
            if exc.code not in RETRYABLE_HTTP_STATUSES:
                raise RuntimeError(f"OSS upload failed for {object_key}: {reason}") from exc
        except (error.URLError, TimeoutError, ConnectionError) as exc:
            reason = str(exc)
        else:
            print(f"Uploaded {object_key}", flush=True)
            return

        if attempt == MAX_UPLOAD_ATTEMPTS:
            raise RuntimeError(f"OSS upload failed for {object_key} after {attempt} attempts: {reason}")
        delay = 2**attempt
        print(f"Upload attempt {attempt} failed for {object_key}: {reason}. Retrying in {delay}s.", flush=True)
        sleep(delay)


def publish(args: argparse.Namespace) -> None:
    artifacts_dir = Path(args.artifacts_dir)
    if not artifacts_dir.exists():
        raise RuntimeError(f"Artifacts directory does not exist: {artifacts_dir}")
    # Publish the manifest only after the files it links to are available.
    files = sorted(
        (path for path in artifacts_dir.iterdir() if path.is_file()),
        key=lambda path: (path.name == "update.json", path.name),
    )
    if not files:
        raise RuntimeError(f"No files found in {artifacts_dir}")

    oss_prefix = normalize_prefix(args.prefix)
    version_dir = normalize_version(args.version)
    for file_path in files:
        file_name = file_path.name
        segments = []
        if oss_prefix:
            segments.append(oss_prefix)
        if file_name != "update.json":
            segments.append(version_dir)
        segments.append(file_name)
        object_key = "/".join(segments)
        upload_to_oss(args, object_key, file_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifacts-dir", required=True)
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--endpoint", required=True)
    parser.add_argument("--prefix", default="")
    parser.add_argument("--version", required=True)
    parser.add_argument("--access-key-id", required=True)
    parser.add_argument("--access-key-secret", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    publish(parse_args())
