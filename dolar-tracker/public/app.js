const BASE = window.API_BASE || '';

let graficoInstance = null;

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}

function setVariacion(el, valor) {
  if (valor === null || valor === undefined) { el.textContent = '—'; return; }
  const sign = valor >= 0 ? '↑' : '↓';
  el.textContent = `${sign} ${fmtPct(valor)} vs ayer`;
  el.className = 'variacion ' + (valor >= 0 ? 'positivo' : 'negativo');
}

function setVarItem(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmtPct(valor);
  el.className = 'var-valor ' + (valor >= 0 ? 'positivo' : 'negativo');
}

function buildSMA(valores, periodo) {
  return valores.map((_, i) => {
    if (i < periodo - 1) return null;
    const slice = valores.slice(i - periodo + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  });
}

function buildBollinger(valores, periodo = 20, desv = 2) {
  return valores.map((_, i) => {
    if (i < periodo - 1) return { upper: null, lower: null };
    const slice = valores.slice(i - periodo + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / periodo;
    const std = Math.sqrt(slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / periodo);
    return { upper: mean + desv * std, lower: mean - desv * std };
  });
}

function renderGrafico(historial) {
  const ctx = document.getElementById('grafico').getContext('2d');
  const labels = historial.map(d => d.fecha.slice(5));
  const precios = historial.map(d => d.valor);
  const bb = buildBollinger(precios);

  if (graficoInstance) graficoInstance.destroy();

  graficoInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'BB Superior',
          data: bb.map(b => b.upper),
          borderColor: 'rgba(124,58,237,0.5)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          borderDash: [3, 3],
        },
        {
          label: 'BB Inferior',
          data: bb.map(b => b.lower),
          borderColor: 'rgba(124,58,237,0.5)',
          backgroundColor: 'rgba(124,58,237,0.05)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.3,
          fill: '-1',
          borderDash: [3, 3],
        },
        {
          label: 'USD/CLP',
          data: precios,
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0,229,255,0.07)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          fill: false,
          order: 0,
        },
        {
          label: 'SMA 7',
          data: buildSMA(precios, 7),
          borderColor: '#00e676',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [4, 3],
          fill: false,
        },
        {
          label: 'SMA 30',
          data: buildSMA(precios, 30),
          borderColor: '#ff6d00',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [6, 3],
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#6b7280', font: { family: 'Courier New', size: 11 }, boxWidth: 16 }
        },
        tooltip: {
          backgroundColor: '#1e2230',
          borderColor: '#2a2f42',
          borderWidth: 1,
          titleColor: '#00e5ff',
          bodyColor: '#e8eaf0',
          callbacks: {
            label: ctx => ctx.raw !== null
              ? ` $${Number(ctx.raw).toLocaleString('es-CL', { minimumFractionDigits: 2 })}`
              : ''
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 8 },
          grid: { color: '#1e2230' }
        },
        y: {
          ticks: {
            color: '#6b7280',
            font: { size: 10 },
            callback: v => '$' + Number(v).toLocaleString('es-CL')
          },
          grid: { color: '#2a2f42' }
        }
      }
    }
  });
}

function renderDatos(data) {
  const { valorActual, historial, analisis } = data;

  document.getElementById('precioActual').textContent = fmt(valorActual);
  setVariacion(document.getElementById('variacionAyer'), analisis.variacionAyer);

  const fechaHoy = historial.length ? historial[historial.length - 1].fecha : '—';
  document.getElementById('ultimaFecha').textContent = `Actualizado: ${fechaHoy}`;

  document.getElementById('senalEmoji').textContent = analisis.emoji || '🟡';
  const senalEl = document.getElementById('senalTexto');
  senalEl.textContent = analisis.senal;
  senalEl.className = 'senal-texto ' + analisis.senal;
  document.getElementById('senalRazon').textContent = analisis.razon;

  document.getElementById('sma7').textContent  = fmt(analisis.sma7);
  document.getElementById('sma30').textContent = fmt(analisis.sma30);
  document.getElementById('ema12').textContent = fmt(analisis.ema12);
  document.getElementById('ema26').textContent = fmt(analisis.ema26);

  const rsiEl = document.getElementById('rsi');
  rsiEl.textContent = analisis.rsi !== null ? analisis.rsi.toFixed(1) : '—';
  const estadoEl = document.getElementById('estadoRSI');
  estadoEl.textContent = analisis.estadoRSI || '—';
  estadoEl.className = 'ind-sub ' + (analisis.estadoRSI || '');

  const momEl = document.getElementById('momentum');
  if (analisis.momentum !== null) {
    const sign = analisis.momentum >= 0 ? '+' : '';
    momEl.textContent = `${sign}$${Math.abs(analisis.momentum).toFixed(2)}`;
    momEl.style.color = analisis.momentum >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    momEl.textContent = '—';
  }

  // MACD
  const macd = analisis.macd;
  if (macd) {
    document.getElementById('macdVal').textContent = macd.macd.toFixed(3);
    const histEl = document.getElementById('macdHist');
    histEl.textContent = (macd.histogram >= 0 ? '+' : '') + macd.histogram.toFixed(3);
    histEl.style.color = macd.histogram >= 0 ? 'var(--green)' : 'var(--red)';
    const estadoMacd = document.getElementById('macdEstado');
    estadoMacd.textContent = macd.macd > macd.signal ? 'alcista' : 'bajista';
    estadoMacd.style.color = macd.macd > macd.signal ? 'var(--green)' : 'var(--red)';
  }

  // Bollinger
  const bb = analisis.bollinger;
  if (bb) {
    document.getElementById('bbUpper').textContent  = fmt(bb.upper);
    document.getElementById('bbMiddle').textContent = fmt(bb.middle);
    document.getElementById('bbLower').textContent  = fmt(bb.lower);
    document.getElementById('bbAncho').textContent  = bb.ancho + '%';
    const precio = analisis.precio;
    let pos;
    if (precio >= bb.upper * 0.995)       pos = '⚠️ Precio en banda superior — posible sobrecompra o breakout alcista';
    else if (precio <= bb.lower * 1.005)  pos = '📉 Precio en banda inferior — posible sobreventa o breakout bajista';
    else if (precio > bb.middle)          pos = '📈 Precio en mitad superior de las bandas';
    else                                  pos = '📊 Precio en mitad inferior de las bandas';
    document.getElementById('bbPosicion').textContent = pos;
  }

  const tendEl = document.getElementById('tendencia');
  tendEl.textContent = analisis.tendencia;
  tendEl.className = 'nivel-valor tendencia-badge ' + analisis.tendencia;

  document.getElementById('soporte').textContent = fmt(analisis.soporte);
  document.getElementById('resistencia').textContent = fmt(analisis.resistencia);
  setVarItem('var7d', analisis.variacion7d);
  setVarItem('var30d', analisis.variacion30d);

  renderGrafico(historial);
}

async function cargarDatos() {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  btn.textContent = '⟳ Cargando...';
  try {
    const res = await fetch(`${BASE}/api/dolar`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    renderDatos(await res.json());
  } catch (e) {
    console.error('Error cargando datos:', e);
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '⟳ Actualizar';
  }
}

document.getElementById('btnActualizar').addEventListener('click', async () => {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  btn.textContent = '⟳ Actualizando...';
  try {
    await fetch(`${BASE}/api/actualizar`, { method: 'POST' });
    await cargarDatos();
  } catch (e) {
    console.error(e);
    btn.classList.remove('loading');
    btn.textContent = '⟳ Actualizar';
  }
});

cargarDatos();
