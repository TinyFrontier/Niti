# Niti

Niti — monorepo приложения для управления поиском работы. Backend построен на
FastAPI, Granian, SQLAlchemy и Alembic; frontend — на React, TypeScript и Vite.
Production-окружение запускается через Docker Compose и Traefik v3.

## Структура

```text
Niti/
├── frontend/                 # React/Vite и production-образ Nginx
├── backend/                  # FastAPI/Granian, Alembic и production-образ
├── infrastructure/
│   ├── compose.yaml
│   ├── postgres/initdb/      # инициализация расширений PostgreSQL
│   └── traefik/              # статическая и динамическая конфигурация
├── .env.example
├── .gitignore
└── README.md
```

## Локальная разработка

Требования: Docker с Compose v2, [uv](https://docs.astral.sh/uv/) и Node.js 20+.

```bash
# Переменные для локальных инфраструктурных контейнеров
cp .env.example .env

# Локальные настройки приложений
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# PostgreSQL слушает только 127.0.0.1
make db-up
make install
make migrate
make seed
```

После этого запустите приложения в двух терминалах:

```bash
make backend   # API: http://localhost:8000, Swagger: http://localhost:8000/docs
make frontend  # UI: http://localhost:5173
```

Тесты и проверки:

```bash
make test
make lint
```

## Запуск всего окружения через Docker Compose

Из корня репозитория:

```bash
cp .env.example .env
docker compose -f infrastructure/compose.yaml up -d --build
```

Backend при старте ждёт готовности PostgreSQL, применяет `alembic upgrade head`,
затем запускает Granian. Frontend собирается с адресом API из `API_HOST` и
отдаётся Nginx. Порты приложений наружу не публикуются: доступ к ним
маршрутизирует Traefik.

Проверить состояние и логи:

```bash
docker compose -f infrastructure/compose.yaml ps
docker compose -f infrastructure/compose.yaml logs -f
```

Остановить окружение без удаления данных:

```bash
docker compose -f infrastructure/compose.yaml down
```

Для удаления именованных volumes и всех данных используйте `down --volumes`
только при осознанной необходимости.

## Сервисы

| Сервис | Назначение | Доступ |
| --- | --- | --- |
| `traefik` | TLS, Let's Encrypt, HTTP → HTTPS, маршрутизация, dashboard | `80`, `443` |
| `frontend` | Собранный React SPA под Nginx | `https://useniti.xyz` |
| `backend` | FastAPI под Granian | `https://api.useniti.xyz` |
| `postgres` | PostgreSQL 16 и `pg_trgm` | внутри сети; локально `127.0.0.1:5432` |

Все сервисы подключены к одной bridge-сети `niti`. PostgreSQL, загруженные файлы
и состояние ACME хранятся в именованных Docker volumes.

Dashboard Traefik доступен по `https://traefik.useniti.xyz` и защищён Basic
Auth. В примере заданы `admin` / `change-me`; перед production-деплоем их нужно
заменить через переменную `TRAEFIK_DASHBOARD_AUTH_USERS`.

## Переменные окружения

Compose читает корневой `.env`. Файл не должен попадать в Git.

| Переменная | Описание |
| --- | --- |
| `FRONTEND_HOST` | публичный домен frontend |
| `API_HOST` | публичный домен API; встраивается в frontend при сборке |
| `TRAEFIK_HOST` | публичный домен dashboard |
| `LETSENCRYPT_EMAIL` | email для ACME/Let's Encrypt |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | настройки PostgreSQL |
| `DATABASE_URL` | SQLAlchemy DSN backend; пароль должен совпадать с `POSTGRES_PASSWORD` |
| `SECRET_KEY` | секрет подписи JWT |
| `TRAEFIK_DASHBOARD_AUTH_USERS` | строка `user:bcrypt-hash` для Basic Auth |
| `BACKEND_WORKERS` | число процессов Granian |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | срок действия access token |
| `POSTGRES_PORT` | локальный loopback-порт PostgreSQL |
| `DOCKER_NETWORK_NAME` | имя общей Docker-сети |

Перед production-деплоем замените все значения `CHANGE_ME`. Надёжные секреты
можно сгенерировать так:

```bash
openssl rand -hex 32                                      # SECRET_KEY
openssl rand -base64 36                                   # пароль PostgreSQL
htpasswd -nbB admin 'strong-dashboard-password'           # Basic Auth
```

Значение с bcrypt-хешем оставляйте в `.env` в одинарных кавычках, чтобы символы
`$` не интерпретировались Compose. Если пароль PostgreSQL содержит специальные
символы URL, URL-кодируйте их в `DATABASE_URL`.

## Production-деплой на VPS

1. Установите Docker Engine и Compose v2. Откройте входящие TCP-порты `80` и
   `443`; PostgreSQL наружу открывать не нужно.
2. Создайте DNS A/AAAA-записи `useniti.xyz`, `api.useniti.xyz` и
   `traefik.useniti.xyz`, указывающие на VPS. Для выпуска сертификатов порт 80
   должен быть доступен из интернета.
3. Клонируйте репозиторий на VPS, выполните `cp .env.example .env`, задайте
   production-секреты, email и домены.
4. Запустите:

   ```bash
   docker compose -f infrastructure/compose.yaml up -d --build
   ```

5. Проверьте `docker compose -f infrastructure/compose.yaml ps`, логи Traefik и
   ответы `https://api.useniti.xyz/health`, `https://useniti.xyz`.

Для обновления получите новую версию кода и повторите `up -d --build`.
Именованные volumes при этом сохраняются. Перед обновлением схемы рекомендуется
сделать резервную копию PostgreSQL; миграции применяются автоматически при
старте backend.

## Маршрутизация и TLS

Traefik использует Docker Provider для обнаружения сервисов и File Provider для
общих security headers/TLS options. Контейнеры без `traefik.enable=true` не
публикуются. HTTP-запросы перенаправляются на HTTPS, а сертификаты Let's Encrypt
получаются через HTTP-01 challenge и сохраняются в volume `traefik_acme`.
