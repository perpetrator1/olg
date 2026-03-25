"""
Django settings for the OLG Federation Backend.
Reads credentials from .env (or environment variables).
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'federation',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'backend.urls'
WSGI_APPLICATION = 'backend.wsgi.application'

# ── Database ────────────────────────────────────────────────────────────────
# We don't use Django ORM for the federation data — we call Supabase REST API
# directly. A minimal sqlite DB is kept so Django doesn't complain.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ── Supabase (local instance) ─────────────────────────────────────────────
# Django reads the federated_instances table from YOUR Supabase project
# using the service-role key (bypasses RLS so we can read all active nodes).
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
# Fall back to anon key if service key is not provided
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# ── CORS ──────────────────────────────────────────────────────────────────
# Allow the Vite dev server to call our Django API
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
]
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Be more permissive in dev

# ── REST Framework ────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_AUTHENTICATION_CLASSES': [],
}

STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_TZ = True
