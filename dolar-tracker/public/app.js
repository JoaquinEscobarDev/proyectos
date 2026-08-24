const BASE = window.API_BASE || '';

let graficoInstance    = null;
let graficoRSIInstance = null;
let proximaActualizacion = null;
let precioAnterior = null;
let primeraCarga = true;

// ===== FORMATO =====
const fmtCLP = n => n != null ? '$' + Number(n).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtPct = n => n != null ? (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' : '—';
const fmtNum = n => n != null ? Number(n).toFixed(2) : '—';

// ===== HELPERS =====
function claseVar(n) { return n == null ? '' : n >= 0 ? 'positivo' : 'negativo'; }

function setVarEl(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmtPct(valor);
  el.className = 'var-valor ' + claseVar(valor);
}

// ===== SKELETON =====
function mostrarSkeleton() {
  const skel = document.getElementById('precioSkel');
  const data = document.getElementById('precioData');
  if (skel) skel.style.display = 'block';
  if (data) data.style.display = 'none';
}

function ocultarSkeleton() {
  const skel = document.getElementById('precioSkel');
  const data = document.getElementById('precioData');
  if (skel) skel.style.display = 'none';
  if (data) data.style.display = 'block';
  primeraCarga = false;
}

// ===== FLASH DE PRECIO =====
function flashPrecio(nuevo) {
  if (precioAnterior === null) { precioAnterior = nuevo; return; }
  if (nuevo === precioAnterior) return;
  const el = document.getElementById('precioActual');
  if (!el) return;
  el.classList.remove('flash-up', 'flash-down');
  void el.offsetWidth; // force reflow para reiniciar animación
  if (nuevo > precioAnterior) el.classList.add('flash-up');
  else                        el.classList.add('flash-down');
  el.addEventListener('animationend', () => el.classList.remove('flash-up', 'flash-down'), { once: true });
  precioAnterior = nuevo;
}

// ===== SCORE DOTS =====
function renderScoreDots(votos) {
  const el = document.getElementById('scoreDots');
  if (!el || !votos || votos.length === 0) return;
  el.innerHTML = votos.map(v => {
    const cls = v.voto > 0 ? 'score-dot-buy' : v.voto < 0 ? 'score-dot-sell' : 'score-dot-neutral';
    const sym = v.voto > 0 ? '▲' : v.voto < 0 ? '▼' : '–';
    const tooltip = `${v.ind}: ${v.texto}`;
    return `<div class="score-dot ${cls}" title="${tooltip}">${sym}</div>`;
  }).join('');
}

// ===== BOLLINGER GAUGE =====
function renderBollingerGauge(analisis) {
  const marker = document.getElementById('bbGaugeMarker');
  if (!marker || !analisis.bollinger) return;
  const { lower, middle, upper } = analisis.bollinger;
  const pct = Math.min(100, Math.max(0, ((analisis.precio - lower) / (upper - lower)) * 100));
  marker.style.left = pct.toFixed(1) + '%';
  const low  = document.getElementById('bbGaugeLow');
  const mid  = document.getElementById('bbGaugeMid');
  const high = document.getElementById('bbGaugeHigh');
  if (low)  low.textContent  = fmtCLP(lower);
  if (mid)  mid.textContent  = fmtCLP(middle);
  if (high) high.textContent = fmtCLP(upper);
}

// ===== TINTES DE INDICADORES =====
function aplicarTintes(analisis) {
  function tint(id, estado) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('bull', 'bear');
    if (estado === 'bull') el.classList.add('bull');
    else if (estado === 'bear') el.classList.add('bear');
  }

  const precio = analisis.precio;
  tint('card-sma7',  precio > analisis.sma7  ? 'bull' : precio < analisis.sma7  ? 'bear' : '');
  tint('card-sma30', precio > analisis.sma30 ? 'bull' : precio < analisis.sma30 ? 'bear' : '');
  // EMA12 > EMA26 = cruce alcista
  tint('card-ema12', analisis.ema12 > analisis.ema26 ? 'bull' : analisis.ema12 < analisis.ema26 ? 'bear' : '');
  tint('card-ema26', analisis.ema12 > analisis.ema26 ? 'bull' : analisis.ema12 < analisis.ema26 ? 'bear' : '');
  // RSI
  tint('card-rsi',  analisis.estadoRSI === 'sobrevendido' ? 'bull' : analisis.estadoRSI === 'sobrecomprado' ? 'bear' : '');
  // Estocástico
  const esto = analisis.estocastico;
  tint('card-esto', esto?.estado === 'sobrevendido' ? 'bull' : esto?.estado === 'sobrecomprado' ? 'bear' : '');
  // MACD
  if (analisis.macd) {
    tint('card-macd', analisis.macd.macd > analisis.macd.signal ? 'bull' : 'bear');
  }
}

