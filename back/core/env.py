import os
from pathlib import Path


def load_env_file(path: Path) -> None:
    """
    Carrega um arquivo .env simples (CHAVE=valor) para rodar fora do Docker.

    Variáveis já definidas no ambiente têm prioridade, então o docker-compose e o
    deploy continuam mandando.
    """
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))
