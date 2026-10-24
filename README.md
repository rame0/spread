# Credit Card Planer

`Credit Card Planer` - это веб-приложение для учёта трат по кредитным картам и планирования погашения в рамках льготного периода.

Проект состоит из двух частей:

- `frontend` - клиентское приложение на React + Vite + TypeScript
- `backend` - API на Express + TypeScript + Drizzle ORM

## Возможности

- регистрация и вход пользователей
- хранение нескольких кредитных карт
- настройка параметров карты и модели льготного периода
- учёт покупок и пополнений
- дашборд с текущим состоянием задолженности
- платёжный план по периодам
- категории трат: правила из подтверждений пользователя и локальная модель
  ([`backend/models/frida-categorize`](backend/models/frida-categorize/README.md)), без внешних сервисов
- план и факт по категориям, предложения статей плана из повторяющихся покупок
- экспорт и импорт данных карты
- интерфейс на русском и английском языках

## Стек

- Frontend: React 19, Vite, TypeScript, MUI, i18next
- Backend: Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL, JWT, Zod, onnxruntime-node
- Инфраструктура: Docker, Docker Compose, Nginx, Traefik

## Структура проекта

```text
.
├── backend/      # API, бизнес-логика, миграции и работа с БД
├── frontend/     # веб-интерфейс
├── docker-compose.yml
├── .env.example
└── LICENSE
```

## Требования

- Node.js `22.3.0`
- `pnpm`
- PostgreSQL 16+ для локального запуска без Docker
- Docker и Docker Compose для контейнерного запуска

## Быстрый запуск через Docker

1. Создайте `.env` на основе примера:

```bash
cp .env.example .env
```

2. Заполните обязательные переменные, как минимум:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_SECRET`

3. Поднимите сервисы:

```bash
docker compose up --build
```

По текущей конфигурации сервисы рассчитаны на работу через `Traefik` и сеть `traefik_net`, а frontend/backend публикуются на хосте `credit.local`.

## Локальный запуск без Docker

### Backend

1. Установите зависимости:

```bash
cd backend
pnpm install
```

2. Создайте `.env` на основе `backend/.env.example`.

3. Подготовьте PostgreSQL и укажите корректный `DATABASE_URL`.

4. Примените схему БД:

```bash
pnpm db:push
pnpm categorize:reference   # пересчитать векторы справочника после смены модели
```

5. Запустите backend:

```bash
pnpm dev
```

По умолчанию API стартует на `http://localhost:3001`.

### Frontend

1. Установите зависимости:

```bash
cd frontend
pnpm install
```

2. Создайте `.env` на основе `frontend/.env.example`.

3. При необходимости задайте адрес API через `VITE_API_BASE_URL`, например:

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

4. Запустите frontend:

```bash
pnpm dev
```

Приложение Vite обычно доступно на `http://localhost:5173`.

## Полезные команды

### Backend

```bash
pnpm dev
pnpm build
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:push
```

### Frontend

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
```

## Переменные окружения

Корневой `.env.example` используется для Docker-сценария и содержит основные настройки:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `BACKEND_PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `JSON_BODY_LIMIT`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_MAX`
- `AUTH_COOKIE_NAME`
- `CSRF_COOKIE_NAME`
- `AUTH_COOKIE_SECURE`
- `CATEGORIZE_MODEL` — `false` отключает модель категорий (точные правила продолжают работать)
- `CATEGORIZE_MIN_MARGIN` — уверенность модели для автоматической категории, по умолчанию `0.1`
- `CATEGORIZE_IDLE_MS` — через сколько мс простоя выгружать модель из памяти, по умолчанию 10 минут

Для локального запуска также есть отдельные примеры:

- `backend/.env.example`
- `frontend/.env.example`

## API

Основные точки входа backend:

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/cards/:cardId/dashboard`
- `GET /api/cards/:cardId/plan`
- `GET /api/cards/:cardId/purchases`
- `POST /api/cards/:cardId/purchases`
- `GET /api/cards/:cardId/deposits`
- `POST /api/cards/:cardId/deposits`
- `PATCH /api/cards/:cardId/settings`
- `GET /api/cards/:cardId/export`
- `POST /api/cards/:cardId/import`
- `PATCH /api/cards/:cardId/purchases/:purchaseId/category`
- `GET /api/categories`, `POST /api/categories`, `PATCH /api/categories/:categoryId`, `DELETE /api/categories/:categoryId`
- `GET /api/categories/suggest?text=`
- `GET /api/categories/uncategorized`
- `POST /api/categories/backfill`
- `GET /api/plan/suggestions`, `POST /api/plan/suggestions/dismiss`
- `GET /api/plan/categories?month=YYYY-MM`

## Лицензия

Проект распространяется по лицензии [MIT](./LICENSE).
