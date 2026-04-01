# Rubidium Math App

Aplicacion educativa enfocada en la resolucion de problemas de sistemas de mezcla, con historial por usuario, autenticacion y experiencia movil.

El proyecto combina una app movil en Expo/React Native con un backend en Node.js y una base de datos en Supabase. Tambien integra una capa pensada para experiencias de voz con ElevenLabs.

## Demo Scope

- Inicio de sesion con Supabase Auth
- Resolucion de ejercicios de mezcla con pasos intermedios
- Historial personalizado por usuario
- Backend con rutas protegidas por token
- Base preparada para experiencias de voz y seguimiento de progreso

## Stack

- Mobile: React Native, Expo, TypeScript
- Backend: Node.js, Express, TypeScript
- Database/Auth: Supabase, PostgreSQL, Row Level Security
- ORM: Prisma
- Voice: ElevenLabs

## Architecture

```text
mobile/     -> app movil para autenticacion, resolucion e historial
backend/    -> API para resolver ejercicios y persistir datos
supabase/   -> scripts SQL, vistas administrativas y politicas RLS
elevenlabs/ -> base de conocimiento para la experiencia de voz
```

Flujo principal:

1. El usuario inicia sesion en la app movil con Supabase.
2. La app obtiene un `access_token`.
3. El token se envia al backend en `Authorization: Bearer ...`.
4. El backend valida al usuario y guarda sus ejercicios.
5. El historial se consulta de forma aislada por usuario.

## Main Features

### Mobile App

- Login y persistencia de sesion
- Pantalla principal con historial
- Resolucion de problemas de mezcla
- Navegacion a detalle de ejercicios
- Base preparada para interacciones por voz

### Backend API

- `GET /health`
- `GET /history/me`
- `GET /history/problems`
- `GET /history/problems/:problemId`
- `POST /history/problems`
- `POST /mixing/solve`

## Data Model

El proyecto esta diseñado para mantener el historial academico aislado por usuario.

Tablas principales:

- `profiles`
- `topics`
- `problems`
- `solution_steps`
- `voice_sessions`
- `voice_messages`
- `user_topic_stats`

La separacion de datos se apoya en:

- `userId` en las tablas de negocio
- politicas de `Row Level Security` con `auth.uid()`

## Local Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npm run dev
```

### Mobile

```bash
cd mobile
cp .env.example .env
npm install
npm start
```

## Environment Notes

- `backend/.env` y `mobile/.env` no se suben al repositorio
- para probar en telefono fisico, la app movil debe apuntar a la IP local de tu equipo o usar la deteccion de host en desarrollo

## Why This Project Matters

Este proyecto muestra trabajo full stack con enfoque en producto:

- diseno de experiencia movil
- backend tipado con Express y Prisma
- integracion con Supabase Auth
- modelado de datos con seguridad por usuario
- preparacion para funciones de voz y aprendizaje asistido

## Roadmap

- mejorar el contenido visual del repositorio con capturas o GIFs
- agregar tests para la logica matematica y rutas del backend
- publicar una build instalable de la app movil
- ampliar los tipos de problemas matematicos soportados

## Repository

- GitHub: `https://github.com/elpopotes56/aplicacion-de-matematicas`
