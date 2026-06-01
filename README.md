# RE/MAX — Seguimiento Comercial 2026

App web para seguimiento de actividades comerciales. Agentes cargan sus métricas semanales, brokers supervisan el equipo y gestionan el acceso.

---

## Paso 1 — Crear el proyecto en Firebase

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear nuevo proyecto → nombre: `remax-seguimiento`
3. Desactivar Google Analytics (no es necesario)

### Activar Authentication
- Ir a **Build → Authentication → Get started**
- Habilitar proveedor: **Email/Password**

### Activar Firestore
- Ir a **Build → Firestore Database → Create database**
- Elegir modo **Production** (no test)
- Región: `southamerica-east1` (São Paulo, más cercana)

### Copiar la configuración
- Ir a **Project Settings (⚙️) → General → Your apps → Add app → Web**
- Registrar la app, copiar el objeto `firebaseConfig`
- Pegar los valores en `js/firebase-config.js`

---

## Paso 2 — Configurar las reglas de seguridad de Firestore

En **Firestore → Rules**, reemplazar con:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isBroker() {
      return request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'broker';
    }

    function isActive() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.active == true;
    }

    match /users/{userId} {
      allow read:  if request.auth.uid == userId || isBroker();
      allow write: if isBroker();
    }

    match /tracking/{userId}/{document=**} {
      allow read:  if request.auth.uid == userId || isBroker();
      allow write: if request.auth.uid == userId && isActive();
    }

    match /auditLog/{logId} {
      allow read:   if isBroker();
      allow create: if isBroker();
      allow update, delete: if false;
    }
  }
}
```

---

## Paso 3 — Crear el primer Broker manualmente

Los brokers NO se crean desde la app (por seguridad). Crear el primero así:

1. En la app, registrarse normalmente como agente
2. Ir a **Firestore → users → (tu UID)** 
3. Editar el documento: cambiar `role` a `"broker"` y `active` a `true`
4. Desde ese broker, ya podés activar agentes y promover otros brokers

---

## Paso 4 — Publicar en GitHub Pages

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/remax-seguimiento.git
git push -u origin main
```

En el repo de GitHub:
- **Settings → Pages → Source → Deploy from branch → main / (root)**
- La app queda en: `https://TU_USUARIO.github.io/remax-seguimiento/`

---

## Estructura de archivos

```
remax-seguimiento/
├── index.html          ← Login y registro
├── agent.html          ← Dashboard del agente
├── broker.html         ← Dashboard del broker
├── css/
│   └── styles.css      ← Estilos RE/MAX
└── js/
    ├── firebase-config.js  ← ⚠️ Completar con tu config
    ├── utils.js            ← Métricas, fechas, helpers
    ├── auth.js             ← Login, logout, guards de ruta
    ├── db.js               ← Capa de datos Firestore
    ├── charts.js           ← Gráficos Chart.js
    ├── agent-app.js        ← Lógica dashboard agente
    └── broker-app.js       ← Lógica dashboard broker
```

---

## Métricas rastreadas

| Tipo | Métrica |
|------|---------|
| Comercial | Reuniones Verdes, Pre-Listing/ACM, Pre-Buying, Reservas, Cierres Venta, Cierres Compra, Llamados/WA |
| Manual | Notas Personales, E-Report, Pop By, Eventos, Redes Sociales, Nuevos Contactos, Captaciones |

---

## Próximos pasos sugeridos

- [ ] Integración Google Calendar (reemplaza la carga manual de las 7 métricas comerciales)
- [ ] Exportar a Excel desde el browser (SheetJS)
- [ ] Notificaciones por email cuando se activa/suspende un agente
- [ ] Filtro por rango de fechas en la vista broker
