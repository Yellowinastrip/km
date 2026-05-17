# Публікація K + M

## Що потрібно зробити з вашого боку

1. Створити проєкт у Supabase.
2. У Supabase SQL Editor виконати `SUPABASE_SETUP.sql`.
3. У Supabase Auth створити двох користувачів з реальними email/password.
4. Для користувача Каті додати `app_metadata`: `{ "person": "katya" }`.
5. Для користувача Микити додати `app_metadata`: `{ "person": "mykyta" }`.
6. Скопіювати з Supabase:
   - Project URL
   - anon/public key
   - service_role key
   - user id Каті
   - user id Микити
7. Створити Vercel project з цього репозиторію.
8. У Vercel Settings -> Environment Variables додати:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_KATYA_USER_ID`
   - `SUPABASE_MYKYTA_USER_ID`
   - `ADMIN_API_TOKEN`

`SUPABASE_SERVICE_ROLE_KEY` і `ADMIN_API_TOKEN` ніколи не можна додавати у frontend-код.

## Як працює сайт

- Якщо `/api/config` повертає Supabase URL і anon key, сайт працює в онлайн-режимі.
- Якщо Supabase не налаштовано, сайт автоматично працює в локальному демо-режимі.
- В онлайн-режимі вхід відбувається через Supabase Auth email/password.
- Поточний користувач визначається з `app_metadata.person`.
- Історія настроїв зберігається в `public.mood_entries`.
- Realtime оновлення приходять через Supabase Realtime.

## Admin API

Усі admin-запити мають містити заголовок:

```http
Authorization: Bearer <ADMIN_API_TOKEN>
```

Отримати історію:

```bash
curl -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  https://your-domain.vercel.app/api/admin/moods
```

Додати настрій:

```bash
curl -X POST https://your-domain.vercel.app/api/admin/moods \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "person": "katya",
    "categoryId": "uplift",
    "categoryTitle": "Піднесення",
    "mood": "Радість",
    "emoji": "😌"
  }'
```

Видалити настрій:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  "https://your-domain.vercel.app/api/admin/moods?id=<mood-id>"
```

## Локальна розробка

Без Supabase/Vercel:

```bash
python3 -m http.server 8080
```

Відкрити `http://localhost:8080`. У демо-режимі пароль `K` входить як Катя, `M` входить як Микита.

З Supabase локально можна створити файл `config.local.js`:

```js
window.KM_SUPABASE_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY",
};
```

і підключити його тимчасово перед `app.js` у `index.html`. Не комітьте цей файл.
