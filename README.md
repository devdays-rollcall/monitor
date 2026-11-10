# Маршруты группы

Приложение принимает события участников через HTTP API и показывает их маршруты на карте. API подтверждает приём после публикации в NATS JetStream; worker сохраняет данные в PostgreSQL.

## Запуск

Нужны Docker с Compose и Make. Из корня проекта запустите:

```bash
make up
```

При первом запуске в другом терминале примените миграцию вручную после готовности PostgreSQL:

```bash
docker compose exec -T postgres psql -U user -d monitordb -v ON_ERROR_STOP=1 < backend/migrations/001_init.sql
```

При повторном запуске существующего тома миграцию повторять не нужно. Сайт и API доступны через Nginx на `http://localhost:8080`. PostgreSQL и NATS хранят данные в Docker volumes.

Пользователь базы: `user`, пароль: `password`. Приложение использует HTTP: токен и координаты передаются без шифрования.

Число экземпляров API и worker можно изменить после сборки:

```bash
docker compose up -d --no-build --scale api=2 --scale worker=2
```

JetStream хранит и обработанные сообщения: размер его тома будет расти, поэтому за свободным местом нужно следить.

## Демонстрационные данные

В другом терминале выполните:

```bash
python3 scripts/demo.py
```

Скрипт отправляет маршруты трёх участников, повторяет пачку и печатает токен. Вставьте токен на сайте после обработки событий worker. Для другого адреса API задайте `MONITOR_URL`.

## API

Контракт находится в `openapi.yaml`. Java DTO и клиент frontend генерируются при сборке. Токен создаётся из 32 случайных байтов и кодируется в base64url без padding.

```bash
curl -X POST http://localhost:8080/api/v1/events \
  -H 'Authorization: Bearer <group_token>' \
  -H 'Content-Type: application/json' \
  -d '{"sender_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1","events":[]}'
```

```bash
curl 'http://localhost:8080/api/v1/events?limit=500' \
  -H 'Authorization: Bearer <group_token>'
```

`202 Accepted` подтверждает публикацию в очередь; события становятся доступны для чтения после обработки worker.

## Разработка

Backend использует JDK 25 и Gradle Wrapper; форматирование выполняется командой `backend/gradlew -p backend spotlessApply`. Frontend использует Node.js 24 и pnpm. В каталоге `frontend/` команда `pnpm build` генерирует клиент и собирает статические файлы.

Для проверки backend выполните `backend/gradlew -p backend test`. При запущенном стеке `python3 -m unittest discover -s tests -v` проверяет HTTP API; с `MONITOR_FAULT_TESTS=1` проверяются также восстановление после остановки PostgreSQL, NATS и worker. Проверки создают группы в текущей базе; проверки восстановления временно останавливают и запускают контейнеры.

Для браузерных тестов установите зависимости в `frontend/` командой `pnpm install`, затем выполните `pnpm exec playwright install chromium` и `pnpm test:e2e` при запущенном стеке.
