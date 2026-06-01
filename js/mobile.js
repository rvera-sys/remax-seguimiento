// ─── MENÚ MÓVIL — HAMBURGER + SIDEBAR ────────────────────────────────────────

function initMobileMenu() {
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar   = document.querySelector('.sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (!hamburger || !sidebar) return;

  // Remover listeners previos clonando el botón
  const newBtn = hamburger.cloneNode(true);
  hamburger.parentNode.replaceChild(newBtn, hamburger);

  newBtn.addEventListener('click', toggleSidebar);
  overlay?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

// Auto-iniciar cuando el DOM esté listo (por si initApp tarda)
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger-btn');
  if (hamburger) {
    hamburger.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);
  }
});

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
