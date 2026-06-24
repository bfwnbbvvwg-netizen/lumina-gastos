# Lumina

Lumina es una PWA para registrar gastos personales con una experiencia clara y proactiva. El proyecto sigue la arquitectura propuesta: React, Tailwind CSS y Supabase como base de autenticacion, datos y alertas.

## Ejecutar

```bash
npm install
npm run dev
```

## Produccion y PWA

```bash
npm run build
npm run preview
```

El build genera iconos PNG desde `scripts/generate-icons.mjs`, copia el manifiesto y deja un service worker listo para cachear la app compilada. En desarrollo, el service worker se desactiva para evitar cache viejo mientras iteras.

Para probar instalacion en iOS:

- despliega `dist` en un dominio HTTPS
- abre Lumina en Safari
- usa Compartir > Agregar a pantalla de inicio
- abre desde el icono instalado para validar modo standalone

Para desplegar en Vercel o Cloudflare Pages, revisa `DEPLOY.md`.

## Variables de entorno

Crea un archivo `.env.local` si vas a conectar Supabase:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

Puedes copiar `.env.example` como punto de partida. Reinicia el servidor de Vite despues de cambiar estas variables.

## Base de datos

El esquema inicial esta en `supabase/schema.sql` e incluye:

- `profiles`
- `categories`
- `transactions`
- `alerts`
- `recurring_expenses`
- politicas RLS por usuario
- trigger para alertar cuando un gasto supera el mayor gasto semanal previo
- trigger para alertar al llegar al 80% del presupuesto mensual
- trigger para crear perfil y categorias base al registrar un usuario
- vista `monthly_spending`
- vista `monthly_recurring_commitments`

## Flujo Supabase

La app funciona en modo demo si no hay variables de entorno. Si `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` existen, `src/services/transactions.js` intenta usar la sesion actual de Supabase para:

- mostrar login y registro con Supabase Auth
- leer transacciones reales
- resolver o crear la categoria elegida
- insertar el gasto desde el modal de registro rapido

Sin variables de entorno, Lumina entra directo al dashboard con datos simulados. Con Supabase configurado, primero pide sesion; al cerrar sesion vuelve a la pantalla de acceso.

## Alertas inteligentes

`src/services/alerts.js` lee alertas no vistas desde Supabase y permite marcarlas como leidas. En modo demo, la app calcula alertas locales con los datos simulados para que el panel proactivo siga visible sin backend.

Supabase genera dos alertas desde `schema.sql`:

- `weekly_max`: cuando un gasto nuevo supera el mayor gasto previo de la semana.
- `budget_80`: cuando el gasto mensual alcanza 80% del presupuesto.

## Gastos recurrentes

La vista Recurrentes muestra suscripciones activas, monto mensual comprometido y proximo cargo. Funciona con datos demo sin Supabase y con la tabla `recurring_expenses` cuando hay sesion activa.

## Pantallas incluidas

- Resumen mensual con presupuesto disponible, progreso y dona de categorias.
- Vista semanal con barras por dia e insight del mayor gasto.
- Vista quincenal con comparativa Q1/Q2.
- Vista de recurrentes con suscripciones y gasto mensual comprometido.
- Historial con busqueda, filtros y registro rapido.
