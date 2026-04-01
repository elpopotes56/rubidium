# Aplicacion de matematicas

Base inicial para una app movil con:

- `React Native + Expo` en frontend
- `Supabase` para auth y PostgreSQL
- `Prisma Client` en backend
- `ElevenLabs` para voz

## Objetivo del modelo de datos

Cada usuario debe tener su historial aislado:

- sus problemas matematicos
- sus soluciones paso a paso
- sus sesiones de voz
- su progreso por tema

La separacion se logra con dos capas:

1. `userId` en las tablas de negocio
2. `Row Level Security` en Supabase usando `auth.uid()`

## Estructura creada

```text
backend/
  src/
  prisma/
    schema.prisma
  package.json
  tsconfig.json
  .env.example
mobile/
  src/
  package.json
  app.json
  .env.example
supabase/
  rls.sql
```

## Tablas principales

- `profiles`: datos publicos del usuario autenticado
- `topics`: catalogo de temas matematicos
- `problems`: historial principal de ejercicios enviados
- `solution_steps`: pasos de resolucion por problema
- `voice_sessions`: sesiones o conversaciones de voz
- `voice_messages`: mensajes dentro de una sesion de voz
- `user_topic_stats`: progreso acumulado por tema

En Supabase estas tablas se crean con prefijo `math_mobile_` para distinguirlas de otros sistemas del mismo proyecto.

Por seguridad, las contrasenas no se guardan en tablas propias de la app. El manejo de credenciales vive en `Supabase Auth`, y para administracion se pueden usar vistas seguras con metadatos del perfil y de sus consultas.

## Flujo recomendado

1. El usuario inicia sesion con Supabase Auth.
2. La app manda el token al backend.
3. El backend valida al usuario.
4. Se guarda cada problema con `userId`.
5. Se guardan pasos, solucion final y metadatos de voz.
6. El historial se consulta filtrado por el usuario actual.

## Nota importante sobre Prisma

`Prisma Client` debe usarse en el backend, no directamente en la app movil.

La app movil puede usar:

- `Supabase Auth`
- `Supabase Storage`
- llamadas HTTP a tu API

## Siguiente paso recomendado

Despues de esta base, lo ideal es continuar con:

- conexion real con tu proyecto de Supabase
- migraciones o `db push` para crear tablas
- autenticacion desde la app movil
- sincronizacion con ElevenLabs para guardar transcript y resumen

## Backend base ya creado

Se dejo un backend inicial en `Node + TypeScript + Express + Prisma`.

Rutas incluidas:

- `GET /health`
- `GET /history/me`
- `GET /history/problems`
- `GET /history/problems/:problemId`
- `POST /history/problems`
- `POST /mixing/solve`

Estas rutas esperan un token `Bearer` de Supabase para identificar al usuario.

`GET /history/me` asegura que exista el perfil del usuario autenticado en `math_mobile_profiles`.
`POST /mixing/solve` resuelve un sistema de mezcla con volumen constante, guarda el desarrollo paso a paso y lo agrega al historial.

## Como arrancarlo

1. Copia `backend/.env.example` a `backend/.env`
2. Coloca tus credenciales reales de Supabase
3. Entra a la carpeta `backend`
4. Ejecuta `npm install`
5. Ejecuta `npx prisma generate`
6. Ejecuta `npm run build`
7. Ejecuta `npm run dev`

## Nota de arquitectura

Por compatibilidad con `Prisma Client`, el backend base se dejo en `Node/TypeScript`.

Si despues quieres motor matematico mas avanzado, puedes agregar:

- un modulo interno en este backend, o
- un microservicio aparte en Python

## Frontend movil base ya creado

Se dejo una base inicial en `Expo + React Native` con:

- login con Supabase
- sesion persistente
- formulario para resolver sistemas de mezcla
- consulta del historial al backend
- pantalla inicial de historial por usuario

Archivos clave:

- `mobile/App.tsx`
- `mobile/src/lib/supabase.ts`
- `mobile/src/lib/api.ts`
- `mobile/src/screens/LoginScreen.tsx`
- `mobile/src/screens/HomeScreen.tsx`

## Como arrancar la app movil

1. Copia `mobile/.env.example` a `mobile/.env`
2. Coloca tu `SUPABASE_URL`, `SUPABASE_ANON_KEY` y la URL del backend
3. Entra a la carpeta `mobile`
4. Ejecuta `npm install`
5. Ejecuta `npm start`

## Conexion entre app y backend

- La app inicia sesion con Supabase
- Supabase entrega un `access_token`
- La app manda ese token al backend en `Authorization: Bearer ...`
- El backend identifica al usuario y devuelve solo su historial
