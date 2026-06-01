// ─── MENÚ MÓVIL — HAMBURGER + SIDEBAR ────────────────────────────────────────

function initMobileMenu() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Cerrar sidebar al seleccionar sección en mobile
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Cerrar con tecla Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen  = sidebar?.classList.contains('open');
  isOpen ? closeSidebar() : openSidebar();
}

function openSidebar() {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('open');
  document.getElementById('hamburger-btn').textContent = '✕';
}

function closeSidebar() {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
  const btn = document.getElementById('hamburger-btn');
  if (btn) btn.textContent = '☰';
}
