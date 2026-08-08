#!/usr/bin/env python3
"""Local FastAPI boundary for the Stylophone reduction engine."""
from __future__ import annotations

import logging
import math
import os
import tempfile
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile as StarletteUploadFile

from sidecar.ingest import IngestError, clip, ingest
from sidecar.reduce import reduce


logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
READ_CHUNK_BYTES = 1024 * 1024
MAX_CLIP_SECONDS = 15.0

_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
}
_NON_AUDIO_MIME_TYPES = {
    "application/octet-stream",  # Common browser fallback for local files.
    "application/ogg",
    "video/mp4",  # Some browsers label an audio-only MP4 this way.
}

app = FastAPI(title="Stylophone Beat Coach Sidecar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def invalid_request_handler(
    _request: Request, _exc: RequestValidationError
) -> JSONResponse:
    """Keep FastAPI's multipart validation errors on the documented 400 path."""
    return JSONResponse(status_code=400, content={"detail": "Invalid request."})


def _parse_number(value: Optional[str], name: str, required: bool = True) -> Optional[float]:
    if value is None or not value.strip():
        if required:
            raise HTTPException(status_code=400, detail=f"{name} is required.")
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{name} must be a number.")
    if not math.isfinite(number):
        raise HTTPException(status_code=400, detail=f"{name} must be finite.")
    return number


def _validate_clip(clip_start: float, clip_end: float, bpm: Optional[float]) -> None:
    if clip_start < 0:
        raise HTTPException(status_code=400, detail="clip_start must be non-negative.")
    duration = clip_end - clip_start
    if duration <= 0:
        raise HTTPException(
            status_code=400, detail="clip_end must be greater than clip_start."
        )
    if duration > MAX_CLIP_SECONDS:
        raise HTTPException(status_code=400, detail="Clip region must be 15 seconds or less.")
    if bpm is not None and bpm <= 0:
        raise HTTPException(status_code=400, detail="bpm must be greater than zero.")


def _looks_like_audio(header: bytes) -> bool:
    """Recognize common audio containers without decoding hostile input."""
    return bool(
        (len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WAVE")
        or header.startswith(b"ID3")
        or (len(header) >= 2 and header[0] == 0xFF and header[1] & 0xE0 == 0xE0)
        or header.startswith(b"fLaC")
        or header.startswith(b"OggS")
        or (len(header) >= 12 and header[4:8] == b"ftyp")
        or header.startswith(b"\x1aE\xdf\xa3")
        or (
            len(header) >= 12
            and header[:4] == b"FORM"
            and header[8:12] in {b"AIFF", b"AIFC"}
        )
    )


def _validate_file_metadata(upload: StarletteUploadFile) -> str:
    filename = Path(upload.filename or "").name
    suffix = Path(filename).suffix.lower()
    if not filename or suffix not in _AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Upload must be a supported audio file.")

    mime = (upload.content_type or "").lower().split(";", 1)[0].strip()
    if not (mime.startswith("audio/") or mime in _NON_AUDIO_MIME_TYPES):
        raise HTTPException(status_code=400, detail="Upload must be a supported audio file.")
    return suffix


async def _save_bounded_upload(upload: StarletteUploadFile, suffix: str) -> str:
    size = 0
    header = b""
    try:
        with tempfile.NamedTemporaryFile(prefix="stylophone-", suffix=suffix, delete=False) as tmp:
            path = tmp.name
            while True:
                chunk = await upload.read(READ_CHUNK_BYTES)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Audio file is too large.")
                if len(header) < 16:
                    header = (header + chunk)[:16]
                tmp.write(chunk)
    except Exception:
        if "path" in locals():
            try:
                os.unlink(path)
            except FileNotFoundError:
                pass
        raise

    if size == 0 or not _looks_like_audio(header):
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        raise HTTPException(status_code=400, detail="Upload does not contain recognizable audio.")
    return path


def _ingest_clip_reduce(
    upload_path: Optional[str],
    youtube_url: Optional[str],
    filename: Optional[str],
    mime_type: Optional[str],
    clip_start: float,
    clip_end: float,
    bpm: Optional[float],
):
    """Acquire, clip, and reduce one source inside one synchronous worker."""
    with tempfile.TemporaryDirectory(prefix="stylophone-request-") as work_dir:
        audio = ingest(
            file_path=upload_path,
            youtube_url=youtube_url,
            work_dir=work_dir,
            filename=filename,
            mime_type=mime_type,
        )
        clip_path = clip(audio, clip_start, clip_end, work_dir)
        duration = clip_end - clip_start
        result = reduce(str(clip_path), 0, duration, bpm)
        if isinstance(result, dict) and isinstance(result.get("source"), dict):
            result["source"].update(
                {
                    "type": "youtube" if youtube_url is not None else "upload",
                    "ref": youtube_url if youtube_url is not None else Path(filename or "").name,
                    "clipStart": clip_start,
                    "clipEnd": clip_end,
                }
            )
        return result


@app.post("/reduce")
async def reduce_audio(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    youtube_url: Optional[str] = Form(default=None),
    clip_start: Optional[str] = Form(default=None),
    clip_end: Optional[str] = Form(default=None),
    bpm: Optional[str] = Form(default=None),
):
    """Reduce one uploaded audio file or YouTube video without blocking the event loop."""
    form = await request.form()
    uploads = form.getlist("file")
    url = youtube_url.strip() if youtube_url and youtube_url.strip() else None
    upload = (
        uploads[0]
        if len(uploads) == 1 and isinstance(uploads[0], StarletteUploadFile)
        else None
    )
    temp_path = None
    try:
        if (
            len(uploads) > 1
            or (uploads and upload is None)
            or (upload and url)
            or (not upload and not url)
        ):
            raise HTTPException(
                status_code=400, detail="Provide exactly one audio file or YouTube URL."
            )
        if upload is not None and file is not upload:
            raise HTTPException(
                status_code=400, detail="Provide exactly one audio file or YouTube URL."
            )

        start = _parse_number(clip_start, "clip_start")
        end = _parse_number(clip_end, "clip_end")
        known_bpm = _parse_number(bpm, "bpm", required=False)
        assert start is not None and end is not None
        _validate_clip(start, end, known_bpm)

        filename = None
        mime_type = None
        if upload is not None:
            suffix = _validate_file_metadata(upload)
            filename = Path(upload.filename or "").name
            mime_type = upload.content_type
            temp_path = await _save_bounded_upload(upload, suffix)
        try:
            return await run_in_threadpool(
                _ingest_clip_reduce,
                temp_path,
                url,
                filename,
                mime_type,
                start,
                end,
                known_bpm,
            )
        except IngestError as exc:
            raise HTTPException(status_code=exc.status_code, detail=str(exc))
        except Exception:
            logger.exception("Reduction failed")
            raise HTTPException(
                status_code=422,
                detail="Reduction failed; the audio could not be processed.",
            )
    finally:
        for item in uploads:
            if isinstance(item, StarletteUploadFile):
                await item.close()
        if temp_path is not None:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    uvicorn.run("sidecar.app:app", host="127.0.0.1", port=8000)
