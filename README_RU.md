# Deathwatch RU — отдельная система для Foundry VTT

Это отдельная копия системы с идентификатором `deathwatch-ru`. Она может сосуществовать с оригинальной системой `deathwatch`, потому что использует другой ID.

## Важно
Этот пакет **не является полным переводом**. Он содержит исходные файлы Deathwatch и стартовый слой локализации на русский. Предметы, таланты, психические силы, противники, критические эффекты и часть интерфейса ещё требуют перевода и проверки.

## Установка вручную
1. Сделайте резервную копию Foundry.
2. Распакуйте папку `deathwatch-ru` из архива в `Data/systems/`.
3. Убедитесь, что путь выглядит как `Data/systems/deathwatch-ru/system.json`.
4. Перезапустите Foundry. В списке систем появится отдельная система «Warhammer 40,000: Deathwatch — Русская версия».

## Установка через манифест-ссылку в Foundry
Foundry требует, чтобы `system.json` и ZIP-архив были доступны по публичным HTTPS-адресам. В манифесте сейчас стоят заглушки:
- `https://github.com/REPLACE_WITH_YOUR_USERNAME/deathwatch-ru`
- `https://raw.githubusercontent.com/REPLACE_WITH_YOUR_USERNAME/deathwatch-ru/main/system.json`

Чтобы получить рабочую ссылку:
1. Создайте публичный GitHub-репозиторий `deathwatch-ru`.
2. Загрузите **содержимое этой папки** в корень репозитория, включая `system.json`, `lang/`, `module/`, `packs/` и остальные файлы.
3. В `system.json` замените `REPLACE_WITH_YOUR_USERNAME` на свой логин GitHub в полях `url`, `manifest` и `download`.
4. Сохраните изменения и загрузите обновлённый `system.json`.
5. В Foundry откройте **Управление системами → Установить систему**, вставьте URL:
   `https://raw.githubusercontent.com/ВАШ_ЛОГИН/deathwatch-ru/main/system.json`

Не вставляйте URL ZIP-архива в поле манифеста: туда нужен именно адрес `system.json`.

## Структура
Система использует отдельный ID `deathwatch-ru`, поэтому может быть установлена рядом с оригинальной системой. Содержимое и компендии основаны на проекте Deathwatch.
