"""Deterministic contract tests for the localhost reduction sidecar."""
import ast
import io
import os
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from starlette.datastructures import FormData, Headers, UploadFile
from starlette.requests import Request

from sidecar import app as sidecar_app
from sidecar.ingest import IngestError, IngestedAudio


WAV_BYTES = b"RIFF" + (b"\x00" * 4) + b"WAVEfmt " + (b"\x00" * 32)


def make_upload(data=WAV_BYTES, filename="clip.wav", content_type="audio/wav"):
    return UploadFile(
        io.BytesIO(data),
        filename=filename,
        headers=Headers({"content-type": content_type}),
    )


def make_request(upload=None, youtube_url=None):
    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/reduce",
            "raw_path": b"/reduce",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("127.0.0.1", 8000),
        }
    )
    fields = []
    if upload is not None:
        fields.append(("file", upload))
    if youtube_url is not None:
        fields.append(("youtube_url", youtube_url))
    request._form = FormData(fields)
    return request


class ReduceContractTests(unittest.IsolatedAsyncioTestCase):
    async def call_reduce(
        self,
        upload=None,
        youtube_url=None,
        clip_start="1.5",
        clip_end="9.5",
        bpm="120",
    ):
        return await sidecar_app.reduce_audio(
            make_request(upload, youtube_url),
            file=upload,
            youtube_url=youtube_url,
            clip_start=clip_start,
            clip_end=clip_end,
            bpm=bpm,
        )

    @staticmethod
    async def run_worker(function, *args):
        return function(*args)

    async def test_file_dispatches_ingest_clip_reduce_and_preserves_source(self):
        upload = make_upload(filename="../user-beat.wav")
        work_dirs = []
        upload_paths = []
        reducer_result = {
            "schemaVersion": 1,
            "source": {
                "type": "upload",
                "ref": "clip.wav",
                "clipStart": 0,
                "clipEnd": 8,
                "phaseSec": 0.25,
                "loopLenSec": 4.0,
            },
            "tracks": [],
        }

        def ingest_source(**kwargs):
            work_dirs.append(kwargs["work_dir"])
            upload_paths.append(kwargs["file_path"])
            self.assertTrue(os.path.exists(kwargs["file_path"]))
            self.assertEqual(kwargs["filename"], "user-beat.wav")
            self.assertEqual(kwargs["mime_type"], "audio/wav")
            self.assertIsNone(kwargs["youtube_url"])
            return IngestedAudio(
                Path(kwargs["work_dir"]) / "source.wav",
                "file",
                "user-beat.wav",
                20,
            )

        def make_clip(audio, start, end, work_dir):
            self.assertEqual((start, end), (1.5, 9.5))
            self.assertEqual(audio.source_type, "file")
            return Path(work_dir) / "clip.wav"

        with patch.object(
            sidecar_app, "ingest", side_effect=ingest_source
        ) as ingest_mock, patch.object(
            sidecar_app, "clip", side_effect=make_clip
        ) as clip_mock, patch.object(
            sidecar_app, "reduce", return_value=reducer_result
        ) as reduce_mock, patch.object(
            sidecar_app,
            "run_in_threadpool",
            new=AsyncMock(side_effect=self.run_worker),
        ) as threadpool:
            result = await self.call_reduce(upload)

        threadpool.assert_awaited_once()
        ingest_mock.assert_called_once()
        clip_mock.assert_called_once()
        reduce_mock.assert_called_once_with(
            str(Path(work_dirs[0]) / "clip.wav"), 0, 8.0, 120.0
        )
        self.assertEqual(
            result["source"],
            {
                "type": "upload",
                "ref": "user-beat.wav",
                "clipStart": 1.5,
                "clipEnd": 9.5,
                "phaseSec": 0.25,
                "loopLenSec": 4.0,
            },
        )
        self.assertFalse(os.path.exists(work_dirs[0]))
        self.assertFalse(os.path.exists(upload_paths[0]))
        self.assertTrue(upload.file.closed)

    async def test_youtube_dispatches_successfully(self):
        url = "https://www.youtube.com/watch?v=offline-test"
        reducer_result = {
            "schemaVersion": 1,
            "source": {"phaseSec": 0.1, "loopLenSec": 3.9},
            "tracks": [],
        }

        def ingest_source(**kwargs):
            self.assertIsNone(kwargs["file_path"])
            self.assertEqual(kwargs["youtube_url"], url)
            return IngestedAudio(
                Path(kwargs["work_dir"]) / "youtube.wav", "youtube", url, 20
            )

        def make_clip(_audio, _start, _end, work_dir):
            return Path(work_dir) / "clip.wav"

        with patch.object(
            sidecar_app, "ingest", side_effect=ingest_source
        ), patch.object(
            sidecar_app, "clip", side_effect=make_clip
        ), patch.object(
            sidecar_app, "reduce", return_value=reducer_result
        ) as reduce_mock, patch.object(
            sidecar_app,
            "run_in_threadpool",
            new=AsyncMock(side_effect=self.run_worker),
        ) as threadpool:
            result = await self.call_reduce(None, youtube_url="  " + url + "  ")

        threadpool.assert_awaited_once()
        reduce_mock.assert_called_once()
        self.assertEqual(
            result["source"],
            {
                "type": "youtube",
                "ref": url,
                "clipStart": 1.5,
                "clipEnd": 9.5,
                "phaseSec": 0.1,
                "loopLenSec": 3.9,
            },
        )

    async def test_obvious_junk_is_rejected_before_reduce(self):
        upload = make_upload(b"this is not audio")
        with patch.object(sidecar_app, "run_in_threadpool", new=AsyncMock()) as threadpool:
            with self.assertRaises(HTTPException) as raised:
                await self.call_reduce(upload)
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Upload does not contain recognizable audio.")
        threadpool.assert_not_awaited()

    async def test_oversized_upload_returns_413_before_reduce(self):
        upload = make_upload(WAV_BYTES)
        with patch.object(sidecar_app, "MAX_UPLOAD_BYTES", 12), patch.object(
            sidecar_app, "run_in_threadpool", new=AsyncMock()
        ) as threadpool:
            with self.assertRaises(HTTPException) as raised:
                await self.call_reduce(upload)
        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.detail, "Audio file is too large.")
        threadpool.assert_not_awaited()

    async def test_invalid_or_missing_clip_fields_return_400(self):
        cases = (
            (None, "5", "clip_start is required."),
            ("0", None, "clip_end is required."),
            ("later", "5", "clip_start must be a number."),
            ("5", "5", "clip_end must be greater than clip_start."),
            ("0", "16", "Clip region must be 15 seconds or less."),
        )
        for start, end, detail in cases:
            with self.subTest(start=start, end=end):
                with self.assertRaises(HTTPException) as raised:
                    await self.call_reduce(make_upload(), clip_start=start, clip_end=end)
                self.assertEqual(raised.exception.status_code, 400)
                self.assertEqual(raised.exception.detail, detail)

    async def test_exactly_15_second_clip_is_accepted(self):
        worker = AsyncMock(return_value={"schemaVersion": 1, "source": {}, "tracks": []})
        with patch.object(sidecar_app, "run_in_threadpool", new=worker):
            await self.call_reduce(
                None,
                youtube_url="https://youtu.be/test",
                clip_start="0",
                clip_end="15",
            )
        worker.assert_awaited_once()

    async def test_ambiguous_or_missing_source_returns_400(self):
        cases = (
            (make_upload(), "https://youtu.be/test"),
            (None, None),
            (None, "   "),
        )
        for upload, url in cases:
            with self.subTest(upload=upload is not None, url=url):
                with self.assertRaises(HTTPException) as raised:
                    await self.call_reduce(upload, youtube_url=url)
                self.assertEqual(raised.exception.status_code, 400)
                self.assertEqual(
                    raised.exception.detail,
                    "Provide exactly one audio file or YouTube URL.",
                )
                if upload is not None:
                    self.assertTrue(upload.file.closed)

    async def test_ingest_error_retains_safe_status_and_detail(self):
        for status in (400, 413):
            with self.subTest(status=status), patch.object(
                sidecar_app,
                "ingest",
                side_effect=IngestError("safe failure", status),
            ), patch.object(
                sidecar_app,
                "run_in_threadpool",
                new=AsyncMock(side_effect=self.run_worker),
            ):
                with self.assertRaises(HTTPException) as raised:
                    await self.call_reduce(None, youtube_url="https://youtu.be/test")
            self.assertEqual(raised.exception.status_code, status)
            self.assertEqual(raised.exception.detail, "safe failure")

    async def test_reduce_exception_returns_422_and_cleans_temp_file(self):
        upload = make_upload()
        observed_path = None

        async def fail(_function, path, *_args):
            nonlocal observed_path
            observed_path = path
            raise RuntimeError("decoder exploded")

        with patch.object(
            sidecar_app, "run_in_threadpool", new=AsyncMock(side_effect=fail)
        ):
            with self.assertLogs(sidecar_app.logger, level="ERROR") as logs:
                with self.assertRaises(HTTPException) as raised:
                    await self.call_reduce(upload)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(
            raised.exception.detail,
            "Reduction failed; the audio could not be processed.",
        )
        self.assertIsNotNone(observed_path)
        self.assertFalse(os.path.exists(observed_path))
        self.assertTrue(upload.file.closed)
        self.assertIn("Reduction failed", logs.output[0])


class AppBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def asgi_options(self, origin):
        messages = []
        received = False

        async def receive():
            nonlocal received
            if not received:
                received = True
                return {"type": "http.request", "body": b"", "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message):
            messages.append(message)

        await sidecar_app.app(
            {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.3"},
                "http_version": "1.1",
                "method": "OPTIONS",
                "scheme": "http",
                "path": "/reduce",
                "raw_path": b"/reduce",
                "query_string": b"",
                "headers": [
                    (b"origin", origin.encode("ascii")),
                    (b"access-control-request-method", b"POST"),
                    (b"access-control-request-headers", b"content-type"),
                ],
                "client": ("127.0.0.1", 12345),
                "server": ("127.0.0.1", 8000),
            },
            receive,
            send,
        )
        start = next(message for message in messages if message["type"] == "http.response.start")
        return start["status"], Headers(raw=start["headers"])

    async def test_cors_allows_only_local_vite_origins(self):
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            with self.subTest(origin=origin):
                status, headers = await self.asgi_options(origin)
                self.assertEqual(status, 200)
                self.assertEqual(headers["access-control-allow-origin"], origin)
                self.assertIn("POST", headers["access-control-allow-methods"])

        status, headers = await self.asgi_options("https://example.com")
        self.assertEqual(status, 400)
        self.assertNotIn("access-control-allow-origin", headers)

    def test_script_entry_point_binds_exact_localhost_address(self):
        source = Path(sidecar_app.__file__).read_text(encoding="utf-8")
        tree = ast.parse(source)
        calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "uvicorn"
            and node.func.attr == "run"
        ]
        self.assertEqual(len(calls), 1)
        call = calls[0]
        self.assertEqual(ast.literal_eval(call.args[0]), "sidecar.app:app")
        keywords = {item.arg: ast.literal_eval(item.value) for item in call.keywords}
        self.assertEqual(keywords, {"host": "127.0.0.1", "port": 8000})


if __name__ == "__main__":
    unittest.main()