// ===== COUNTDOWN =====
// El cron del servidor corre cada 30 min, L-V 9:00-18:30 hora de Chile
function segundosParaProximaActualizacion() {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const dia = ahora.getDay();
  const h = ahora.getHours(), m = ahora.getMinutes();
  if (dia === 0 || dia === 6 || h < 9 || h > 18 || (h === 18 && m >= 30)) return null;
  const prox = new Date(ahora);
  prox.setMinutes(m < 30 ? 30 : 60, 0, 0);
  return Math.max(0, Math.floor((prox - ahora) / 1000));
}

function actualizarCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  const diff = segundosParaProximaActualizacion();
  if (diff === null) { el.textContent = '⟳ Fuera de horario'; return; }
  const mm = String(Math.floor(diff / 60)).padStart(2, '0');
  const ss = String(diff % 60).padStart(2, '0');
  el.textContent = `⟳ ${mm}:${ss}`;
}
setInterval(actualizarCountdown, 1000);
actualizarCountdown();

// ===== TEMA =====
const btnTema = document.getElementById('btnTema');
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  btnTema.textContent = tema === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('tema', tema);
}
btnTema.addEventListener('click', () => {
  const actual = document.documentElement.getAttribute('data-theme');
  aplicarTema(actual === 'dark' ? 'light' : 'dark');
});
aplicarTema(localStorage.getItem('tema') || 'dark');

// ===== GRÁFICO PRECIO =====
function buildSMA(valores, periodo) {
  return valores.map((_, i) => {
    if (i < periodo - 1) return null;
    const s = valores.slice(i - periodo + 1, i + 1);
    return s.reduce((a, b) => a + b, 0) / periodo;
  });
}
function buildBollinger(valores, periodo = 20, desv = 2) {
  return valores.map((_, i) => {
    if (i < periodo - 1) return { upper: null, lower: null };
    const s = valores.slice(i - periodo + 1, i + 1);
    const mean = s.reduce((a, b) => a + b, 0) / periodo;
    const std  = Math.sqrt(s.reduce((acc, v) => acc + (v - mean) ** 2, 0) / periodo);
    return { upper: mean + desv * std, lower: mean - desv * std };
  });
}

function renderGrafico(historial) {
  const ctx    = document.getElementById('grafico').getContext('2d');
  const labels = historial.map(d => d.fecha.slice(5));
  const precios = historial.map(d => d.valor);
  const bb = buildBollinger(precios);

  if (graficoInstance) graficoInstance.destroy();
  graficoInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'BB Superior', data: bb.map(b => b.upper), borderColor: 'rgba(124,58,237,0.45)', borderWidth: 1, pointRadius: 0, tension: 0.3, fill: false, borderDash: [3,3] },
        { label: 'BB Inferior', data: bb.map(b => b.lower), borderColor: 'rgba(124,58,237,0.45)', backgroundColor: 'rgba(124,58,237,0.05)', borderWidth: 1, pointRadius: 0, tension: 0.3, fill: '-1', borderDash: [3,3] },
        { label: 'USD/CLP',    data: precios,               borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.06)', borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false },
        { label: 'SMA 7',     data: buildSMA(precios, 7),  borderColor: '#00e676', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [4,3] },
        { label: 'SMA 30',    data: buildSMA(precios, 30), borderColor: '#ff6d00', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false, borderDash: [6,3] },
      ]
    },
    options: chartOptions(v => '$' + Number(v).toLocaleString('es-CL'))
  });
}

