// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN DE FIREBASE
//  Reemplazá estos valores con los de tu proyecto en Firebase Console
//  https://console.firebase.google.com → Tu proyecto → Configuración → Aplicaciones web
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyAtKKJ92LEsVCTbtlypNNVz54B2X4iNH9M",
  authDomain:        "seguimiento-agentes.firebaseapp.com",
  projectId:         "seguimiento-agentes",
  storageBucket:     "seguimiento-agentes.firebasestorage.app",
  messagingSenderId: "975846382463",
  appId:             "1:975846382463:web:7a02ad0a30e4d00118184a"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Persistencia de sesión: se mantiene mientras el tab esté abierto.
// Cambiar a firebase.auth.Auth.Persistence.LOCAL para que persista al cerrar el browser.
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
