# Despliegue de Lumina

Lumina puede desplegarse como sitio estatico. El comando de build es `npm run build` y el directorio de salida es `dist`.

## Antes de desplegar

1. Ejecuta el SQL de `supabase/schema.sql` en tu proyecto de Supabase.
2. Copia `.env.example` a `.env.local` para pruebas locales.
3. En produccion, agrega estas variables en el panel del proveedor:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

## Vercel

1. Sube el proyecto a GitHub.
2. Importa el repositorio en Vercel.
3. Vercel detecta Vite automaticamente. Si necesitas configurarlo manualmente:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Agrega las variables de entorno de Supabase.
5. Despliega.

`vercel.json` ya incluye rewrites para la app, headers del service worker, manifiesto e assets con hash.

## Cloudflare Pages

1. Sube el proyecto a GitHub.
2. Crea un proyecto en Cloudflare Pages.
3. Configura:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Agrega las variables de entorno de Supabase.
5. Despliega.

Cloudflare usa `public/_headers` y `public/_redirects`, que Vite copia a `dist` durante el build.

## Prueba en iPhone

1. Abre la URL HTTPS en Safari.
2. Toca Compartir.
3. Toca Agregar a pantalla de inicio.
4. Abre Lumina desde el icono instalado.
5. Verifica que se abra sin barra de Safari y que el modo offline muestre la pantalla de respaldo.
