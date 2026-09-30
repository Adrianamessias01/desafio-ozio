"""
Configuração do projeto.

Todos os valores dependentes de ambiente vêm de variáveis de ambiente
(ver `.env.example`), de modo que o mesmo código roda em desenvolvimento,
testes e produção.
"""

import os
import sys
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from core.env import load_env_file

BASE_DIR = Path(__file__).resolve().parent.parent

load_env_file(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DEBUG")

SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("A variável de ambiente SECRET_KEY é obrigatória.")
    SECRET_KEY = "insecure-dev-only-key"

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "drf_spectacular",
    "core",
    "crm",
    "erp",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


DATABASES = {
    "default": dj_database_url.config(
        default="postgres://ozio:ozio@localhost:5432/ozio",
        conn_max_age=60,
        conn_health_checks=True,
    )
}


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# O front-end (SSR) autentica com token: faz login em /api/auth/login/, guarda o
# token em cookie httpOnly e o envia no header Authorization. O navegador nunca
# fala direto com a API.

# Senha dos vendedores de exemplo criados pelo comando `seed` (só desenvolvimento).
SEED_PASSWORD = os.environ.get("SEED_PASSWORD", "ozio1234")

REST_FRAMEWORK = {
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        *(["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    ],
    "COERCE_DECIMAL_TO_STRING": True,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Limite de tentativas de login por IP, contra adivinhação de senha.
    "DEFAULT_THROTTLE_RATES": {"login": os.environ.get("LOGIN_RATE", "10/min")},
}

# Documentação interativa da API em /api/docs/ (Swagger) e esquema em /api/schema/.
SPECTACULAR_SETTINGS = {
    "TITLE": "Pipeline Comercial — API",
    "DESCRIPTION": (
        "CRM (oportunidades, clientes, estágios e conversão) e ERP (pedidos). "
        "Faça login em POST /api/auth/login/ e use o token em Authorize: `Token <token>`."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {"StageEnum": "crm.stages.Stage"},
}


# ---------- ERP (ver erp/services.py e erp/api_views.py) ----------
# Lado CRM: qual implementação usar. No docker-compose é o cliente HTTP do serviço ERP;
# o padrão local (sem HTTP) atende os testes e a execução sem Docker.
ERP_GATEWAY = os.environ.get("ERP_GATEWAY", "erp.services.LocalErpGateway")
ERP_BASE_URL = os.environ.get("ERP_BASE_URL", "http://localhost:8001/erp-api")
ERP_API_KEY = os.environ.get("ERP_API_KEY", "")
ERP_TIMEOUT = float(os.environ.get("ERP_TIMEOUT", "5"))
ERP_RETRIES = int(os.environ.get("ERP_RETRIES", "2"))

# Lado ERP: o container do ERP liga a própria API e pode simular problemas.
ERP_SERVE_API = env_bool("ERP_SERVE_API")
ERP_SIMULATE_FAILURE = env_bool("ERP_SIMULATE_FAILURE")
ERP_SIMULATE_LATENCY_MS = int(os.environ.get("ERP_SIMULATE_LATENCY_MS", "0"))

# Testes sempre com o ERP local e sem simulações, mesmo rodando dentro de um container
# configurado para HTTP. O cliente HTTP tem testes próprios (erp/tests/test_http.py).
if sys.argv[1:2] == ["test"]:
    ERP_GATEWAY = "erp.services.LocalErpGateway"
    ERP_SERVE_API = ERP_SIMULATE_FAILURE = False
    ERP_SIMULATE_LATENCY_MS = 0


# Produção (DEBUG desligado): cookies só por HTTPS e cabeçalhos de segurança.
# Conferir com `python manage.py check --deploy`.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
