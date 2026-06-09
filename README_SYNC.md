# Google Calendar Sync Setup

## Índice

1. [Conectar Google Calendar al sync automático](#1)
2. [¿Qué hace el sync?](#2)
3. [Cómo ejecutar el sync-worker](#3)

## 1️⃣ Conectar Google Calendar al sync automático

Necesitas compartir tu Google Calendar con una cuenta de servicio para que el sync-worker pueda acceder a él cada hora.

### Paso a paso:

1. **Haz clic aquí para abrir Google Calendar**: https://calendar.google.com
2. Haz clic en la rueda ⚙️ (Configuración) → Configuración de mis calendarios
3. Encuentra el calendario que usas para la app
4. Haz clic en **Compartir con personas específicas**
5. Agrega este email:

   `firebase-adminsdk-fbsvc@seguimiento-agentes.iam.gserviceaccount.com`

6. Permiso: **Ver todos los detalles de eventos**
7. Guardar

✅ Después de esto, el sync-worker podrá leer tus eventos cada hora

## 2️⃣ ¿Qué hace el sync?

El sync-worker:

- Se ejecuta **cada 1 hora**
- Lee los eventos del **día actual** de tu Google Calendar
- Detecta métricas usando el mismo motor que la app (palabras clave como "reunión verde", "pre-listing", "visita", etc.)
- Los aplica a los datos de la semana actual en el Firebase

## 3️⃣ Cómo ejecutar el sync-worker

### Opción A: Ejecutar manualmente (para pruebas)

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
node sync-worker.js
```

### Opción B: Ejecutar como servicio (recomendado para producción)

Usando **PM2** (ya instalado):

```powershell
pm2 start sync-worker.js --name calendar-sync -- cron "0 * * * *"

# Para ver:
pm2 logs calendar-sync

# Para parar:
pm2 stop calendar-sync
```

La opción cron en PM2 ejecuta cada hora. PM2 automáticamente guarda el proceso y lo reinicia si tu PC se apaga.

## 🔍 ¿Cómo saber si está funcionando?

Mira los logs de sync-worker.js (si usás la opción A), o en PM2 (opción B):

```
2026-06-09T17:09:20.773Z Sync...
2026-06-09T17:09:20.773Z  Usuario: Lh3V1zfOhnhcNZVGfFE5qdzoAYg1
2026-06-09T17:09:20.773Z Eventos hoy: 3
2026-06-09T17:09:20.773Z Visitas: 1
2026-06-09T17:09:20.773Z Reuniones verdes: 2
2026-06-09T17:09:20.773Z ✅ 2025-06-09 actualizado (3 metricas)
```

## En caso de error

Si ves errores:

```
Error: Calendar API: 403
```

Significa que no compartiste el calendario con la cuenta de servicio. Repite el paso 1-5 arriba.

## Consejos

- El sync-worker ejecuta **cada hora**, no cada minuto
- Si el Calendar de Google está desactivado o tu cuenta pierde acceso, el sync se detendrá (pero PM2 puede reiniciarlo)
- El servicio de sync-worker ejecuta bajo tu usuario, sin configuración extra
