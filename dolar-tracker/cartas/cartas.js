// ===== CONTADOR — juntos desde el 15 de enero de 2026 =====
const INICIO = new Date(2026, 0, 15, 0, 0, 0);

function actualizarContador() {
  const diff = Math.max(0, Date.now() - INICIO.getTime());
  const s = Math.floor(diff / 1000);
  const dias = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  document.getElementById('contadorDias').textContent = dias.toLocaleString('es-CL');
  document.getElementById('contadorHms').textContent = `${h} h ${m} min ${seg} s`;
}
setInterval(actualizarContador, 1000);
actualizarContador();

// ===== SOBRE =====
const sobre = document.getElementById('sobreOverlay');
sobre.addEventListener('click', () => {
  if (sobre.classList.contains('abriendo')) return;
  sobre.classList.add('abriendo');
  setTimeout(() => {
    sobre.classList.add('desvanecer');
    document.body.classList.add('abierto');
  }, 1500);
  setTimeout(() => sobre.remove(), 2300);
});

// ===== RAMO — 20 tulipanes =====
const COLORES = [
  ['#ff6d9d', '#e34f81'], // rosa
  ['#ff5470', '#d63a57'], // rojo
  ['#ffd166', '#eab545'], // amarillo
  ['#c77dff', '#a65de0'], // lila
  ['#ffb3c6', '#f593ac'], // rosa claro
];

function crearTulipan(i, total) {
  const ang = -38 + (76 / (total - 1)) * i;
  // Los del centro más altos, con leve variación para que se vea natural
  const escala = (0.78 + Math.sin((i / (total - 1)) * Math.PI) * 0.24 + ((i * 7) % 3) * 0.02).toFixed(2);
  const [petalo, petaloOscuro] = COLORES[i % COLORES.length];

  const d = document.createElement('div');
  d.className = 'tulipan';
  d.style.setProperty('--ang', ang.toFixed(1) + 'deg');
  d.style.setProperty('--escala', escala);
  d.style.setProperty('--delay', (0.15 + i * 0.07).toFixed(2) + 's');
  d.style.setProperty('--sway', (2.6 + ((i * 3) % 5) * 0.35).toFixed(2) + 's');
  d.innerHTML = `
    <svg viewBox="0 0 54 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M27 62 C 24 105, 30 160, 27 210" stroke="#3f8f4f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M27 130 C 14 122, 8 104, 12 90 C 22 100, 26 112, 27 130 Z" fill="#4aa25c"/>
      <path d="M27 158 C 40 150, 46 132, 42 118 C 32 128, 28 140, 27 158 Z" fill="#3f8f4f"/>
      <path d="M9 26 C 9 52, 16 66, 27 66 C 38 66, 45 52, 45 26 C 39 36, 33 36, 27 26 C 21 36, 15 36, 9 26 Z" fill="${petalo}"/>
      <path d="M27 26 C 21 36, 15 36, 9 26 C 9 48, 15 62, 24 65 C 20 52, 21 38, 27 26 Z" fill="${petaloOscuro}"/>
    </svg>`;
  return d;
}

function crearRamo() {
  const ramo = document.getElementById('ramo');
  if (!ramo || ramo.childElementCount > 0) return;
  const TOTAL = 20;
  for (let i = 0; i < TOTAL; i++) ramo.appendChild(crearTulipan(i, TOTAL));
}

// ===== ABRIR / CERRAR CARTAS =====
document.querySelectorAll('.carta-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const carta = btn.closest('.carta');
    const abierta = carta.classList.toggle('abierta');
    if (abierta) {
      crearRamo();
      setTimeout(() => carta.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
    }
  });
});