// ===== GRÁFICO RSI =====
function renderGraficoRSI(historial, rsiArr) {
  const ctx    = document.getElementById('graficoRSI').getContext('2d');
  const labels = historial.map(d => d.fecha.slice(5));

  if (graficoRSIInstance) graficoRSIInstance.destroy();
  graficoRSIInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'RSI', data: rsiArr, borderColor: '#ffd600', backgroundColor: 'rgba(255,214,0,0.05)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true },
      ]
    },
    options: {
      ...chartOptions(v => v.toFixed(1)),
      scales: {
        x: { ticks: { color: '#6b7280', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(42,47,66,0.5)' } },
        y: {
          min: 0, max: 100,
          ticks: { color: '#6b7280', font: { size: 9 }, stepSize: 20 },
          grid: { color: (ctx) => ctx.tick.value === 70 || ctx.tick.value === 30 ? 'rgba(255,255,255,0.15)' : 'rgba(42,47,66,0.5)' }
        }
      }
    }
  });
}

function chartOptions(tickFormatter) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#6b7280', font: { family: 'Courier New', size: 10 }, boxWidth: 14 } },
      tooltip: {
        backgroundColor: '#1e2230',
        borderColor: '#2a2f42',
        borderWidth: 1,
        titleColor: '#00e5ff',
        bodyColor: '#e8eaf0',
        callbacks: { label: ctx => ctx.raw != null ? ` ${tickFormatter ? tickFormatter(ctx.raw) : ctx.raw}` : '' }
      }
    },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(42,47,66,0.5)' } },
      y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => tickFormatter ? tickFormatter(v) : v }, grid: { color: '#2a2f42' } }
    }
  };
}

// ===== TABLA SEÑALES =====
function renderTablaSenales(senales) {
  const tbody = document.getElementById('tablaSenalesBody');
  if (!senales || senales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="tabla-empty">Sin señales registradas aún</td></tr>';
    return;
  }
  tbody.innerHTML = [...senales].reverse().map(s => {
    const fecha = new Date(s.fecha).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
    const badge = s.senal === 'COMPRAR' ? 'badge-comprar' : s.senal === 'VENDER' ? 'badge-vender' : 'badge-esperar';
    return `<tr>
      <td>${fecha}</td>
      <td><span class="badge ${badge}">${s.emoji} ${s.senal}</span></td>
      <td>${fmtCLP(s.precio)}</td>
      <td>${s.rsi != null ? s.rsi.toFixed(1) : '—'}</td>
      <td>${s.score != null ? s.score + '/' + (s.totalIndicadores || '—') : '—'}</td>
      <td>${s.tendencia || '—'}</td>
    </tr>`;
  }).join('');
}

// ===== TABLA HISTORIAL =====
function renderTablaHistorial(historial) {
  const tbody = document.getElementById('tablaHistorialBody');
  if (!historial || historial.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="tabla-empty">Sin datos</td></tr>';
    return;
  }
  tbody.innerHTML = [...historial].reverse().map((d, i, arr) => {
    const prev = arr[i + 1];
    const variacion = prev ? ((d.valor - prev.valor) / prev.valor) * 100 : null;
    return `<tr>
      <td>${d.fecha}</td>
      <td>${fmtCLP(d.valor)}</td>
      <td class="${claseVar(variacion)}">${fmtPct(variacion)}</td>
    </tr>`;
  }).join('');
}

