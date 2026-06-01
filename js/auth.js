// ─── AUTENTICACIÓN Y CONTROL DE ACCESO ───────────────────────────────────────

// Guard: llama desde cada página protegida.
// expectedRole: 'agent' | 'broker' | null (cualquier rol autenticado)
function requireAuth(expectedRole) {
  auth.onAuthStateChanged(async function(user) {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);

      // Cuenta desactivada por broker
      if (!profile || profile.active === false) {
        await auth.signOut();
        window.location.href = 'index.html?reason=suspended';
        return;
      }

      // Control de rol: un agente no puede acceder a broker.html
      if (expectedRole && profile.role !== expectedRole) {
        window.location.href = profile.role === 'broker' ? 'broker.html' : 'agent.html';
        return;
      }

      // Todo OK: inicializar la app correspondiente
      if (typeof initApp === 'function') {
        initApp(user, profile);
      }
    } catch (err) {
      console.error('Error verificando perfil:', err);
      showToast('Error al verificar tu sesión. Intentá de nuevo.', 'error');
    }
  });
}

// Login con email y contraseña
async function loginUser(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const profile = await getUserProfile(cred.user.uid);

  if (!profile || profile.active === false) {
    await auth.signOut();
    throw new Error('SUSPENDED');
  }

  return { user: cred.user, profile };
}

// Logout
async function logoutUser() {
  await auth.signOut();
  window.location.href = 'index.html';
}

// Registro de nuevo agente (queda pendiente hasta que broker lo active)
async function registerAgent(nombre, email, password) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  await createUserProfile(cred.user.uid, {
    nombre:    nombre.trim(),
    email:     email.toLowerCase().trim(),
    role:      'agent',
    active:    false,     // pendiente de activación por broker
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  await auth.signOut();
  return cred.user;
}

// Recuperar contraseña
async function resetPassword(email) {
  await auth.sendPasswordResetEmail(email);
}
