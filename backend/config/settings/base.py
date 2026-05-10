"""
Base Django settings shared across all environments.
Environment-specific settings live in dev.py and prod.py.
"""
from pathlib import Path
from datetime import timedelta
from decouple import config

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/

# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------
SECRET_KEY = config('SECRET_KEY', default='change-me-in-production')
DEBUG = False
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='', cast=lambda v: [s.strip() for s in v.split(',')])

# ---------------------------------------------------------------------------
# Application definition
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'auditlog',
    'drf_spectacular',
]

LOCAL_APPS = [
    'apps.core',
    'apps.accounts',
    'apps.camps',
    'apps.children',
    'apps.health_records',
    'apps.vaccinations',
    'apps.ml_engine',
    'apps.notifications',
    'apps.consultations',
    'apps.referrals',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'auditlog.middleware.AuditlogMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.ZoneScopeMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='ikibondo'),
        'USER': config('DB_USER', default='ikibondo'),
        'PASSWORD': config('DB_PASSWORD', default='ikibondo'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Custom user model
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.CustomUser'

AUTHENTICATION_BACKENDS = [
    'apps.accounts.auth_backends.PhoneOrEmailBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Kigali'
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static & Media files
# ---------------------------------------------------------------------------
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    # Required for drf-spectacular to generate the OpenAPI schema
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Rate limiting — auth endpoints use stricter limits
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '300/minute',
        'auth_login': '10/minute',
        'auth_otp': '3/hour',
    },
}

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:3000,http://localhost:5173',
    cast=lambda v: [s.strip() for s in v.split(',')]
)

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Africa/Kigali'

# Celery Beat schedule for recurring tasks (all times in Africa/Kigali = UTC+2)
from celery.schedules import crontab
CELERY_BEAT_SCHEDULE = {
    # Vaccination reminders: 7-day, 3-day, 1-day, same-day windows
    # Runs at 08:00 Kigali — parents read phones in the morning
    'send-vaccination-reminders-daily': {
        'task': 'apps.notifications.tasks.daily_vaccination_reminder',
        'schedule': crontab(hour=8, minute=0),
    },
    # Overdue alerts: marks MISSED + sends alerts for 1/7/14/21 days overdue
    # Runs at 00:30 so MISSED status is set before the morning reminder run
    'compute-overdue-vaccines-daily': {
        'task': 'apps.notifications.tasks.compute_overdue_vaccines',
        'schedule': crontab(hour=0, minute=30),
    },
    # Zone KPI digest to supervisors
    'daily-zone-summary': {
        'task': 'apps.notifications.tasks.daily_zone_summary',
        'schedule': crontab(hour=18, minute=0),
    },
    # Purge deletion-requested children after grace period
    'purge-scheduled-child-deletions': {
        'task': 'children.purge_scheduled_deletions',
        'schedule': crontab(hour=2, minute=0),
    },
    # Vaccination dropout ML scoring — runs after overdue detection so MISSED
    # counts are up-to-date; scores upcoming doses and flags HIGH-risk children
    # to their assigned CHW before the 08:00 parent reminder run.
    'vaccination-dropout-scoring': {
        'task': 'apps.vaccinations.tasks.send_vaccination_reminders',
        'schedule': crontab(hour=1, minute=0),
    },
}

# External service credentials (populated via environment variables)
AFRICASTALKING_USERNAME = config('AFRICASTALKING_USERNAME', default='')
AFRICASTALKING_API_KEY = config('AFRICASTALKING_API_KEY', default='')
FCM_SERVER_KEY = config('FCM_SERVER_KEY', default='')

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Ikibondo <noreply@ikibondo.rw>')
SERVER_EMAIL = config('SERVER_EMAIL', default='noreply@ikibondo.rw')
EMAIL_TIMEOUT = 10
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')

# ---------------------------------------------------------------------------
# ML Models directory
# ---------------------------------------------------------------------------
ML_MODELS_DIR = BASE_DIR.parent / 'ml' / 'models'

# ---------------------------------------------------------------------------
# OpenAPI / Swagger (drf-spectacular)
# ---------------------------------------------------------------------------
SPECTACULAR_SETTINGS = {
    'TITLE': 'Ikibondo API',
    'DESCRIPTION': 'AI-driven child health monitoring for refugee camps in Rwanda.',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ---------------------------------------------------------------------------
# Auditlog
# ---------------------------------------------------------------------------
AUDITLOG_INCLUDE_ALL_MODELS = False  # We register explicitly in apps
