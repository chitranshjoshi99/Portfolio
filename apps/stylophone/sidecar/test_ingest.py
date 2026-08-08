import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sidecar.ingest import IngestError, IngestedAudio, clip, ingest


def make_wav(path, seconds=1, rate=8000):
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(b"\0\0" * rate * seconds)


class IngestTests(unittest.TestCase):
    def test_local_wav_is_validated_and_copied(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.wav"
            work = (Path(tmp) / "request").resolve()
            make_wav(source)
            audio = ingest(file_path=source, filename="beat.wav", mime_type="audio/wav", work_dir=work)
            self.assertEqual(audio.source_type, "file")
            self.assertEqual(audio.source_ref, "beat.wav")
            self.assertEqual(audio.path, work / "source.wav")
            self.assertAlmostEqual(audio.duration, 1.0)

    @patch("sidecar.ingest._audio_info")
    def test_local_mp3_accepts_soundfile_format_name(self, audio_info):
        audio_info.return_value = (SimpleNamespace(format="MP3"), 1.0)
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.mp3"
            source.write_bytes(b"ID3" + b"\0" * 9)
            work = (Path(tmp) / "request").resolve()

            audio = ingest(file_path=source, filename="beat.mp3", mime_type="audio/mpeg", work_dir=work)

            self.assertEqual(audio.path, work / "source.mp3")
            self.assertEqual(audio.source_ref, "beat.mp3")

    def test_rejects_ambiguous_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.wav"
            make_wav(source)
            with self.assertRaises(IngestError):
                ingest(file_path=source, youtube_url="https://youtu.be/abc", work_dir=tmp)

    def test_rejects_bad_header_and_mime(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.wav"
            source.write_bytes(b"not audio")
            with self.assertRaises(IngestError):
                ingest(file_path=source, filename="input.wav", mime_type="audio/wav", work_dir=Path(tmp) / "a")
            make_wav(source)
            with self.assertRaises(IngestError):
                ingest(file_path=source, filename="input.wav", mime_type="text/plain", work_dir=Path(tmp) / "b")

    @patch("sidecar.ingest.subprocess.run")
    def test_youtube_uses_safety_flags(self, run):
        with tempfile.TemporaryDirectory() as tmp:
            work = (Path(tmp) / "request").resolve()
            work.mkdir()
            make_wav(work / "youtube.wav")
            audio = ingest(youtube_url="https://youtu.be/video123", work_dir=work)
            run.assert_called_once_with([
                sys.executable, "-m", "yt_dlp",
                "--no-playlist", "--max-filesize", "50M",
                "--match-filter", "duration <= 1800", "--format", "bestaudio",
                "--extract-audio", "--audio-format", "wav",
                "--output", str(work / "youtube.%(ext)s"),
                "https://youtu.be/video123",
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(audio.source_type, "youtube")

    def test_rejects_playlist_and_foreign_host(self):
        with tempfile.TemporaryDirectory() as tmp:
            for url in ("https://youtube.com/watch?v=x&list=PL1", "https://youtube.com.evil/watch?v=x"):
                with self.subTest(url=url), self.assertRaises(IngestError):
                    ingest(youtube_url=url, work_dir=tmp)

    def test_clip_creates_mono_44100_wav(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.wav"
            work = Path(tmp) / "request"
            make_wav(source, seconds=2)
            audio = ingest(file_path=source, filename="input.wav", mime_type="audio/wav", work_dir=work)
            output = clip(audio, 0, 1, work)
            with wave.open(str(output), "rb") as result:
                self.assertEqual(result.getnchannels(), 1)
                self.assertEqual(result.getframerate(), 44100)
                self.assertLessEqual(result.getnframes() / result.getframerate(), 1.01)

    def test_clip_rejects_long_or_out_of_bounds_range(self):
        audio = IngestedAudio(Path("unused.wav"), "file", "unused.wav", 20)
        with tempfile.TemporaryDirectory() as tmp:
            for start, end in ((0, 16), (10, 21), (-1, 1)):
                with self.subTest(start=start, end=end), self.assertRaises(IngestError):
                    clip(audio, start, end, tmp)

    @patch("sidecar.ingest.subprocess.run", side_effect=FileNotFoundError)
    def test_missing_tool_is_safe_error(self, _run):
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp)
            make_wav(work / "youtube.wav")
            with self.assertRaises(IngestError) as caught:
                ingest(youtube_url="https://youtu.be/video123", work_dir=work)
            self.assertEqual(caught.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
