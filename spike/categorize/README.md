# Spike: категоризация расходов локальной моделью

Данные — реальные покупки из БД, поэтому лежат в `data/` и не коммитятся. Выгрузка:

```sh
docker exec credit_postgres psql -U postgres -d credit_grace -Atc "select coalesce(json_agg(json_build_object('description', description, 'count', n) order by n desc), '[]') from (select description, count(*) n from purchases where description is not null group by description) t;" > data/descriptions.json
docker exec credit_postgres psql -U postgres -d credit_grace -Atc "select coalesce(json_agg(json_build_object('date', purchase_date, 'description', description) order by purchase_date, created_at), '[]') from purchases where description is not null;" > data/purchases.json
```

`data/gold.json` — ручная разметка `{ categories, labels: { "<нормализованное описание>": ["категория", "допустимая альтернатива"] } }`.

```sh
npm install
node needle.ts                     # Cactus Needle, tool calling с enum категорий
node embed.ts user2|e5             # эмбеддинги: zero-shot, leave-one-out, N подтверждений
node simulate.ts user2|e5          # покупки по дате: правило → модель (порог) → вопрос пользователю
TRANSLIT=1 node simulate.ts user2  # латиница из выписок транслитерируется перед эмбеддингом
```

## Результаты (414 покупок, 106 уникальных описаний)

| Подход | Точность | Время на описание | RSS |
| --- | --- | --- | --- |
| Needle 3 (35 МБ) | 25,5% — на уровне угадывания, confidence ≈ 0,01 | ~3 с, p95 12 с | 285 МБ |
| USER2-small int8 (35 МБ), только названия категорий | 34% | 8 мс | 260 МБ |
| USER2-small, все остальные описания подтверждены | 69% | 8 мс | 260 МБ |
| multilingual-e5-small int8 (118 МБ), то же | 71% | 7 мс | 600 МБ |

Симуляция реального потока, USER2 + транслитерация:

| Режим | По правилу | Спросили | Авто верно | Авто ошибочно |
| --- | --- | --- | --- | --- |
| Только правила, без модели | 308 | 106 | — | — |
| Порог отрыва 0.1 | 308 | 90 | 16 | 0 |
| Порог отрыва 0.05 | 308 | 64 | 37 | 5 |
| Порог отрыва 0.03 | 308 | 51 | 45 | 10 |

## Второй раунд: другие модели и подходы

`node embed.ts frida|granite|ngram|combo:<вес n-грамм>:<модель>`. Модель frida собрана вручную в `models/` (см. ниже).

| Модель | Размер int8 | RSS | Без примеров | 10 / 25 подтверждений | Leave-one-out |
| --- | --- | --- | --- | --- | --- |
| USER2-small | 35 МБ | 260 МБ | 34% | 45,6% / 49,7% | 68% |
| **rubert-mini-frida** | 32 МБ | 230 МБ | **43%** | **53,5% / 59,6%** | 70% |
| granite-embedding-97m-multilingual-r2 | 98 МБ | 520 МБ | 20% | 29,5% / 36% | 52% |
| символьные 3-граммы, без модели | — | — | 36% | 46,3% / 49,9% | 66% |

Симуляция: сколько раз пришлось спросить при близком числе автоматических ошибок (правилами закрыто 308 из 414 во всех вариантах).

| Модель | ~4–5 ошибок | ~6–8 ошибок | ~13 ошибок |
| --- | --- | --- | --- |
| USER2-small | 64 | 60 | — |
| 3-граммы | 65 | 58 | — |
| USER2 + 3-граммы | 65 | 56 | 44 |
| **rubert-mini-frida** | 64 | **50** | **36** |
| frida + 3-граммы | 58 | 57 | 42 |

frida: токенизатор из `sergeyzh/rubert-mini-frida`, ONNX — сторонний экспорт `crazyfrogspb/rubert-mini-frida-onnx` (словарь 83 828 совпадает с матрицей эмбеддингов), квантизация `onnxruntime.quantization.quantize_dynamic(..., QInt8)`. Для продакшена экспортировать самим через `optimum-cli export onnx`.

## Третий раунд: выписки, учитель, дообучение

```sh
node extract.ts <папка с PDF>      # Сбер (кредитка, дебет), Ozon (оба документа), Т-Банк, Kaspi → data/statements.json
node teacher.ts                    # LM Studio на :1234, MODEL=gemma-4-26b-a4b-it@iq3_s → data/teacher.json
node teacher-eval.ts               # учитель против ручной разметки
node prepare-train.ts              # data/train.jsonl (категории) и data/pairs.jsonl (банк ↔ ручной вариант)
.venv/bin/python -I train_pairs.py frida-pairs && .venv/bin/python -I export.py models/local/frida-pairs/st local/frida-pairs-onnx
TRANSLIT=1 node manual-eval.ts frida-pairs   # ручные записи против размеченной банковской истории
```

`.venv`: `torch` (cu130), `setfit`, `sentence-transformers`, `onnxruntime`. `optimum` с transformers 5 не работает, поэтому экспорт через `torch.onnx` в `export.py`.

- Выписки: 882 покупки с 12.2023 по 10.2026, 300 уникальных описаний вместе с базой.
- Учитель Gemma 4 26B-A4B (IQ3_S, часть слоёв на CPU, с рассуждениями): 102/106 совпадений с ручной разметкой, «уверен» — 96/98. Около 13 с на описание.
- Синтетика дословно совпала с 23 из 51 реальной ручной записи; они исключены из обучения.

Ручные записи (55) против размеченной банковской истории:

| Модель | С названиями категорий | Без них |
| --- | --- | --- |
| USER2-small | 38,2% | — |
| frida | 61,8% | 43,6% |
| frida + SetFit по категориям учителя | 50,9% | 43,6% |
| frida + SetFit + названия категорий в обучении | 54,5% | 45,5% |
| **frida + пары банк ↔ ручной вариант (MNRL)** | **70,9%** | **58,2%** |

Симуляция, спросили при близком числе ошибок: frida 64 / 54 (4 / 6 ошибок), frida-pairs 57 / 50. Банковские строки базы были в обучающих парах, так что для них оценка оптимистична.

## Четвёртый раунд: общая модель

Модель из третьего раунда училась на строках из выписок автора: конкретные магазины и ИП. Для других людей
это бесполезно, а коммитить её нельзя. Поэтому учитель сгенерировал общий справочник (`node general.ts`,
432 известных мерчанта в 18 категориях), и frida дообучена только на нём. Результат, порядок обучения и переобучения — в
[`backend/models/frida-categorize/README.md`](../../backend/models/frida-categorize/README.md).

```sh
node general.ts && node prepare-general.ts
.venv/bin/python -I train_pairs.py frida-general-cat pairs-general-cat.jsonl
.venv/bin/python -I export.py models/local/frida-general-cat/st local/frida-general-cat-onnx
CITY=1 TRANSLIT=1 node manual-eval.ts frida-general-cat                       # + холодный старт и справочник
REFERENCE=1 CITY=1 TRANSLIT=1 THRESHOLDS=0.1,0.08,0.06 node simulate.ts frida-general-cat
```

Главный вывод: справочник как стартовые соседи даёт больше, чем дообучение. С ним даже исходная frida
при пороге 0,08 спрашивает 45 раз из 106 без единой ошибки; без справочника — 52 раза при 6 ошибках.
