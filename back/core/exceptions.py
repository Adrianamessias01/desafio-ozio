"""
Erros de regra de negócio e sua tradução para respostas HTTP.

As camadas de serviço levantam `DomainError` sem conhecer HTTP; o handler abaixo
converte esses erros em respostas no mesmo formato das exceções do DRF
(`{"detail": ..., "code": ...}`), para o front-end tratar tudo de um jeito só.
"""

from rest_framework.response import Response
from rest_framework.views import exception_handler


class DomainError(Exception):
    status_code = 400
    code = "domain_error"
    default_message = "Operação não permitida."

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response({"detail": exc.message, "code": exc.code}, status=exc.status_code)
    return exception_handler(exc, context)
