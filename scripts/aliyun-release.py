from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import mimetypes
from email.utils import formatdate
from pathlib import Path
from urllib import error, parse, request


def normalize_prefix(prefix: str) -> str:
    return prefix.strip("/")


def normalize_endpoint(endpoint: str) -> str:
    return endpoint.removeprefix("https://").removeprefix("http://").rstrip("/")


def detect_content_type(file_name: str) -> str:
    if file_name.endswith(".exe"):
        return "application/vnd.microsoft.portable-executable"
    if file_name.endswith(".zip"):
        return "application/zip"
    return mimetypes.guess_type(file_name)[0] or "application/octet-stream"


def upload_to_oss(
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
    with file_path.open("rb") as file_stream:
        payload = file_stream.read()

    headers = {
        "Authorization": f"OSS {access_key_id}:{signature}",
        "Content-Type": content_type,
        "Date": date,
    }

    req = request.Request(url, data=payload, headers=headers, method="PUT")
    try:
        with request.urlopen(req) as response:
            if response.status not in (200, 201):
                raise RuntimeError(f"OSS upload failed for {file_path.name}: HTTP {response.status}")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OSS upload failed for {file_path.name}: {detail}") from exc


def publish(args: argparse.Namespace) -> None:
    artifacts_dir = Path(args.artifacts_dir)
    if not artifacts_dir.exists():
        raise RuntimeError(f"Artifacts directory does not exist: {artifacts_dir}")
    files = sorted(path for path in artifacts_dir.iterdir() if path.is_file())
    if not files:
        raise RuntimeError(f"No files found in {artifacts_dir}")

    oss_prefix = normalize_prefix(args.prefix)
    version_dir = args.version.strip("/")
    if not version_dir:
        raise RuntimeError("Version directory must not be empty.")
    for file_path in files:
        file_name = file_path.name
        segments = [oss_prefix]
        if file_name != "update.json":
            segments.append(version_dir)
        segments.append(file_name)
        segments = [segment for segment in segments if segment]
        object_key = "/".join(segments)
        upload_to_oss(
            access_key_id=args.access_key_id,
            access_key_secret=args.access_key_secret,
            bucket=args.bucket,
            endpoint=args.endpoint,
            object_key=object_key,
            file_path=file_path,
        )
        print(f"Uploaded: {file_name}")


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
