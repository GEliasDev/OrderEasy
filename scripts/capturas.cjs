// Capturas de pantalla de la app local para revisar rediseños (escritorio, tablet, móvil y modo oscuro).
//
// Requisitos: backend en :3000, frontend en :5173 y Playwright instalado. Si Playwright no está en este proyecto,
// se busca en PLAYWRIGHT_DIR (carpeta con node_modules/playwright).
//
// Uso:
//   node scripts/capturas.cjs /dashboard/balance                 -> todos los tamaños, claro y oscuro
//   node scripts/capturas.cjs /dashboard/balance /dashboard/inicio
//   node scripts/capturas.cjs /dashboard/balance --tamanos=movil,escritorio --sin-oscuro
//
// Las imágenes quedan en capturas/<ruta>-<tamaño>[-oscuro].png (carpeta ignorada por git). Además se informa de
// errores de consola y de desbordes horizontales, que son los fallos de responsive más comunes.
const fs = require('fs');
const path = require('path');

const cargarPlaywright = () => {
  const candidatos = [
    () => require('playwright'),
    () => require(path.join(process.env.PLAYWRIGHT_DIR || '', 'node_modules', 'playwright')),
    () => require(path.join(process.env.TEMP || '', 'pw-runner', 'node_modules', 'playwright')),
  ];
  for (const intentar of candidatos) {
    try { return intentar(); } catch { /* siguiente */ }
  }
  throw new Error('No se encontró Playwright. Instálalo (npm i -D playwright) o define PLAYWRIGHT_DIR.');
};

const TAMANOS = {
  escritorio: { width: 1440, height: 900 },
  ancho: { width: 1920, height: 1080 },
  tablet: { width: 820, height: 1100 },
  movil: { width: 375, height: 812 },
};

const args = process.argv.slice(2);
// Acepta /dashboard/x o dashboard/x (Git Bash convierte "/dashboard/x" en una ruta de Windows; se recupera aquí)
const rutas = args
  .filter((a) => !a.startsWith('--'))
  .map((a) => `/${a.split('\\').join('/').replace(/^.*?(dashboard(\/|$))/, '$1').replace(/^\/+/, '')}`);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.split('=')[1];
const tamanos = (opcion('tamanos') ? opcion('tamanos').split(',') : ['ancho', 'escritorio', 'tablet', 'movil']);
const conOscuro = !args.includes('--sin-oscuro');
const API = process.env.API_URL || 'http://localhost:3000';
const WEB = process.env.WEB_URL || 'http://localhost:5173';
const CORREO = process.env.CAPTURAS_CORREO || 'gvaldelamar2003@gmail.com';
const CLAVE = process.env.CAPTURAS_CLAVE || '123456';

(async () => {
  if (rutas.length === 0) {
    console.log('Indica al menos una ruta, por ejemplo: node scripts/capturas.cjs /dashboard/balance');
    process.exit(1);
  }
  const { chromium } = cargarPlaywright();
  const login = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: CORREO, contraseña: CLAVE }),
  })).json();
  if (!login.token) throw new Error('No se pudo iniciar sesión con la cuenta de prueba. ¿Está el backend en marcha?');

  const salida = path.join(__dirname, '..', 'capturas');
  fs.mkdirSync(salida, { recursive: true });
  const navegador = await chromium.launch();
  let problemas = 0;

  for (const ruta of rutas) {
    for (const tema of conOscuro ? ['light', 'dark'] : ['light']) {
      for (const nombre of tamanos) {
        const viewport = TAMANOS[nombre];
        if (!viewport) { console.log(`Tamaño desconocido: ${nombre}`); continue; }
        // El modo oscuro solo se revisa en escritorio y móvil
        if (tema === 'dark' && !['escritorio', 'movil'].includes(nombre)) continue;

        const ctx = await navegador.newContext({ viewport });
        await ctx.addInitScript(([t, u, th]) => {
          localStorage.setItem('token', t);
          localStorage.setItem('user', JSON.stringify(u));
          localStorage.setItem('rol', u.rol);
          localStorage.setItem('theme', th);
        }, [login.token, login.usuario, tema]);
        const pagina = await ctx.newPage();
        const errores = [];
        pagina.on('pageerror', (e) => errores.push(e.message));
        pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

        await pagina.goto(`${WEB}${ruta}`);
        await pagina.waitForLoadState('networkidle').catch(() => {});
        await pagina.waitForTimeout(1500);

        // Desborde horizontal: algún elemento más ancho que la pantalla
        const desborde = await pagina.evaluate(() => {
          const ancho = document.documentElement.clientWidth;
          const culpables = [...document.querySelectorAll('body *')]
            .filter((el) => el.getBoundingClientRect().right > ancho + 1 && getComputedStyle(el).position !== 'fixed')
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
          return { scroll: document.documentElement.scrollWidth > ancho + 1, culpables };
        });

        const base = ruta.replace(/^\/dashboard\/?/, '').replace(/[^\w-]+/g, '_') || 'inicio';
        const archivo = path.join(salida, `${base}-${nombre}${tema === 'dark' ? '-oscuro' : ''}.png`);
        await pagina.screenshot({ path: archivo, fullPage: true });

        const avisos = [];
        if (desborde.scroll) avisos.push(`desborde horizontal (${desborde.culpables.join(', ') || 'sin culpable claro'})`);
        if (errores.length) avisos.push(`${errores.length} error(es) de consola: ${errores[0].slice(0, 120)}`);
        if (avisos.length) problemas += 1;
        console.log(`${avisos.length ? '⚠️ ' : '✅'} ${ruta} · ${nombre}${tema === 'dark' ? ' · oscuro' : ''} -> ${path.relative(process.cwd(), archivo)}${avisos.length ? `\n     ${avisos.join('\n     ')}` : ''}`);
        await ctx.close();
      }
    }
  }
  await navegador.close();
  console.log(problemas ? `\n${problemas} captura(s) con avisos.` : '\nTodo en orden.');
})().catch((e) => { console.error(e.message); process.exit(1); });
