// --- Utilidades ---

function sma(valores, periodo) {
  if (valores.length < periodo) return null;
  const slice = valores.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function ema(valores, periodo) {
  if (valores.length < periodo) return null;
  const k = 2 / (periodo + 1);
  let emaVal = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  for (let i = periodo; i < valores.length; i++) {
    emaVal = valores[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

// Devuelve array completo de EMA (mismo largo que valores, null al inicio)
function emaArray(valores, periodo) {
  if (valores.length < periodo) return valores.map(() => null);
  const k = 2 / (periodo + 1);
  const result = Array(periodo - 1).fill(null);
  let val = valores.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  result.push(val);
  for (let i = periodo; i < valores.length; i++) {
    val = valores[i] * k + val * (1 - k);
    result.push(val);
  }
  return result;
}

function stddev(valores) {
  const mean = valores.reduce((a, b) => a + b, 0) / valores.length;
  const variance = valores.reduce((acc, v) => acc + (v - mean) ** 2, 0) / valores.length;
  return Math.sqrt(variance);
}

function calcularRSI(valores, periodo = 14) {
  if (valores.length < periodo + 1) return null;
  const cambios = [];
  for (let i = 1; i < valores.length; i++) cambios.push(valores[i] - valores[i - 1]);
  const recientes = cambios.slice(-periodo);
  const ganancias = recientes.filter(c => c > 0);
  const perdidas  = recientes.filter(c => c < 0).map(c => Math.abs(c));
  const avgG = ganancias.reduce((a, b) => a + b, 0) / periodo;
  const avgP = perdidas.reduce((a, b) => a + b, 0) / periodo;
  if (avgP === 0) return 100;
  return 100 - 100 / (1 + avgG / avgP);
}

function calcularMACD(valores) {
  if (valores.length < 35) return null; // necesita al menos 26 + 9

  const ema12arr = emaArray(valores, 12);
  const ema26arr = emaArray(valores, 26);

  // MACD line: solo donde ambas EMAs existen
  const macdLine = ema12arr.map((e12, i) => {
    if (e12 === null || ema26arr[i] === null) return null;
    return e12 - ema26arr[i];
  });

  // Signal line: EMA9 del MACD line (ignorando nulls)
  const macdValidos = macdLine.filter(v => v !== null);
  if (macdValidos.length < 9) return null;

  const signalVal = ema(macdValidos, 9);
  const macdVal   = macdValidos[macdValidos.length - 1];
  const histogram = macdVal - signalVal;

  return {
    macd:      parseFloat(macdVal.toFixed(4)),
    signal:    parseFloat(signalVal.toFixed(4)),
    histogram: parseFloat(histogram.toFixed(4)),
  };
}

function calcularBollinger(valores, periodo = 20, desviaciones = 2) {
  if (valores.length < periodo) return null;
  const slice = valores.slice(-periodo);
  const media = slice.reduce((a, b) => a + b, 0) / periodo;
  const std   = stddev(slice);
  return {
    upper:  parseFloat((media + desviaciones * std).toFixed(2)),
    middle: parseFloat(media.toFixed(2)),
    lower:  parseFloat((media - desviaciones * std).toFixed(2)),
    ancho:  parseFloat((((media + desviaciones * std) - (media - desviaciones * std)) / media * 100).toFixed(2)),
  };
}

function calcularTendencia(precio, sma7, sma30) {
  if (sma7 === null || sma30 === null) return 'LATERAL';
  if (precio > sma7 && sma7 > sma30) return 'ALCISTA';
  if (precio < sma7 && sma7 < sma30) return 'BAJISTA';
  return 'LATERAL';
}

// --- Sistema de puntuación ---
// Cada indicador vota: +1 compra, -1 venta, 0 neutro
// señal final: >= 3 COMPRAR, <= -3 VENDER, resto ESPERAR

function generarSenal({ precio, rsi, tendencia, macd, bollinger, momentum }) {
  const votos = [];

  // RSI
  if (rsi !== null) {
    if (rsi < 35)       votos.push({ ind: 'RSI', voto: 1,  texto: `RSI bajo (${rsi.toFixed(1)}) — zona sobrevendida` });
    else if (rsi > 65)  votos.push({ ind: 'RSI', voto: -1, texto: `RSI alto (${rsi.toFixed(1)}) — zona sobrecomprada` });
    else                votos.push({ ind: 'RSI', voto: 0,  texto: `RSI neutro (${rsi.toFixed(1)})` });
  }

  // Tendencia SMA
  if (tendencia === 'ALCISTA')      votos.push({ ind: 'SMA', voto: 1,  texto: 'tendencia alcista (precio > SMA7 > SMA30)' });
  else if (tendencia === 'BAJISTA') votos.push({ ind: 'SMA', voto: -1, texto: 'tendencia bajista (precio < SMA7 < SMA30)' });
  else                              votos.push({ ind: 'SMA', voto: 0,  texto: 'tendencia lateral' });

  // MACD
  if (macd !== null) {
    if (macd.macd > macd.signal)       votos.push({ ind: 'MACD', voto: 1,  texto: 'MACD sobre línea de señal (momentum alcista)' });
    else if (macd.macd < macd.signal)  votos.push({ ind: 'MACD', voto: -1, texto: 'MACD bajo línea de señal (momentum bajista)' });
    else                               votos.push({ ind: 'MACD', voto: 0,  texto: 'MACD neutral' });
  }

  // Bollinger
  if (bollinger !== null) {
    if (precio <= bollinger.lower * 1.005)       votos.push({ ind: 'BB', voto: 1,  texto: `precio en banda inferior de Bollinger ($${bollinger.lower})` });
    else if (precio >= bollinger.upper * 0.995)  votos.push({ ind: 'BB', voto: -1, texto: `precio en banda superior de Bollinger ($${bollinger.upper})` });
    else                                         votos.push({ ind: 'BB', voto: 0,  texto: 'precio dentro de las bandas de Bollinger' });
  }

  // Momentum
  if (momentum !== null) {
    if (momentum > 0)       votos.push({ ind: 'MOM', voto: 1,  texto: `momentum positivo (+$${momentum.toFixed(2)})` });
    else if (momentum < 0)  votos.push({ ind: 'MOM', voto: -1, texto: `momentum negativo ($${momentum.toFixed(2)})` });
    else                    votos.push({ ind: 'MOM', voto: 0,  texto: 'momentum neutro' });
  }

  const score = votos.reduce((acc, v) => acc + v.voto, 0);
  const compras = votos.filter(v => v.voto > 0).map(v => v.texto);
  const ventas  = votos.filter(v => v.voto < 0).map(v => v.texto);

  let senal, emoji, razon;

  if (score >= 3) {
    senal = 'COMPRAR';
    emoji = '🟢';
    razon = `${score}/${votos.length} indicadores alcistas: ${compras.join(', ')}.`;
  } else if (score <= -3) {
    senal = 'VENDER';
    emoji = '🔴';
    razon = `${Math.abs(score)}/${votos.length} indicadores bajistas: ${ventas.join(', ')}.`;
  } else {
    senal = 'ESPERAR';
    emoji = '🟡';
    const resumen = score > 0
      ? `Leve inclinación alcista (${score}/${votos.length})`
      : score < 0
        ? `Leve inclinación bajista (${score}/${votos.length})`
        : 'Señales mixtas o neutrales';
    razon = `${resumen}. Se recomienda esperar confirmación.`;
  }

  return { senal, emoji, razon, score, totalIndicadores: votos.length };
}

// --- Función principal ---

function analizar(historial) {
  if (!historial || historial.length === 0) return null;

  const valores = historial.map(d => d.valor);
  const precio  = valores[valores.length - 1];
  const ayer    = valores.length >= 2  ? valores[valores.length - 2]  : null;
  const hace7   = valores.length >= 7  ? valores[valores.length - 7]  : null;
  const hace30  = valores.length >= 30 ? valores[0]                   : null;

  const sma7val  = sma(valores, 7);
  const sma30val = sma(valores, 30);
  const ema12val = ema(valores, 12);
  const ema26val = ema(valores, 26);
  const rsiRaw   = calcularRSI(valores, 14);
  const rsi      = rsiRaw !== null ? parseFloat(rsiRaw.toFixed(2)) : null;
  const macd     = calcularMACD(valores);
  const bollinger = calcularBollinger(valores, 20);

  const soporte    = Math.min(...valores);
  const resistencia = Math.max(...valores);
  const momentum   = valores.length >= 11 ? precio - valores[valores.length - 11] : null;
  const tendencia  = calcularTendencia(precio, sma7val, sma30val);

  const variacionAyer  = ayer   ? ((precio - ayer)   / ayer)   * 100 : null;
  const variacion7d    = hace7  ? ((precio - hace7)  / hace7)  * 100 : null;
  const variacion30d   = hace30 ? ((precio - hace30) / hace30) * 100 : null;

  const { senal, emoji, razon, score, totalIndicadores } = generarSenal({
    precio, rsi, tendencia, macd, bollinger, momentum
  });

  const r = v => v !== null ? parseFloat(v.toFixed(2)) : null;

  return {
    precio,
    ayer,
    variacionAyer:  r(variacionAyer),
    variacion7d:    r(variacion7d),
    variacion30d:   r(variacion30d),
    sma7:           r(sma7val),
    sma30:          r(sma30val),
    ema12:          r(ema12val),
    ema26:          r(ema26val),
    rsi,
    estadoRSI:      rsi === null ? 'insuficiente' : rsi > 70 ? 'sobrecomprado' : rsi < 30 ? 'sobrevendido' : 'neutral',
    macd,
    bollinger,
    soporte:        r(soporte),
    resistencia:    r(resistencia),
    momentum:       r(momentum),
    tendencia,
    senal,
    emoji,
    razon,
    score,
    totalIndicadores,
  };
}

module.exports = { analizar };
