# Расклад

Личные финансы в одном месте: деньги на счетах, долги, план и капитал. Начинался как планировщик
погашения кредиток в льготный период (отсюда имя репозитория `credit-card-planer`) и вырос в учёт
всего, что влияет на свободные деньги.

![Обзор](docs/screenshots/overview.png)

<sub>Скриншоты сняты на демо-данных.</sub>

## Возможности

**Обзор.** Свободные деньги и их прогноз, платежи на 30 дней вперёд, деньги по месяцам (прогноз и
план-факт), долги, капитал, траты по картам, исполнение плана месяца и то, что требует внимания.

**Деньги.** Счета: дебетовые, наличные, накопительные, вклады, брокерские, недвижимость.
Остатки вносятся снимками, в том числе по нескольким счетам сразу. Валютные счета пересчитываются
по курсу ЦБ. Проценты по накопительным счетам и вкладам считаются по дневному остатку с учётом
выплат, смены ставки и сверки; для них есть прогноз и оценка НДФЛ с процентов по ключевой ставке.
Счёт можно отметить резервом под долг по картам.

**Долги.**
- Кредитные карты с моделями льготного периода по отчётным периодам (в том числе Ozon и Сбер),
  минимальными платежами и стратегией погашения «как можно позже» или «равномерно».
- Карты рассрочки («Сплит» и подобные) с графиком платежей по каждой покупке.
- Ипотека: график, досрочные платежи с уменьшением срока или платежа, смена ставки, сверка,
  просрочка, отметка «оплачено до».
- Сверка долга по карте и импорт PDF-выписок.

**План.** Статьи доходов, расходов и переводов с периодичностью, прогноз денежного потока на
3–24 месяца с учётом платежей по долгам, план и факт по категориям, предложения статей из
повторяющихся покупок.

**Категории трат.** Правила из подтверждений пользователя и локальная модель
([`backend/models/frida-categorize`](backend/models/frida-categorize/README.md)), без внешних сервисов.

**Капитал.** Активы минус долги с историей по месяцам, недвижимость за вычетом ипотеки.

**Интеграции.** Т-Инвестиции: портфели синхронизируются по read-only токену. Токен хранится
зашифрованным ключом, выведенным из `JWT_SECRET`: после смены секрета его нужно ввести заново.

Ещё: экспорт и импорт данных карты, светлая, тёмная и системная темы, мобильная вёрстка,
интерфейс на русском и английском.

<table>
  <tr>
    <td><img src="docs/screenshots/card.png" alt="Кредитная карта"></td>
    <td><img src="docs/screenshots/mortgage.png" alt="Ипотека"></td>
  </tr>
  <tr>
    <td align="center">Кредитка: график и рекомендуемые платежи</td>
    <td align="center">Ипотека: график по годам</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/plan.png" alt="План"></td>
    <td><img src="docs/screenshots/accounts.png" alt="Деньги"></td>
  </tr>
  <tr>
    <td align="center">План: прогноз свободных денег</td>
    <td align="center">Деньги: счета и проценты</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/capital.png" alt="Капитал"></td>
    <td align="center"><img src="docs/screenshots/mobile-dark.png" alt="Обзор на телефоне" width="300"></td>
  </tr>
  <tr>
    <td align="center">Капитал</td>
    <td align="center">Телефон, тёмная тема</td>
  </tr>
</table>

## Стек

- Frontend: React 19, Vite, TypeScript, MUI, i18next
- Backend: Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL, JWT, Zod, onnxruntime-node
- Инфраструктура: Docker, Docker Compose, Nginx, Traefik

## Структура проекта

```text
.
├── backend/
│   ├── src/        # API (http/), бизнес-логика (domain/, services/), работа с БД
│   ├── drizzle/    # миграции
│   ├── models/     # модель категорий трат
│   └── scripts/    # служебные скрипты
├── frontend/       # веб-интерфейс
├── spike/          # исследования (обучение модели категорий)
├── docker-compose.yml
└── .env.example
```

## Требования

- Node.js 22 (для локальной разработки версия закреплена в `volta`)
- `pnpm`
- PostgreSQL 16+ для запуска без Docker
- Docker и Docker Compose для контейнерного запуска

## Запуск через Docker

```bash
cp .env.example .env   # задайте POSTGRES_PASSWORD, DATABASE_URL и JWT_SECRET
docker compose up --build
```

