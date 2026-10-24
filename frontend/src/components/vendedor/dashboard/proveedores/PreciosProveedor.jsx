import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getProveedores, getPreciosProveedor, guardarPreciosProveedor } from '../../../../services/proveedorService';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';
import './precios.css';

const RUTA_LISTA = '/dashboard/proveedores';

const aFilas = (escalones) => (escalones || []).map((e) => ({ desde: String(e.desde), precio: String(e.precio) }));

// Precios por cantidad de un proveedor: desde X unidades pedidas en total (de cualquier producto), cada unidad baja a un precio fijo
function PreciosProveedor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proveedor, setProveedor] = useState(null);
  const [filas, setFilas] = useState([]);
  const [guardado, setGuardado] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [proveedores, precios] = await Promise.all([getProveedores(), getPreciosProveedor(id)]);
        const p = proveedores.find((x) => String(x.proveedorid) === String(id));
        if (!p) {
          toast.error('No se encontró el proveedor.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setProveedor(p);
        setFilas(aFilas(precios.escalones));
      } catch {
        toast.error('No se pudieron cargar los precios por cantidad.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, navigate]);

  const cambiarFila = (indice, campo, valor) => {
    setGuardado(false);
    setFilas((prev) => prev.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));
  };
  const agregarFila = () => { setGuardado(false); setFilas((prev) => [...prev, { desde: '', precio: '' }]); };
  const quitarFila = (indice) => { setGuardado(false); setFilas((prev) => prev.filter((_, i) => i !== indice)); };

  const guardar = async () => {
    const validas = filas.filter((f) => f.desde !== '' || f.precio !== '');
    for (const f of validas) {
      if (!(Number(f.desde) > 0) || f.precio === '' || Number(f.precio) < 0) {
        toast.error('Cada escalón necesita una cantidad mayor a 0 y un precio.');
        return;
      }
    }
    if (new Set(validas.map((f) => Number(f.desde))).size !== validas.length) {
      toast.error('Hay cantidades repetidas.');
      return;
    }
    setGuardando(true);
    try {
      const escalones = validas.map((f) => ({ desde: Number(f.desde), precio: Number(f.precio) })).sort((a, b) => a.desde - b.desde);
      await guardarPreciosProveedor(id, escalones);
      setFilas(aFilas(escalones));
      setGuardado(true);
      toast.success(escalones.length ? 'Precios por cantidad guardados.' : 'Precios por cantidad quitados.');
    } catch (error) {
      toast.error(error?.mensaje || error?.response?.data?.mensaje || 'No se pudieron guardar los precios.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Proveedores / {proveedor?.razonSocial} / Precios por cantidad</>}>
        Precios por cantidad
      </EncabezadoPagina>

      <section className="ct-form-tarjeta pp-intro">
        <h2>{proveedor?.razonSocial}</h2>
        <p>
          Si le pides más unidades en total a este proveedor, cada unidad baja de precio. Cuenta cualquier producto y talla de sus categorías en el mismo pedido
          (compras de clientes y productos para stock). Al llegar a una cantidad, <strong>todas</strong> esas unidades salen a ese precio.
          Mientras no llegues al primer escalón, cada producto va a su precio normal. Solo cambia lo que le pagas al proveedor, no lo que cobras a tus clientes.
        </p>

        {(proveedor?.categorias || []).length > 0 ? (
          <p className="pp-categorias-aviso">
            Aplica a las categorías: <strong>{proveedor.categorias.map((c) => c.nombre).join(', ')}</strong>.{' '}
            <button type="button" className="pp-enlace" onClick={() => navigate(`/dashboard/proveedores/${id}/editar`)}>Cambiar categorías</button>
          </p>
        ) : (
          <p className="pp-categorias-aviso pp-categorias-aviso--alerta" role="alert">
            Este proveedor no tiene categorías, así que estos precios no se aplican todavía.{' '}
            <button type="button" className="pp-enlace" onClick={() => navigate(`/dashboard/proveedores/${id}/editar`)}>Elegir categorías</button>
          </p>
        )}

        <div className="pp-escalones">
          <div className="pp-escalones-titulos" aria-hidden="true"><span>Desde (unidades en total)</span><span>Precio por unidad</span><span /></div>
          {filas.length === 0 && <p className="pp-sin-escalones">Aún no hay escalones. Agrega el primero, por ejemplo desde 6 unidades a $28.000.</p>}
          {filas.map((f, i) => (
            <div className="pp-escalon" key={i}>
              <div className="ct-campo">
                <label htmlFor={`pp-desde-${i}`}>Desde cuántas unidades</label>
                <input id={`pp-desde-${i}`} type="number" inputMode="decimal" min="0" step="any" placeholder="Ej: 6" value={f.desde} onChange={(e) => cambiarFila(i, 'desde', e.target.value)} />
              </div>
              <div className="ct-campo">
                <label htmlFor={`pp-precio-${i}`}>Precio por unidad</label>
                <input id={`pp-precio-${i}`} type="number" inputMode="decimal" min="0" step="any" placeholder="Ej: 28000" value={f.precio} onChange={(e) => cambiarFila(i, 'precio', e.target.value)} />
              </div>
              <button type="button" className="tbl-icon-btn" aria-label="Quitar escalón" onClick={() => quitarFila(i)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="pp-producto-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={agregarFila} disabled={filas.length >= 10}>
            <Plus size={15} aria-hidden="true" /><span>Agregar escalón</span>
          </button>
          <button type="button" className="ct-btn ct-btn--primario" onClick={guardar} disabled={guardado || guardando}>
            <Save size={15} aria-hidden="true" /><span>{guardando ? 'Guardando...' : guardado ? 'Guardado' : 'Guardar'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

export default PreciosProveedor;
