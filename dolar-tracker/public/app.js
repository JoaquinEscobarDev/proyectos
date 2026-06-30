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

function renderGrafico(historial, analisis) {
  const ctx = document.getElementById('grafico').getContext('2d');
  const labels = historial.map(d => d.fecha.slice(5));
  const precios = historial.map(d => d.valor);

  // Construir series SMA con padding al inicio
  function buildSMA(valores, periodo) {
    return valores.map((_, i) => {
      if (i < periodo - 1) return null;
      const slice = valores.slice(i - periodo + 1, i + 1);
      return slice.reduce((a, b) => a + b, 0) / periodo;
    });
  }

  const sma7Series = buildSMA(precios, 7);
  const sma30Series = buildSMA(precios, 30);

  if (graficoInstance) graficoInstance.destroy();

  graficoInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'USD/CLP',
          data: precios,
          borderColor: '#00e5ff',
          backgroundColor: 'rgba(0,229,255,0.07)',
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'SMA 7',
          data: sma7Series,
          borderColor: '#00e676',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          borderDash: [4, 3],
          fill: false,
        },
        {
          label: 'SMA 30',
          data: sma30Series,
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
          labels: {
            color: '#6b7280',
            font: { family: 'Courier New', size: 11 },
            boxWidth: 16,
          }
        },
        tooltip: {
          backgroundColor: '#1e2230',
          borderColor: '#2a2f42',
          borderWidth: 1,
          titleColor: '#00e5ff',
          bodyColor: '#e8eaf0',
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return v !== null ? ` $${Number(v).toLocaleString('es-CL', { minimumFractionDigits: 2 })}` : '';
            }
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

  // Precio
  document.getElementById('precioActual').textContent = fmt(valorActual);
  setVariacion(document.getElementById('variacionAyer'), analisis.variacionAyer);
  const fechaHoy = historial.length ? historial[historial.length - 1].fecha : '—';
  document.getElementById('ultimaFecha').textContent = `Actualizado: ${fechaHoy}`;

  // Señal
  document.getElementById('senalEmoji').textContent = analisis.emoji || '🟡';
  const senalEl = document.getElementById('senalTexto');
  senalEl.textContent = analisis.senal;
  senalEl.className = 'senal-texto ' + analisis.senal;
  document.getElementById('senalRazon').textContent = analisis.razon;

  // Indicadores
  document.getElementById('sma7').textContent = fmt(analisis.sma7);
  document.getElementById('sma30').textContent = fmt(analisis.sma30);

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

  // Tendencia y niveles
  const tendEl = document.getElementById('tendencia');
  tendEl.textContent = analisis.tendencia;
  tendEl.className = 'nivel-valor tendencia-badge ' + analisis.tendencia;

  document.getElementById('soporte').textContent = fmt(analisis.soporte);
  document.getElementById('resistencia').textContent = fmt(analisis.resistencia);

  setVarItem('var7d', analisis.variacion7d);
  setVarItem('var30d', analisis.variacion30d);

  // Gráfico
  renderGrafico(historial, analisis);
}

async function cargarDatos() {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  btn.textContent = '⟳ Cargando...';

  try {
    const res = await fetch('/api/dolar');
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    renderDatos(data);
  } catch (e) {
    console.error('Error cargando datos:', e);
  } finally {
    btn.classList.remove('loading');
    btn.textContent = '⟳ Actualizar';
  }
}

async function cargarConfigAlertas() {
  try {
    const res = await fetch('/api/alertas');
    const cfg = await res.json();
    if (cfg.numero) document.getElementById('inputNumero').value = cfg.numero;
    if (cfg.umbral) document.getElementById('inputUmbral').value = cfg.umbral;
  } catch {}
}

document.getElementById('btnActualizar').addEventListener('click', async () => {
  const btn = document.getElementById('btnActualizar');
  btn.classList.add('loading');
  btn.textContent = '⟳ Actualizando...';
  try {
    await fetch('/api/actualizar', { method: 'POST' });
    await cargarDatos();
  } catch (e) {
    console.error(e);
    btn.classList.remove('loading');
    btn.textContent = '⟳ Actualizar';
  }
});

document.getElementById('formAlertas').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('alertaMsg');
  const body = {
    numero: document.getElementById('inputNumero').value,
    apiKey: document.getElementById('inputApiKey').value,
    umbral: document.getElementById('inputUmbral').value,
  };
  try {
    const res = await fetch('/api/alertas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      msg.textContent = '✓ Configuración guardada';
      msg.className = 'alerta-msg ok';
    } else {
      throw new Error('Error al guardar');
    }
  } catch {
    msg.textContent = '✗ Error al guardar';
    msg.className = 'alerta-msg err';
  }
  setTimeout(() => { msg.textContent = ''; }, 3000);
});

cargarDatos();
cargarConfigAlertas();