// ===== RENDER PRINCIPAL =====
function renderDatos(data) {
  const { valorActual, historial, analisis } = data;

  // Ocultar skeleton en primera carga
  if (primeraCarga) ocultarSkeleton();

  // Flash de precio
  flashPrecio(valorActual);

  // Precio
  document.getElementById('precioActual').textContent = fmtCLP(valorActual);

  const varAyerEl = document.getElementById('variacionAyer');
  varAyerEl.textContent = analisis.variacionAyer != null
    ? (analisis.variacionAyer >= 0 ? '↑' : '↓') + ' ' + fmtPct(analisis.variacionAyer) + ' vs ayer'
    : '—';
  varAyerEl.className = 'variacion ' + claseVar(analisis.variacionAyer);

  if (analisis.precioApertura) {
    const diffAp = ((valorActual - analisis.precioApertura) / analisis.precioApertura) * 100;
    const apEl = document.getElementById('variacionApertura');
    apEl.textContent = `Apertura ${fmtCLP(analisis.precioApertura)} (${fmtPct(diffAp)})`;
  }

  const fechaHoy = historial.length ? historial[historial.length - 1].fecha : '—';
  document.getElementById('ultimaFecha').textContent = `Actualizado: ${fechaHoy}`;

  // Señal + score dots
  document.getElementById('senalEmoji').textContent = analisis.emoji || '🟡';
  const senalEl = document.getElementById('senalTexto');
  senalEl.textContent = analisis.senal;
  senalEl.className = 'senal-texto ' + analisis.senal;
  document.getElementById('senalScore').textContent =
    analisis.score != null ? `Score: ${analisis.score}/${analisis.totalIndicadores} indicadores` : '';
  renderScoreDots(analisis.votos);
  document.getElementById('senalRazon').textContent = analisis.razon;

  // Medias móviles
  document.getElementById('sma7').textContent  = fmtCLP(analisis.sma7);
  document.getElementById('sma30').textContent = fmtCLP(analisis.sma30);
  document.getElementById('ema12').textContent = fmtCLP(analisis.ema12);
  document.getElementById('ema26').textContent = fmtCLP(analisis.ema26);

  // RSI
  document.getElementById('rsi').textContent = analisis.rsi != null ? analisis.rsi.toFixed(1) : '—';
  const estadoEl = document.getElementById('estadoRSI');
  estadoEl.textContent = analisis.estadoRSI || '—';
  estadoEl.className = 'ind-sub ' + (analisis.estadoRSI || '');

  // Estocástico
  if (analisis.estocastico) {
    document.getElementById('estoK').textContent = analisis.estocastico.k.toFixed(1);
    const estoEl = document.getElementById('estoEstado');
    estoEl.textContent = analisis.estocastico.estado;
    estoEl.className = 'ind-sub ' + analisis.estocastico.estado;
  }

  // MACD
  if (analisis.macd) {
    document.getElementById('macdVal').textContent = analisis.macd.macd.toFixed(3);
    const macdEst = document.getElementById('macdEstado');
    const txt = analisis.macd.cruce ? `cruce ${analisis.macd.cruce.toLowerCase()}` : analisis.macd.macd > analisis.macd.signal ? 'alcista' : 'bajista';
    macdEst.textContent = txt;
    macdEst.style.color = analisis.macd.macd > analisis.macd.signal ? 'var(--green)' : 'var(--red)';
  }

  // ATR
  document.getElementById('atr').textContent = analisis.atr != null ? '$' + analisis.atr.toFixed(2) : '—';

  // Bollinger
  if (analisis.bollinger) {
    const bb = analisis.bollinger;
    document.getElementById('bbUpper').textContent  = fmtCLP(bb.upper);
    document.getElementById('bbMiddle').textContent = fmtCLP(bb.middle);
    document.getElementById('bbLower').textContent  = fmtCLP(bb.lower);
    document.getElementById('bbAncho').textContent  = bb.ancho + '%';
    const p = analisis.precio;
    document.getElementById('bbPosicion').textContent =
      p >= bb.upper * 0.995 ? '⚠️ Precio en banda superior — posible sobrecompra' :
      p <= bb.lower * 1.005 ? '📉 Precio en banda inferior — posible sobreventa' :
      p > bb.middle         ? '📈 Precio en mitad superior de las bandas' :
                              '📊 Precio en mitad inferior de las bandas';
    renderBollingerGauge(analisis);
  }

  // Niveles
  const tendEl = document.getElementById('tendencia');
  tendEl.textContent = analisis.tendencia;
  tendEl.className = 'nivel-valor tendencia-badge ' + analisis.tendencia;
  document.getElementById('soporte').textContent    = fmtCLP(analisis.soporte);
  document.getElementById('resistencia').textContent = fmtCLP(analisis.resistencia);
  const momEl = document.getElementById('momentum');
  if (analisis.momentum != null) {
    momEl.textContent = (analisis.momentum >= 0 ? '+' : '') + '$' + Math.abs(analisis.momentum).toFixed(2);
    momEl.style.color = analisis.momentum >= 0 ? 'var(--green)' : 'var(--red)';
  }

  setVarEl('var1d',  analisis.variacionAyer);
  setVarEl('var7d',  analisis.variacion7d);
  setVarEl('var30d', analisis.variacion30d);

  // Tintes en tarjetas de indicadores
  aplicarTintes(analisis);

  // Gráficos
  renderGrafico(historial);
  if (analisis.rsiArray) renderGraficoRSI(historial, analisis.rsiArray);

  // Tabla historial
  renderTablaHistorial(historial);
}

