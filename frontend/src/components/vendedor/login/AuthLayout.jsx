import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Boxes, ClipboardList, Eye, EyeOff, LineChart } from 'lucide-react';
import logo from './LoginAssets/logo.png';
import './styles/auth.css';

const BENEFICIOS = [
  { icono: Boxes, titulo: 'Inventario al día', texto: 'Productos con tallas, unidades de medida y alertas de stock bajo.' },
  { icono: ClipboardList, titulo: 'Pedidos y cobros', texto: 'Las compras de tus clientes dentro de cada pedido al proveedor, con abonos y entregas.' },
  { icono: LineChart, titulo: 'Balance claro', texto: 'Ingresos, egresos y estadísticas para decidir con datos.' },
];

// Marco compartido de Iniciar sesión y Registro: panel de marca a la izquierda (solo pantallas anchas) y tarjeta con el formulario
export function AuthLayout({ titulo, subtitulo, ancho = false, children, pie }) {
  return (
    <div className="auth-pagina">
      <aside className="auth-marca" aria-label="Sobre OrderEasy">
        <div className="auth-marca-contenido">
          <span className="auth-marca-nombre">OrderEasy</span>
          <h2>Tu negocio, siempre bajo control</h2>
          <p>Inventario, ventas, egresos y pedidos en un solo lugar, pensado para comercios que quieren crecer.</p>
          <ul className="auth-beneficios">
            {BENEFICIOS.map(({ icono: Icono, titulo: t, texto }) => (
              <li key={t}>
                <span className="auth-beneficio-icono"><Icono size={18} aria-hidden="true" /></span>
                <div><strong>{t}</strong><span>{texto}</span></div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-formulario">
        <Link to="/" className="auth-volver"><ArrowLeft size={16} aria-hidden="true" /><span>Volver al inicio</span></Link>
        <div className={`auth-tarjeta${ancho ? ' auth-tarjeta--ancha' : ''}`}>
          <Link to="/" className="auth-logo" aria-label="OrderEasy, ir al inicio"><img src={logo} alt="OrderEasy" /></Link>
          <h1>{titulo}</h1>
          {subtitulo && <p className="auth-subtitulo">{subtitulo}</p>}
          {children}
        </div>
        {pie && <p className="auth-pie">{pie}</p>}
      </main>
    </div>
  );
}

// Campo con etiqueta visible; con `tipo="password"` agrega el botón de mostrar u ocultar
export function Campo({ etiqueta, tipo = 'text', ayuda, completo = false, ...resto }) {
  const idGenerado = useId();
  const id = resto.id || idGenerado;
  const [visible, setVisible] = useState(false);
  const esClave = tipo === 'password';
  return (
    <div className={`auth-campo${completo ? ' auth-campo--completo' : ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="auth-entrada">
        <input {...resto} id={id} type={esClave && visible ? 'text' : tipo} aria-describedby={ayuda ? `${id}-ayuda` : undefined} />
        {esClave && (
          <button type="button" className="auth-ojo" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}>
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {ayuda && <small id={`${id}-ayuda`}>{ayuda}</small>}
    </div>
  );
}