Сервисы рассчитаны на работу за `Traefik` во внешней сети `traefik_net` и публикуются на хосте
`credit.local`. Данные Postgres лежат на хосте в `/srv/credit-card-planer/postgres`.
SQL-файлы и дампы из `data/init/` выполняются только при первом создании базы: чтобы залить дамп
заново, удалите каталог данных Postgres и поднимите сервисы ещё раз.

В контейнер backend передаются только `DATABASE_URL`, `JWT_SECRET` и `BACKEND_PORT` (как `PORT`);
остальные переменные из таблицы ниже нужно добавить в `environment` в `docker-compose.yml`.

## Локальный запуск без Docker

### Backend

```bash
cd backend
pnpm install
cp .env.example .env   # укажите DATABASE_URL своей базы
env $(grep -v '^#' .env | xargs) pnpm dev
```

Backend не читает `.env` сам: переменные берутся из окружения, отсюда `env $(…)` в примере.
Без них используется база `postgresql://postgres:postgres@localhost:5432/credit_grace`.
Миграции применяются при старте, отдельно готовить схему не нужно. API слушает
`http://localhost:3001`.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Приложение открывается на `http://localhost:3000`, запросы к `/api` Vite проксирует на
`http://localhost:3001`.

## Команды

### Backend

```bash
pnpm dev                    # разработка с перезапуском
pnpm build && pnpm start    # сборка и запуск собранного
pnpm test
pnpm lint
pnpm db:generate            # миграция из изменений в src/db/schema.ts
pnpm db:migrate             # применить миграции без запуска сервера
pnpm categorize:reference   # пересчитать векторы справочника категорий после смены модели
pnpm cards:rebalance        # перераспределить платежи по картам после импорта задним числом
pnpm import:sqlite -- --sqlite db.sqlite --user-id <uuid> --card-name "Карта" --report-day 10
                            # перенос данных из первой версии на SQLite
```

### Frontend

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

## Переменные окружения backend

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | локальная `credit_grace` | строка подключения к Postgres; в `production` обязательна |
| `JWT_SECRET` | dev-секрет | секрет JWT и ключ шифрования токенов интеграций; в `production` обязателен |
| `PORT` | `3001` | порт API |
| `NODE_ENV` | `development` | |
| `CORS_ORIGINS` | `localhost:3000` и `credit.local` | разрешённые origin через запятую |
| `JSON_BODY_LIMIT` | `256kb` | лимит тела запроса |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | `900000`, `500` | общий лимит запросов |
| `AUTH_RATE_LIMIT_MAX` | `20` | лимит запросов к `/api/auth` |
| `AUTH_COOKIE_NAME`, `CSRF_COOKIE_NAME` | `grace_planner_auth`, `grace_planner_csrf` | имена cookie сессии и CSRF |
| `AUTH_COOKIE_SECURE` | `auto` | `auto` — secure-cookie только по HTTPS |
| `CATEGORIZE_MODEL` | `true` | `false` отключает модель категорий, точные правила продолжают работать |
| `CATEGORIZE_MIN_MARGIN` | `0.1` | уверенность модели для автоматической категории |
| `CATEGORIZE_IDLE_MS` | 10 минут | через сколько мс простоя выгружать модель из памяти |

Для Docker в корневом `.env` также задаются `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
и `BACKEND_PORT`.

## API

Все маршруты, кроме `/health`, регистрации и входа, требуют сессии в cookie. Изменяющие запросы
ещё передают CSRF-токен из cookie в заголовке `x-csrf-token`.

| Префикс | Что там |
| --- | --- |
| `/health` | состояние API и БД |
| `/api/auth` | регистрация, вход, выход, текущий пользователь |
| `/api/cards` | карты, покупки, платежи, график, сверки, импорт выписок, экспорт и импорт |
| `/api/mortgages` | ипотеки, график, платежи и события |
| `/api/accounts` | счета, остатки, события накоплений, проценты, налог, портфели |
| `/api/integrations` | подключение и синхронизация Т-Инвестиций |
| `/api/dashboard` | данные обзора: капитал, платежи, графики |
| `/api/plan` | статьи плана, прогноз, предложения, план и факт по категориям |
| `/api/categories` | категории, подсказка категории, разметка покупок |

Маршруты и схемы запросов — в `backend/src/http/`.

## Лицензия

[MIT](./LICENSE).
