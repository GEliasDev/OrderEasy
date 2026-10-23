// Monto en pesos escrito en letras ("Son: cincuenta mil pesos"), como se acostumbra en los recibos colombianos.
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

// "uno" pierde la o delante de mil/millón/pesos: veintiún mil, treinta y un millones
const apocopar = (texto) => texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

const menorAMil = (n) => {
  if (n === 100) return 'cien';
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes = [];
  if (centena) partes.push(CENTENAS[centena]);
  if (resto < 30) {
    if (resto) partes.push(UNIDADES[resto]);
  } else {
    const unidad = resto % 10;
    partes.push(DECENAS[Math.floor(resto / 10)] + (unidad ? ` y ${UNIDADES[unidad]}` : ''));
  }
  return partes.join(' ');
};

const convertir = (n) => {
  if (n < 1000) return menorAMil(n);
  if (n < 1e6) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    return `${miles === 1 ? 'mil' : `${apocopar(menorAMil(miles))} mil`}${resto ? ` ${menorAMil(resto)}` : ''}`;
  }
  const millones = Math.floor(n / 1e6);
  const resto = n % 1e6;
  const inicio = millones === 1 ? 'un millón' : `${apocopar(convertir(millones))} millones`;
  return `${inicio}${resto ? ` ${convertir(resto)}` : ''}`;
};

export const pesosEnLetras = (valor) => {
  const n = Math.round(Math.abs(Number(valor) || 0));
  if (n === 0) return 'Cero pesos';
  if (n >= 1e12) return '';
  const texto = apocopar(convertir(n));
  const conector = n >= 1e6 && n % 1e6 === 0 ? ' de' : '';
  const frase = `${texto}${conector} ${n === 1 ? 'peso' : 'pesos'}`;
  return frase.charAt(0).toUpperCase() + frase.slice(1);
};
