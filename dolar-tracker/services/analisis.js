function sma(valores, periodo) {
  if (valores.length < periodo) return null;
  const slice = valores.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularRSI(valores, periodo = 14) {
  if (valores.length < periodo + 1) return null;

  const cambios = [];
  for (let i = 1; i < valores.length; i++) {
    cambios.push(valores[i] - valores[i - 1]);
  }

  const recientes = cambios.slice(-periodo);
  const ganancias = recientes.filter(c => c > 0);
  const perdidas = recientes.filter(c => c < 0).map(c => Math.abs(c));

  const avgGanancia = ganancias.reduce((a, b) => a + b, 0) / periodo;
  const avgPerdida = perdidas.reduce((a, b) => a + b, 0) / periodo;

  if (avgPerdida === 0) return 100;
  const rs = avgGanancia / avgPerdida;
  return 100 - 100 / (1 + rs);
}

function clasificarRSI(rsi) {
  if (rsi === null) return 'insuficiente';
  if (rsi > 70) return 'sobrecomprado';
  if (rsi < 30) return 'sobrevendido';
  return 'neutral';
}

function calcularTendencia(precio, sma7, sma30) {
  if (sma7 === null || sma30 === null) return 'LATERAL';
  if (precio > sma7 && sma7 > sma30) return 'ALCISTA';
  if (precio < sma7 && sma7 < sma30) return 'BAJISTA';
  return 'LATERAL';
}

function generarSenal({ rsi, tendencia, precio, soporte, resistencia }) {
  if (rsi === null) {
    return {
      senal: 'ESPERAR',
      emoji: '🟡',
      razon: 'No hay suficientes datos históricos para calcular todos los indicadores.'
    };
  }

  const cercaDesoporte = precio <= soporte * 1.01;
  const cercaResistencia = precio >= resistencia * 0.99;

  if (rsi < 40 && cercaDesoporte && (tendencia === 'ALCISTA' || tendencia === 'LATERAL')) {
    return {
      senal: 'COMPRAR',
      emoji: '🟢',
      razon: `El dólar está en zona de soporte ($${soporte.toFixed(0)}) con RSI bajo (${rsi.toFixed(1)}), podría ser buen momento para comprar.`
    };
  }

  if (rsi > 60 && cercaResistencia && (tendencia === 'BAJISTA' || tendencia === 'LATERAL')) {
    return {
      senal: 'VENDER',
      emoji: '🔴',
      razon: `El dólar está cerca de resistencia ($${resistencia.toFixed(0)}) con RSI alto (${rsi.toFixed(1)}), podría ser momento de vender o esperar corrección.`
    };
  }

  return {
    senal: 'ESPERAR',
    emoji: '🟡',
    razon: `Las señales son mixtas (RSI: ${rsi.toFixed(1)}, Tendencia: ${tendencia}). Se recomienda esperar confirmación.`
  };
}

function analizar(historial) {
  if (!historial || historial.length === 0) return null;

  const valores = historial.map(d => d.valor);
  const precio = valores[valores.length - 1];
  const ayer = valores.length >= 2 ? valores[valores.length - 2] : null;
  const hace7 = valores.length >= 7 ? valores[valores.length - 7] : null;
  const hace30 = valores.length >= 30 ? valores[0] : null;

  const sma7 = sma(valores, 7);
  const sma30 = sma(valores, 30);
  const rsiRaw = calcularRSI(valores, 14);
  const rsi = rsiRaw !== null ? parseFloat(rsiRaw.toFixed(2)) : null;

  const soporte = Math.min(...valores);
  const resistencia = Math.max(...valores);
  const momentum = valores.length >= 11 ? precio - valores[valores.length - 11] : null;
  const tendencia = calcularTendencia(precio, sma7, sma30);

  const variacionAyer = ayer ? ((precio - ayer) / ayer) * 100 : null;
  const variacion7d = hace7 ? ((precio - hace7) / hace7) * 100 : null;
  const variacion30d = hace30 ? ((precio - hace30) / hace30) * 100 : null;

  const { senal, emoji, razon } = generarSenal({ rsi, tendencia, precio, soporte, resistencia });

  return {
    precio,
    ayer,
    variacionAyer: variacionAyer !== null ? parseFloat(variacionAyer.toFixed(2)) : null,
    variacion7d: variacion7d !== null ? parseFloat(variacion7d.toFixed(2)) : null,
    variacion30d: variacion30d !== null ? parseFloat(variacion30d.toFixed(2)) : null,
    sma7: sma7 !== null ? parseFloat(sma7.toFixed(2)) : null,
    sma30: sma30 !== null ? parseFloat(sma30.toFixed(2)) : null,
    rsi,
    estadoRSI: clasificarRSI(rsi),
    soporte: parseFloat(soporte.toFixed(2)),
    resistencia: parseFloat(resistencia.toFixed(2)),
    momentum: momentum !== null ? parseFloat(momentum.toFixed(2)) : null,
    tendencia,
    senal,
    emoji,
    razon
  };
}

module.exports = { analizar };
