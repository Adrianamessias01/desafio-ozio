import os
import tempfile
from pathlib import Path
from unittest import mock

from django.test import SimpleTestCase

from core.env import load_env_file


class LoadEnvFileTests(SimpleTestCase):
    def write(self, content: str) -> Path:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        path = Path(directory.name) / ".env"
        path.write_text(content, encoding="utf-8")
        return path

    def test_loads_values_ignoring_comments_and_quotes(self):
        path = self.write('# comentário\nOZIO_A=1\n\nOZIO_B="com espaço"\ninvalida\n')

        with mock.patch.dict(os.environ, {}, clear=True):
            load_env_file(path)
            self.assertEqual(os.environ["OZIO_A"], "1")
            self.assertEqual(os.environ["OZIO_B"], "com espaço")
            self.assertNotIn("invalida", os.environ)

    def test_existing_environment_wins(self):
        path = self.write("OZIO_A=do-arquivo\n")

        with mock.patch.dict(os.environ, {"OZIO_A": "do-ambiente"}, clear=True):
            load_env_file(path)
            self.assertEqual(os.environ["OZIO_A"], "do-ambiente")

    def test_missing_file_is_ignored(self):
        load_env_file(Path("/caminho/que/nao/existe/.env"))
