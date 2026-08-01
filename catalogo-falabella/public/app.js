// ── Formato relativo de fecha ("hace 3h", "hace 2d") ──
function formatRelativo(fecha) {
  const ms = Date.now() - fecha.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1)  return 'recién';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias}d`;
}

// ── Categorías ──
const CATEGORIAS = [
  { nombre: 'Computadores',       icono: '💻' },
  { nombre: 'Tablets',            icono: '📱' },
  { nombre: 'Impresoras',         icono: '🖨️' },
  { nombre: 'Connect',            icono: '📡' },
  { nombre: 'Isla',               icono: '🏝️' },
  { nombre: 'TV',                 icono: '📺' },
  { nombre: 'Consolas',           icono: '🎮' },
  { nombre: 'Línea Blanca',       icono: '🫧' },
  { nombre: 'Electrodomésticos',  icono: '⚡' },
  { nombre: 'Relojes',            icono: '⌚' },
  { nombre: 'Audífonos',          icono: '🎧' },
  { nombre: 'Audífonos Cascos',   icono: '🎵' },
  { nombre: 'Parlantes',          icono: '🔊' },
  { nombre: 'Cuidado Personal',   icono: '✨' },
  { nombre: 'Clima',              icono: '❄️' },
  { nombre: 'Accesorios',         icono: '🔌' },
];

// ── Estado ──
let categoriaActiva = null;
let skusGuardados   = [];
let productosCache  = {};
let stockCache      = {};
let sizeSkuPending  = null;
let gridPrimeraVez  = false; // true solo al entrar a una categoría → activa animación stagger

// El pedido vive en el servidor (tabla todo_items), no en localStorage, para
// que todos los dispositivos vean siempre la misma lista.
let todoItems = [];

// ── Elementos ──
const viewCategorias   = document.getElementById('viewCategorias');
const viewProductos    = document.getElementById('viewProductos');
const categoriasGrid   = document.getElementById('categoriasGrid');
const grid             = document.getElementById('grid');
const filtroInput      = document.getElementById('filtro');
const filtroMarca      = document.getElementById('filtroMarca');
const formAgregar      = document.getElementById('formAgregar');
const inputSku         = document.getElementById('inputSku');
const inputAlias       = document.getElementById('inputAlias');
const msgAgregar       = document.getElementById('msgAgregar');
const btnBack          = document.getElementById('btnBack');
const btnRefreshAll    = document.getElementById('btnRefreshAll');
const headerActions    = document.getElementById('headerActions');
const headerTitle      = document.getElementById('headerTitle');
// Pedido
const todoBadge        = document.getElementById('todoBadge');
const todoEmptyState   = document.getElementById('todoEmptyState');
const todoList         = document.getElementById('todoList');
const todoClear        = document.getElementById('todoClear');
const todoFab          = document.getElementById('todoFab');
const todoFabCount     = document.getElementById('todoFabCount');
const todoOverlay      = document.getElementById('todoOverlay');
const todoListModal    = document.getElementById('todoListModal');
const todoModalClose   = document.getElementById('todoModalClose');
const todoClearModal   = document.getElementById('todoClearModal');
const todoModalEmpty   = document.getElementById('todoModalEmpty');

// ── Arranque ──
init();

async function init() {
  const r = await fetch('/api/skus');
  skusGuardados = await r.json();
  renderCategorias();
  await cargarTodo();
  // Refresca el pedido cada 20s para que los cambios de otros dispositivos
  // (agregar, quitar, vaciar) se vean sin tener que recargar la página.
  setInterval(cargarTodo, 20000);
}

// ── Cambios de precio detectados por el refresh diario ──
const NOMBRES_CAMPO = { normal: 'Normal', oferta: 'Oferta', cmr: 'CMR' };

async function cargarTodo() {
  let items;
  try {
    const r = await fetch('/api/todo');
    items = await r.json();
  } catch { return; }

  const fmt = n => n != null ? `$${Number(n).toLocaleString('es-CL')}` : '—';
  todoItems = items.map(item => ({
    ...item,
    cambios: (item.cambios || []).map(c => ({
      id: c.id,
      campo: NOMBRES_CAMPO[c.campo] || c.campo,
      texto: `${NOMBRES_CAMPO[c.campo] || c.campo}: ${fmt(c.precio_anterior)} → ${fmt(c.precio_nuevo)}`,
      fecha: c.fecha,
    })),
  }));

  // Precargar en silencio los productos del pedido que no están en caché
  // para que las imágenes se vean sin tener que entrar a cada categoría.
  const faltantes = todoItems.map(i => i.sku).filter(sku => productosCache[sku] === undefined);
  if (faltantes.length) {
    await Promise.all(faltantes.map(async sku => {
      try {
        const r = await fetch(`/api/producto/${sku}`);
        const data = await r.json();
        productosCache[sku] = r.ok ? data : { error: data.error };
      } catch {
        productosCache[sku] = { error: 'Error de red' };
      }
    }));
  }

  renderTodo();
  renderGrid();
}

// ══════════════════════════════════════════
// CATEGORÍAS
// ══════════════════════════════════════════

function renderCategorias() {
  categoriasGrid.innerHTML = CATEGORIAS.map((c, i) => {
    const count = skusGuardados.filter(s => s.categoria === c.nombre).length;
    return `
      <div class="category-card" data-cat="${c.nombre}" style="--i:${i}">
        <span class="category-count${count === 0 ? ' is-empty' : ''}">${count}</span>
        <span class="category-icon">${c.icono}</span>
        <span class="category-name">${c.nombre}</span>
      </div>`;
  }).join('');

  categoriasGrid.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => abrirCategoria(card.dataset.cat));
  });
}

// El botón "← Categorías" y el botón atrás del navegador hacen lo mismo:
// retroceder en el historial. Quien efectivamente cambia la vista es el
// listener de popstate, así ambos caminos quedan sincronizados y el botón
// atrás del navegador ya no saca de la página, solo vuelve a categorías.
function abrirCategoria(nombre) {
  history.pushState({ categoria: nombre }, '');
  mostrarVistaProductos(nombre);
}

async function mostrarVistaProductos(nombre) {
  categoriaActiva = nombre;
  viewCategorias.hidden = true;
  viewProductos.hidden  = false;
  viewProductos.classList.remove('view');
  void viewProductos.offsetWidth;
  viewProductos.classList.add('view');
  btnBack.hidden        = false;
  headerActions.hidden  = false;
  const cat = CATEGORIAS.find(c => c.nombre === nombre);
  headerTitle.innerHTML = `<span class="brand-mark">${cat.icono}</span> ${nombre}`;
  filtroInput.value = '';
  filtroMarca.value = '';
  gridPrimeraVez = true;
  actualizarFab();
  renderGrid();

  const skusCat = skusGuardados.filter(s => s.categoria === nombre);

  // Un solo request trae precio + stock cacheados de toda la categoría,
  // en vez de 2 por producto. Lo que no tenga caché todavía (poco común)
  // se carga individual como antes.
  let datos = [];
  try {
    const r = await fetch(`/api/categoria/${encodeURIComponent(nombre)}`);
    datos = await r.json();
  } catch { /* sigue con la carga individual de fallback */ }

  const sinCache = [];
  for (const d of datos) {
    if (d.producto) productosCache[d.sku] = d.producto;
    else sinCache.push(d.sku);
    if (d.stock) stockCache[d.sku] = d.stock;
  }
  renderGrid();
  renderTodo();

  const faltantes = skusCat.filter(s => productosCache[s.sku] === undefined || stockCache[s.sku] === undefined);
  await Promise.all(faltantes.map(s => Promise.all([cargarProducto(s.sku), cargarStock(s.sku)])));
}

function mostrarVistaCategorias() {
  categoriaActiva = null;
  viewProductos.hidden  = true;
  viewCategorias.hidden = false;
  viewCategorias.classList.remove('view');
  void viewCategorias.offsetWidth;
  viewCategorias.classList.add('view');
  btnBack.hidden        = true;
  headerActions.hidden  = true;
  headerTitle.innerHTML = '<span class="brand-mark">◆</span> Catálogo';
  todoFab.hidden        = true;
  renderCategorias();
}

btnBack.addEventListener('click', () => history.back());

window.addEventListener('popstate', (e) => {
  if (e.state && e.state.categoria) mostrarVistaProductos(e.state.categoria);
  else mostrarVistaCategorias();
});

filtroInput.addEventListener('input', renderGrid);
filtroMarca.addEventListener('change', renderGrid);

async function agregarSku(sku, alias) {
  if (!sku || !categoriaActiva) return false;
  mostrarMsg('Agregando…', '');
  const r = await fetch('/api/skus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku, alias, categoria: categoriaActiva }),
  });
  const data = await r.json();
  if (!r.ok) { mostrarMsg(data.error || 'Error al agregar', 'err'); return false; }
  mostrarMsg('SKU agregado ✓', 'ok');
  skusGuardados.unshift({ sku, alias: alias || null, categoria: categoriaActiva });
  renderGrid();
  await Promise.all([cargarProducto(sku), cargarStock(sku)]);
  return true;
}

formAgregar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const sku   = inputSku.value.trim();
  const alias = inputAlias.value.trim();
  if (await agregarSku(sku, alias)) {
    inputSku.value   = '';
    inputAlias.value = '';
  }
});

// ══════════════════════════════════════════
// PRODUCTOS
// ══════════════════════════════════════════

async function cargarProducto(sku, force = false) {
  if (!force && productosCache[sku] !== undefined) return;
  productosCache[sku] = null;
  renderGrid();
  try {
    const url  = force ? `/api/producto/${sku}?force=1` : `/api/producto/${sku}`;
    const r    = await fetch(url);
    const data = await r.json();
    productosCache[sku] = r.ok ? data : { error: data.error };
  } catch {
    productosCache[sku] = { error: 'Error de red' };
  }
  renderGrid();
  renderTodo();
}

// El refresco real lo hace tu PC (ver watch-refresh.js) cada ~5 min — el
// hosting no puede scrapear Falabella de forma confiable. El botón solo deja
// la solicitud y espera a que se procese para volver a cargar los precios.
btnRefreshAll.addEventListener('click', async () => {
  if (!categoriaActiva || btnRefreshAll.disabled) return;
  btnRefreshAll.disabled = true;
  const icon = btnRefreshAll.querySelector('.icon-refresh')?.outerHTML || '';
  const setLabel = txt => { btnRefreshAll.innerHTML = `${icon}<span class="btn-label">${txt}</span>`; };
  setLabel('Solicitando…');

  let solicitudId;
  try {
    const r = await fetch('/api/solicitar-refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria: categoriaActiva }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Error al solicitar');
    solicitudId = data.id;
  } catch (e) {
    setLabel('❌ ' + e.message);
    setTimeout(() => resetBtnRefresh(icon), 3000);
    return;
  }

  setLabel('Esperando…');
  const categoriaAlSolicitar = categoriaActiva;

  // Tu PC revisa solicitudes pendientes cada ~5 min — esperamos hasta 12 min en total.
  for (let intento = 0; intento < 24; intento++) {
    await new Promise(res => setTimeout(res, 30000));
    let procesado = false;
    try {
      const r = await fetch(`/api/solicitar-refresh/${solicitudId}`);
      procesado = (await r.json()).procesado;
    } catch { /* probar de nuevo en el próximo intento */ }
    if (procesado) {
      if (categoriaActiva === categoriaAlSolicitar) {
        const skusCat = skusGuardados.filter(s => s.categoria === categoriaAlSolicitar);
        skusCat.forEach(s => { delete productosCache[s.sku]; delete stockCache[s.sku]; });
        renderGrid();
        await Promise.all(skusCat.map(s => Promise.all([cargarProducto(s.sku), cargarStock(s.sku)])));
      }
      setLabel('✓ Precios actualizados');
      setTimeout(() => resetBtnRefresh(icon), 3000);
      return;
    }
  }
  setLabel('⏱ Tardó más de lo esperado');
  setTimeout(() => resetBtnRefresh(icon), 4000);
});

function resetBtnRefresh(iconHTML) {
  btnRefreshAll.innerHTML = `${iconHTML}<span class="btn-label">Actualizar precios</span>`;
  btnRefreshAll.disabled = false;
}

async function cargarStock(sku) {
  if (stockCache[sku] !== undefined) return;
  stockCache[sku] = null;
  try {
    const r    = await fetch(`/api/stock/${sku}`);
    const data = await r.json();
    stockCache[sku] = r.ok ? data : { stock: null };
  } catch {
    stockCache[sku] = { stock: null };
  }
  renderGrid();
}

// Normaliza (sin acentos, minúsculas) para que "camara" encuentre "Cámara".
function normalizarTexto(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// El precio más bajo que realmente paga el cliente: CMR u oferta,
// lo que sea menor; si no hay ninguno, el precio normal.
function precioOrden(prod) {
  if (!prod) return Infinity;
  const candidatos = [prod.precioCMR, prod.precioOferta, prod.precio].filter(p => p != null);
  return candidatos.length ? Math.min(...candidatos) : Infinity;
}

// Reconstruye las opciones del filtro de marca según lo que haya cargado
// de la categoría activa, conservando la selección si sigue existiendo.
function actualizarFiltroMarca(skusCat) {
  const marcas = [...new Set(skusCat.map(s => productosCache[s.sku]?.marca).filter(Boolean))].sort();
  const seleccionActual = filtroMarca.value;
  filtroMarca.innerHTML = '<option value="">Todas las marcas</option>'
    + marcas.map(m => `<option value="${m}">${m}</option>`).join('');
  if (marcas.includes(seleccionActual)) filtroMarca.value = seleccionActual;
}

function renderGrid() {
  if (!categoriaActiva) return;
  const palabras = normalizarTexto(filtroInput.value).trim().split(/\s+/).filter(Boolean);
  const skusCat  = skusGuardados.filter(s => s.categoria === categoriaActiva);
  actualizarFiltroMarca(skusCat);
  const marcaSeleccionada = filtroMarca.value;
  const lista    = skusCat.filter(s => {
    const prod = productosCache[s.sku];
    if (marcaSeleccionada && prod?.marca !== marcaSeleccionada) return false;
    if (!palabras.length) return true;
    const nombre  = prod?.nombre || '';
    const haystack = normalizarTexto(`${s.sku} ${s.alias || ''} ${nombre}`);
    return palabras.every(p => haystack.includes(p));
  }).sort((a, b) => precioOrden(productosCache[a.sku]) - precioOrden(productosCache[b.sku]));

  if (!lista.length) {
    grid.innerHTML = '<p class="empty-state">No hay productos en esta categoría.<br>Agrega un SKU arriba.</p>';
    return;
  }
  // Solo animar cuando ya hay datos reales (no skeletons de carga)
  const hayDatos = lista.some(s => productosCache[s.sku] !== undefined && productosCache[s.sku] !== null);
  const animar = gridPrimeraVez && hayDatos;
  if (animar) gridPrimeraVez = false;
  grid.innerHTML = lista.map((s, i) => tarjeta(s, animar ? i : -1)).join('');
  grid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', () => eliminarSku(btn.dataset.sku));
  });
  grid.querySelectorAll('.btn-order').forEach(btn => {
    btn.addEventListener('click', () => toggleTodo(btn.dataset.sku));
  });
}

function badgeStock(sku) {
  const info = stockCache[sku];
  if (info === undefined || info === null) return '<span class="stock-badge stock--loading">Stock…</span>';
  const n = info.stock;
  if (n === null || n === undefined) return '<span class="stock-badge stock--unknown">Sin info</span>';
  if (n <= 2) return `<span class="stock-badge stock--low">Revisar</span>`;
  return `<span class="stock-badge stock--ok">Stock: ${n}</span>`;
}

function tarjeta({ sku, alias }, idx = -1) {
  const prod    = productosCache[sku];
  const enLista = todoItems.some(item => item.sku === sku);
  const animCls = idx >= 0 ? ' animate-in' : '';
  const animStyle = idx >= 0 ? ` style="--i:${idx}"` : '';

  if (prod === undefined || prod === null) {
    return `
      <div class="card${animCls}"${animStyle}>
        <div class="card-actions">
          <button class="card-delete" data-sku="${sku}" title="Eliminar">✕</button>
        </div>
        <div class="card-media-placeholder">⏳</div>
        <div class="card-body">
          ${alias ? `<span class="card-alias">${alias}</span>` : ''}
          <span class="card-sku">SKU: ${sku}</span>
          <p class="card-loading-msg">Cargando…</p>
        </div>
      </div>`;
  }

  if (prod.error) {
    return `
      <div class="card${animCls}"${animStyle}>
        <div class="card-actions">
          <button class="card-delete" data-sku="${sku}" title="Eliminar">✕</button>
        </div>
        <div class="card-media-placeholder">❌</div>
        <div class="card-body">
          ${alias ? `<span class="card-alias">${alias}</span>` : ''}
          <span class="card-sku">SKU: ${sku}</span>
          <p class="card-error-msg">${prod.error}</p>
        </div>
      </div>`;
  }

  const img = prod.imagen
    ? `<img class="card-media" src="${prod.imagen}" alt="${prod.nombre}" loading="lazy" />`
    : `<div class="card-media-placeholder">📦</div>`;

  const fmt = n => n ? `$${Number(n).toLocaleString('es-CL')}` : null;

  const cmrRow = prod.precioCMR
    ? `<div class="price-row"><span class="price-label">CMR</span><span class="price-cmr">${fmt(prod.precioCMR)}</span></div>`
    : '';

  let bloquePrecio = '';
  if (prod.precioOferta) {
    bloquePrecio = `
      <div class="price-row"><span class="price-label">Normal</span><span class="price-old">${fmt(prod.precio) || '—'}</span></div>
      <div class="price-row"><span class="price-label">Oferta</span><span class="price-offer">${fmt(prod.precioOferta)}</span></div>
      ${cmrRow}`;
  } else if (prod.precio) {
    bloquePrecio = `
      <div class="price-row"><span class="price-label">Precio</span><span class="price-normal">${fmt(prod.precio)}</span></div>
      ${cmrRow}`;
  } else {
    bloquePrecio = `<div class="price-row"><span class="price-empty">Sin precio</span></div>${cmrRow}`;
  }

  let bloqueGarantia = '';
  if (prod.garantia1a || prod.garantia2a || prod.garantia3a) {
    const filas = [
      prod.garantia1a ? `<span class="warranty-item">1a: ${fmt(prod.garantia1a)}</span>` : '',
      prod.garantia2a ? `<span class="warranty-item">2a: ${fmt(prod.garantia2a)}</span>` : '',
      prod.garantia3a ? `<span class="warranty-item">3a: ${fmt(prod.garantia3a)}</span>` : '',
    ].filter(Boolean).join('');
    bloqueGarantia = `<div class="card-warranty"><span class="warranty-label">🛡️ Garantía ext.</span>${filas}</div>`;
  }

  const bloqueCuotas = prod.cuotasSinInteres
    ? `<div class="card-installments">💳 Hasta ${prod.cuotasSinInteres} cuotas sin interés (CMR)</div>`
    : '';

  const bloqueDespacho = prod.despacho24h
    ? `<div class="card-shipping">🚚 Despacho 24 horas</div>`
    : '';

  const btnLabel = enLista ? '✓ En pedido' : 'Agregar al pedido';
  const btnClass = enLista ? 'btn-order btn-order--added' : 'btn-order';

  let cacheBadge = '';
  if (prod.cached && prod.updatedAt) {
    const d       = new Date(prod.updatedAt);
    const fecha   = d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    const hora    = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const relativo = formatRelativo(d);
    const vieja   = (Date.now() - d.getTime()) > 36 * 3600 * 1000; // más de 36h sin actualizar
    cacheBadge  = `<span class="card-updated${vieja ? ' card-updated--stale' : ''}" title="Precio guardado el ${fecha} a las ${hora}">🕐 ${relativo}</span>`;
  }

  return `
    <div class="card${prod.cached ? ' card--cached' : ''}${animCls}"${animStyle}>
      <div class="card-actions">
        <button class="card-delete" data-sku="${sku}" title="Eliminar">✕</button>
      </div>
      ${img}
      <div class="card-body">
        ${alias ? `<span class="card-alias">${alias}</span>` : ''}
        ${prod.capacidad ? `<span class="card-attrs">${prod.capacidad}${prod.color ? ` · ${prod.color}` : ''}</span>` : ''}
        <span class="card-name" title="${prod.nombre}">${prod.nombre}</span>
        <span class="card-sku">SKU: ${sku}</span>
        <div class="card-prices">${bloquePrecio}</div>
        ${bloqueDespacho}
        ${bloqueCuotas}
        ${bloqueGarantia}
        ${badgeStock(sku)}
        ${cacheBadge}
      </div>
      <div class="card-footer">
        ${prod.url ? `<a class="card-link" href="${prod.url}" target="_blank" rel="noopener">Ver →</a>` : '<span></span>'}
        <button class="${btnClass}" data-sku="${sku}">${btnLabel}</button>
      </div>
    </div>`;
}

async function eliminarSku(sku) {
  if (!confirm(`¿Eliminar el SKU ${sku}?`)) return;
  await fetch(`/api/skus/${sku}`, { method: 'DELETE' });
  await fetch(`/api/todo/${sku}`, { method: 'DELETE' });
  delete productosCache[sku];
  delete stockCache[sku];
  skusGuardados = skusGuardados.filter(s => s.sku !== sku);
  todoItems = todoItems.filter(item => item.sku !== sku);
  renderGrid();
  renderTodo();
  renderCategorias();
}

function mostrarMsg(msg, tipo) {
  msgAgregar.textContent = msg;
  msgAgregar.className   = 'form-msg ' + tipo;
  if (tipo === 'ok') setTimeout(() => { msgAgregar.textContent = ''; }, 3000);
}

// ══════════════════════════════════════════
// LISTA DE PEDIDO
// ══════════════════════════════════════════

async function toggleTodo(sku) {
  const idx = todoItems.findIndex(item => item.sku === sku);
  if (idx !== -1) {
    todoItems.splice(idx, 1);
    renderTodo();
    renderGrid();
    await fetch(`/api/todo/${sku}`, { method: 'DELETE' });
  } else {
    abrirSizeModal(sku);
  }
}

async function limpiarTodo() {
  todoItems = [];
  renderTodo();
  renderGrid();
  await fetch('/api/todo/clear', { method: 'POST' });
}

function renderTodo() {
  const count = todoItems.length;

  todoBadge.textContent = count;
  todoBadge.classList.toggle('zero', count === 0);
  todoEmptyState.hidden = count !== 0;
  todoModalEmpty.hidden = count !== 0;
  todoClearModal.hidden = count === 0;

  actualizarFab();

  const grupos = {};
  for (const item of todoItems) {
    const categoria = skusGuardados.find(s => s.sku === item.sku)?.categoria || 'Sin categoría';
    (grupos[categoria] ||= []).push(item);
  }

  const itemHTML = ({ sku, size, quantity, cambios }) => {
    const prod  = productosCache[sku];
    const datos = skusGuardados.find(s => s.sku === sku);
    const alias = datos?.alias || '';

    const thumb = prod?.imagen
      ? `<img class="order-thumb" src="${prod.imagen}" alt="" />`
      : `<div class="order-thumb-placeholder">📦</div>`;

    const nombre = prod?.nombre || alias || sku;
    const fmt    = n => n ? `$${Number(n).toLocaleString('es-CL')}` : null;
    const precio = prod?.precioOferta
      ? fmt(prod.precioOferta)
      : (prod?.precio ? fmt(prod.precio) : '—');

    const fechaCambio = cambios?.length ? new Date(cambios[cambios.length - 1].fecha) : null;
    const cambiosHTML = cambios?.length
      ? `<div class="order-changes">
          ${cambios.map(c => `<span class="order-change-line">${c.texto}</span>`).join('')}
          ${fechaCambio ? `<span class="order-change-date">${fechaCambio.toLocaleDateString('es-CL')}</span>` : ''}
        </div>`
      : '';

    return `
      <li class="order-item">
        ${thumb}
        <div class="order-info">
          <span class="order-name" title="${nombre}">${nombre}</span>
          <span class="order-sku">SKU: ${sku}</span>
          <span class="order-price">${precio}</span>
          <span class="order-size">${size} × ${quantity}</span>
          ${cambiosHTML}
        </div>
        <button class="order-remove" data-sku="${sku}" title="Quitar">✕</button>
      </li>`;
  };

  const itemsHTML = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'es')).map(categoria =>
    `<li class="order-category">${categoria}</li>${grupos[categoria].map(itemHTML).join('')}`
  ).join('');

  todoList.innerHTML      = itemsHTML;
  todoListModal.innerHTML = itemsHTML;

  document.querySelectorAll('.order-remove').forEach(btn => {
    btn.addEventListener('click', () => toggleTodo(btn.dataset.sku));
  });
}

function actualizarFab() {
  todoFabCount.textContent = todoItems.length;
  if (categoriaActiva) todoFab.hidden = false;
  todoFab.classList.toggle('has-items', todoItems.length > 0);
}

// ══════════════════════════════════════════
// MODAL TAMAÑO / CANTIDAD
// ══════════════════════════════════════════

function abrirSizeModal(sku) {
  sizeSkuPending = sku;
  const prod  = productosCache[sku];
  const datos = skusGuardados.find(s => s.sku === sku);
  const nombre = prod?.nombre || datos?.alias || `SKU ${sku}`;
  document.getElementById('sizeTitulo').textContent =
    nombre.length > 40 ? nombre.slice(0, 40) + '…' : nombre;
  document.getElementById('sizeStep1').hidden = false;
  document.getElementById('sizeStep2').hidden = true;
  document.getElementById('sizeStep2').dataset.size = '';
  document.getElementById('qtyInput').value = 1;
  document.getElementById('sizeOverlay').classList.add('open');
}

document.querySelectorAll('.size-option').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('sizeStep2').dataset.size        = btn.dataset.size;
    document.getElementById('sizeSelectedLabel').textContent = btn.dataset.size;
    document.getElementById('sizeStep1').hidden               = true;
    document.getElementById('sizeStep2').hidden               = false;
  });
});

document.getElementById('qtyMinus').addEventListener('click', () => {
  const input = document.getElementById('qtyInput');
  if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
});

document.getElementById('qtyPlus').addEventListener('click', () => {
  const input = document.getElementById('qtyInput');
  input.value = parseInt(input.value) + 1;
});

document.getElementById('sizeConfirm').addEventListener('click', async () => {
  const size     = document.getElementById('sizeStep2').dataset.size;
  const quantity = parseInt(document.getElementById('qtyInput').value) || 1;
  if (!size) return;
  const sku = sizeSkuPending;
  todoItems.push({ sku, size, quantity, cambios: [] });
  renderTodo();
  renderGrid();
  document.getElementById('sizeOverlay').classList.remove('open');
  await fetch('/api/todo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku, size, quantity }),
  });
});

document.getElementById('sizeClose').addEventListener('click', () => {
  document.getElementById('sizeOverlay').classList.remove('open');
});

document.getElementById('sizeOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('sizeOverlay'))
    document.getElementById('sizeOverlay').classList.remove('open');
});

// ── Modal pedido ──
todoFab.addEventListener('click', () => todoOverlay.classList.add('open'));
todoModalClose.addEventListener('click', () => todoOverlay.classList.remove('open'));
todoOverlay.addEventListener('click', e => {
  if (e.target === todoOverlay) todoOverlay.classList.remove('open');
});

todoClear.addEventListener('click', () => {
  if (todoItems.length === 0) return;
  if (confirm('¿Vaciar toda la lista?')) limpiarTodo();
});
todoClearModal.addEventListener('click', () => {
  if (confirm('¿Vaciar toda la lista?')) {
    limpiarTodo();
    todoOverlay.classList.remove('open');
  }
});