// ===== SSE — actualizaciones en tiempo real =====
function conectarSSE() {
  const es = new EventSource(`${BASE}/api/stream`);
  es.onmessage = e => {
    try { renderDatos(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => {
    es.close();
    setTimeout(conectarSSE, 10000);
  };
}

// ===== CARGA INICIAL =====
async function cargarDatos() {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  if (primeraCarga) mostrarSkeleton();
  try {
    const res = await fetch(`${BASE}/api/dolar`);
    if (!res.ok) throw new Error();
    renderDatos(await res.json());
  } catch (e) {
    console.error('Error cargando datos:', e);
    if (primeraCarga) ocultarSkeleton();
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '⟳<span class="btn-text"> Actualizar</span>';
  }
}

async function cargarSenales() {
  try {
    const res = await fetch(`${BASE}/api/senales`);
    renderTablaSenales(await res.json());
  } catch {}
}

function pedirActualizacion() {
  return fetch(`${BASE}/api/actualizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-update-token': localStorage.getItem('updateToken') || '' }
  });
}

document.getElementById('btnActualizar').addEventListener('click', async () => {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  btn.innerHTML = '⟳<span class="btn-text"> Actualizando...</span>';
  try {
    let res = await pedirActualizacion();
    if (res.status === 401) {
      const token = prompt('Este servidor requiere un token para actualizar manualmente:');
      if (token) {
        localStorage.setItem('updateToken', token.trim());
        res = await pedirActualizacion();
        if (res.status === 401) localStorage.removeItem('updateToken');
      }
    }
    await cargarDatos();
    await cargarSenales();
  } catch (e) { console.error(e); }
  finally {
    btn.classList.remove('loading');
    btn.innerHTML = '⟳<span class="btn-text"> Actualizar</span>';
  }
});

// ===== PWA + NOTIFICACIONES PUSH =====
const btnNotif = document.getElementById('btnNotif');

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function actualizarBtnNotif(sw) {
  if (!('PushManager' in window)) { btnNotif.style.display = 'none'; return; }
  const sub = await sw.pushManager.getSubscription();
  btnNotif.textContent = sub ? '🔕' : '🔔';
  btnNotif.title = sub ? 'Desactivar notificaciones' : 'Activar notificaciones';
}

async function toggleNotificaciones(sw) {
  const existing = await sw.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
    btnNotif.textContent = '🔔';
    btnNotif.title = 'Activar notificaciones';
    return;
  }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { alert('Permiso denegado para notificaciones.'); return; }
  try {
    const res = await fetch(`${BASE}/api/push/vapid-key`);
    const { publicKey } = await res.json();
    if (!publicKey) { alert('El servidor no tiene notificaciones configuradas.'); return; }
    const sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await fetch(`${BASE}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    btnNotif.textContent = '🔕';
    btnNotif.title = 'Desactivar notificaciones';
    alert('✅ Notificaciones activadas. Recibirás alertas cuando el dólar cambie.');
  } catch (e) {
    console.error('Error suscribiendo push:', e);
    alert('Error al activar notificaciones.');
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(async reg => {
    const sw = reg.active || await new Promise(r => {
      reg.addEventListener('updatefound', () => {
        reg.installing.addEventListener('statechange', e => {
          if (e.target.state === 'activated') r(reg.active);
        });
      });
      if (reg.active) r(reg.active);
    });
    await actualizarBtnNotif(reg);
    btnNotif.addEventListener('click', () => toggleNotificaciones(reg));
  }).catch(() => { btnNotif.style.display = 'none'; });
} else {
  btnNotif.style.display = 'none';
}

cargarDatos();
cargarSenales();
conectarSSE();
