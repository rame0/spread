# Данные и импорт БД

## Куда пишет backend

Backend использует БД из переменной `DATABASE_URL`. В Docker это контейнер `postgres`, база `credit_grace`.
См. корневой файл `.env.example` для обязательных переменных окружения.

Если подключаетесь к БД клиентом и видите пустые таблицы, а в приложении данные есть — вы смотрите **другой экземпляр Postgres**. Подключаться к тем же данным:

- **Всё в Docker:** из контейнера:  
  `docker exec -it credit_postgres psql -U postgres -d credit_grace`
- **Порт 5432 проброшен на хост:** `localhost:5432` — тот же Postgres **только если** на хосте не запущен свой Postgres; иначе вы попадёте в локальную пустую БД.

## Персистентность

Данные Postgres хранятся на хосте в каталоге **`/srv/credit-card-planer/postgres`** и сохраняются при перезапуске контейнеров. Перед первым запуском создайте каталог (например, `sudo mkdir -p /srv/credit-card-planer/postgres` и выставите права для пользователя Docker).

## Импорт из предыдущей БД

Скрипты и SQL-файлы в `data/init/` выполняются контейнером Postgres **только при первом создании БД** (когда каталог `/srv/credit-card-planer/postgres` пустой). Порядок по имени: `01_*.sql`, `02_*.sql`, затем `.sh` и т.д.

### Вариант 1: Старая БД — такой же Postgres (credit_grace)

1. Сделайте полный дамп старой БД (включая схему и таблицу миграций Drizzle):

   ```bash
   pg_dump -h <хост> -U postgres -d credit_grace -F p -f backup.sql
   ```

   Если старая БД на той же машине в другом контейнере:

   ```bash
   docker exec <старый_postgres_контейнер> pg_dump -U postgres -d credit_grace -F p > data/init/01_restore.sql
   ```

2. Положите файл в `data/init/`, например `data/init/01_restore.sql`.

3. Очистите данные на хосте и поднимите стек заново (текущие данные в `/srv/credit-card-planer/postgres` будут заменены импортом):

   ```bash
   docker compose down
   sudo rm -rf /srv/credit-card-planer/postgres/*
   docker compose up -d
   ```

4. После старта Postgres выполнит `01_restore.sql`, затем backend применит недостающие миграции (если появятся новые).

### Вариант 2: Импорт из V1 SQLite

В V1 данные лежали в SQLite: таблицы `purchases` (id, amount, remaining_amount, purchase_date, payment_deadline, paid) и `payments` (id, purchase_id, payment_date, amount). Скрипт переносит покупки в V2 `purchases`, платежи — в V2 `deposits` (через те же сервисы, что и API, ведра грейса считаются корректно). Используется **sql.js** (без нативной сборки); после смены зависимостей выполните `pnpm install` в backend.

1. В V2 зарегистрируйтесь и при необходимости создайте карту. Узнайте `user_id` (UUID) пользователя.
2. Из каталога **backend** (Postgres должен быть поднят, миграции применены):

   ```bash
   # Импорт в новую карту
   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/credit_grace \
     pnpm run import:sqlite -- --sqlite /path/to/credit_card.sqlite --user-id <uuid> --card-name "Моя карта" --report-day 10

   # Импорт в существующую карту
   pnpm run import:sqlite -- --sqlite /path/to/db.sqlite --user-id <uuid> --card-id <uuid карты>
   ```

### Вариант 3: Только данные (схему создаёт backend)

Если у вас уже есть дамп **только данных** (например, `pg_dump --data-only`), то:

1. Сначала поднимите приложение один раз без дампа, чтобы backend создал схему миграциями.
2. Остановите контейнеры и очистите каталог данных на хосте.
3. Положите в `data/init/` скрипт, который создаёт схему (копия миграции) и затем вставляет данные, **или** один раз поднимите без init, затем залейте данные вручную:

   ```bash
   docker compose up -d
   # дождаться готовности backend
   cat your_data_only.sql | docker exec -i credit_postgres psql -U postgres -d credit_grace
   ```

Для одноразового импорта «пустая БД + только данные» удобнее поднять контейнеры, дать миграциям отработать, затем выполнить `psql` с дампом данных, как выше.

## Резервное копирование

Создать дамп текущей БД (пока контейнеры запущены):

```bash
docker exec credit_postgres pg_dump -U postgres -d credit_grace -F p -f - > backup_$(date +%Y%m%d).sql
```

Восстановить позже: положить этот файл в `data/init/` как `01_restore.sql`, очистить `/srv/credit-card-planer/postgres` и снова выполнить `docker compose up -d` (см. выше).
