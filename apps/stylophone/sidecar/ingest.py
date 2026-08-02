#!/usr/bin/env python3
"""Validated audio acquisition and clipping for one reduction request."""
from __future__ import annotations

import math
import mimetypes
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs, urlparse


MAX_SOURCE_BYTES = 50 * 1024 * 1024
MAX_SOURCE_SECONDS = 30 * 60
MAX_CLIP_SECONDS = 15

_LOCAL_TYPES = {
    ".mp3": {"audio/mpeg", "audio/mp3", "application/octet-stream"},
    ".wav": {"audio/wav", "audio/x-wav", "audio/wave", "application/octet-stream"},
}
_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}


class IngestError(Exception):
    """An expected, safe-to-report ingest failure."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code
        self.status = status_code


@dataclass(frozen=True)
class IngestedAudio:
    path: Path
    source_type: str
    source_ref: str
    duration: float


def _workspace(work_dir) -> Path:
    root = Path(work_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    if not root.is_dir():
        raise IngestError("Invalid request workspace.")
    return root


def _audio_info(path: Path):
    try:
        import soundfile

        info = soundfile.info(str(path))
    except Exception as exc:
        raise IngestError("Audio could not be decoded.") from exc
    duration = float(info.duration)
    if not math.isfinite(duration) or duration <= 0:
        raise IngestError("Audio has an invalid duration.")
    return info, duration


def _is_expected_header(path: Path, suffix: str) -> bool:
    try:
        with path.open("rb") as source:
            header = source.read(12)
    except OSError as exc:
        raise IngestError("Audio file could not be read.") from exc
    if suffix == ".wav":
        return len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WAVE"
    return header.startswith(b"ID3") or (
        len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0
    )


def _check_size(path: Path) -> None:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise IngestError("Audio file could not be read.") from exc
    if size > MAX_SOURCE_BYTES:
        raise IngestError("Audio file is too large.", 413)
    if size <= 0:
        raise IngestError("Audio file is empty.")


def _ingest_file(file_path, filename: Optional[str], mime_type: Optional[str], root: Path) -> IngestedAudio:
    source = Path(file_path)
    display_name = Path(filename or source.name).name
    suffix = Path(display_name).suffix.lower()
    if suffix not in _LOCAL_TYPES:
        raise IngestError("Upload must be an MP3 or WAV file.")
    mime = (mime_type or mimetypes.guess_type(display_name)[0] or "").split(";", 1)[0].lower()
    if mime not in _LOCAL_TYPES[suffix]:
        raise IngestError("Upload has an unsupported audio type.")
    _check_size(source)
    if not _is_expected_header(source, suffix):
        raise IngestError("Upload does not contain recognizable audio.")

    info, duration = _audio_info(source)
    expected_formats = {"WAV"} if suffix == ".wav" else {"MP3", "MPEG"}
    if str(info.format).upper() not in expected_formats:
        raise IngestError("Audio contents do not match the filename.")
    if duration > MAX_SOURCE_SECONDS:
        raise IngestError("Audio is longer than 30 minutes.", 413)

    destination = root / ("source" + suffix)
    try:
        if source.resolve() != destination.resolve():
            shutil.copyfile(str(source), str(destination))
    except OSError as exc:
        raise IngestError("Audio could not be copied into the request workspace.") from exc
    return IngestedAudio(destination, "file", display_name, duration)


def _validate_youtube_url(value: str) -> str:
    try:
        parsed = urlparse(value)
        host = (parsed.hostname or "").lower()
    except ValueError as exc:
        raise IngestError("Invalid YouTube URL.") from exc
    if parsed.scheme not in {"http", "https"} or host not in _YOUTUBE_HOSTS:
        raise IngestError("Only YouTube video URLs are supported.")
    query = parse_qs(parsed.query)
    if parsed.path.rstrip("/") == "/playlist" or "list" in query:
        raise IngestError("YouTube playlists are not supported.")
    if host == "youtu.be" and not parsed.path.strip("/"):
        raise IngestError("Invalid YouTube video URL.")
    if host != "youtu.be" and parsed.path not in {"/watch", "/shorts/" + parsed.path.split("/")[-1]}:
        if not parsed.path.startswith(("/shorts/", "/embed/")):
            raise IngestError("Invalid YouTube video URL.")
    return value


def _run(args) -> None:
    try:
        subprocess.run(args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError as exc:
        raise IngestError("Required audio tool is not installed.") from exc
    except subprocess.CalledProcessError as exc:
        raise IngestError("Audio acquisition failed.") from exc


def _ingest_youtube(url: str, root: Path) -> IngestedAudio:
    safe_url = _validate_youtube_url(url)
    template = root / "youtube.%(ext)s"
    _run([
        sys.executable, "-m", "yt_dlp",
        "--no-playlist",
        "--max-filesize", "50M",
        "--match-filter", "duration <= 1800",
        "--format", "bestaudio",
        "--extract-audio",
        "--audio-format", "wav",
        "--output", str(template),
        safe_url,
    ])
    output = root / "youtube.wav"
    if not output.is_file():
        raise IngestError("Audio acquisition produced no usable output.")
    _check_size(output)
    _, duration = _audio_info(output)
    if duration > MAX_SOURCE_SECONDS:
        raise IngestError("Audio is longer than 30 minutes.", 413)
    return IngestedAudio(output, "youtube", safe_url, duration)


def ingest(
    *, file_path=None, youtube_url: Optional[str] = None, work_dir,
    filename: Optional[str] = None, mime_type: Optional[str] = None
) -> IngestedAudio:
    """Acquire exactly one validated source into ``work_dir``."""
    if (file_path is None) == (not youtube_url):
        raise IngestError("Provide exactly one audio file or YouTube URL.")
    root = _workspace(work_dir)
    if file_path is not None:
        return _ingest_file(file_path, filename, mime_type, root)
    return _ingest_youtube(str(youtube_url), root)


def clip(audio: IngestedAudio, clip_start: float, clip_end: float, work_dir) -> Path:
    """Render a mono 44.1 kHz PCM WAV clip of at most 15 seconds."""
    try:
        start, end = float(clip_start), float(clip_end)
    except (TypeError, ValueError) as exc:
        raise IngestError("Clip times must be numbers.") from exc
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
        raise IngestError("Invalid clip range.")
    duration = end - start
    if duration > MAX_CLIP_SECONDS:
        raise IngestError("Clip must be 15 seconds or less.")
    if end > audio.duration:
        raise IngestError("Clip range exceeds the audio duration.")

    root = _workspace(work_dir)
    output = root / "clip.wav"
    _run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
        "-ss", str(start), "-i", str(audio.path), "-t", str(duration),
        "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le",
        "-y", str(output),
    ])
    if not output.is_file():
        raise IngestError("Audio clipping produced no usable output.")
    info, output_duration = _audio_info(output)
    if info.channels != 1 or info.samplerate != 44100 or output_duration > MAX_CLIP_SECONDS + 0.01:
        raise IngestError("Audio clipping produced an invalid output.")
    return output
