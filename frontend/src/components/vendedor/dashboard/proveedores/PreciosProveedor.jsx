import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { getProveedores, getPreciosProveedor, guardarPreciosProveedor } from '../../../../services/proveedorService';
import { getAllProducts } from '../../../../services/productServices';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';
import './precios.css';

const RUTA_LISTA = '/dashboard/proveedores';

const moneda = (valor) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(valor) || 0);

const aFilas = (escalones) => (escalones || []).map((e) => ({ desde: String(e.desde), precio: String(e.precio) }));

// Precios por cantidad de un proveedor: desde X unidades de un producto, cada unidad baja de precio
function PreciosProveedor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [proveedor, setProveedor] = useState(null);
  const [productos, setProductos] = useState([]);
  const [configurados, setConfigurados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoId, setNuevoId] = useState('');
  const [guardando, setGuardando] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [proveedores, todos, precios] = await Promise.all([getProveedores(), getAllProducts(), getPreciosProveedor(id)]);
        const p = proveedores.find((x) => String(x.proveedorid) === String(id));
        if (!p) {
          toast.error('No se encontró el proveedor.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setProveedor(p);
        setProductos(todos);
        setConfigurados(precios.map((x) => ({ ...x, filas: aFilas(x.escalones), guardado: true })));
      } catch {
        toast.error('No se pudieron cargar los precios por cantidad.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, navigate]);

  const disponibles = useMemo(() => {
    const usados = new Set(configurados.map((c) => c.productoid));
    return productos.filter((p) => !usados.has(p.productoid)).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
  }, [productos, configurados]);

  const agregarProducto = () => {
    const producto = productos.find((p) => String(p.productoid) === String(nuevoId));
    if (!producto) return;
    setConfigurados((prev) => [{ productoid: producto.productoid, nombre: producto.nombre, precioCompra: producto.precioCompra, unidadMedida: producto.unidadMedida, filas: [{ desde: '', precio: '' }], guardado: false }, ...prev]);
    setNuevoId('');
  };

  const cambiarFila = (productoid, indice, campo, valor) => {
    setConfigurados((prev) => prev.map((c) => (c.productoid !== productoid ? c : {
      ...c, guardado: false, filas: c.filas.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)),
    })));
  };

  const agregarFila = (productoid) => {
    setConfigurados((prev) => prev.map((c) => (c.productoid !== productoid ? c : { ...c, guardado: false, filas: [...c.filas, { desde: '', precio: '' }] })));
  };

  const quitarFila = (productoid, indice) => {
    setConfigurados((prev) => prev.map((c) => (c.productoid !== productoid ? c : { ...c, guardado: false, filas: c.filas.filter((_, i) => i !== indice) })));
  };

  const guardar = async (producto) => {
    const filas = producto.filas.filter((f) => f.desde !== '' || f.precio !== '');
    for (const f of filas) {
      if (!(Number(f.desde) > 0) || f.precio === '' || Number(f.precio) < 0) {
        toast.error('Cada escalón necesita una cantidad mayor a 0 y un precio.');
        return;
      }
    }
    if (new Set(filas.map((f) => Number(f.desde))).size !== filas.length) {
      toast.error('Hay cantidades repetidas.');
      return;
    }
    setGuardando(producto.productoid);
    try {
      const escalones = filas.map((f) => ({ desde: Number(f.desde), precio: Number(f.precio) })).sort((a, b) => a.desde - b.desde);
      await guardarPreciosProveedor(id, producto.productoid, escalones);
      if (escalones.length === 0) {
        setConfigurados((prev) => prev.filter((c) => c.productoid !== producto.productoid));
        toast.success('Precios por cantidad quitados.');
      } else {
        setConfigurados((prev) => prev.map((c) => (c.productoid !== producto.productoid ? c : { ...c, escalones, filas: aFilas(escalones), guardado: true })));
        toast.success('Precios por cantidad guardados.');
      }
    } catch (error) {
      toast.error(error?.mensaje || error?.response?.data?.mensaje || 'No se pudieron guardar los precios.');
    } finally {
      setGuardando(null);
    }
  };

  const quitarProducto = (producto) => guardar({ ...producto, filas: [] });

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Proveedores / {proveedor?.razonSocial} / Precios por cantidad</>}>
        Precios por cantidad
      </EncabezadoPagina>

      <section className="ct-form-tarjeta pp-intro">
        <h2>{proveedor?.razonSocial}</h2>
        <p>Si le pides más unidades de un producto, el precio de cada unidad baja. Al llegar a una cantidad, <strong>todas</strong> las unidades salen a ese precio. Se suman todas las tallas, las compras de clientes y los productos para stock del mismo pedido. Solo cambia lo que le pagas al proveedor, no lo que cobras a tus clientes.</p>
        <div className="pp-agregar">
          <div className="ct-campo">
            <label htmlFor="pp-producto">Agregar un producto</label>
            <select id="pp-producto" value={nuevoId} onChange={(e) => setNuevoId(e.target.value)}>
              <option value="">Elige un producto…</option>
              {disponibles.map((p) => <option key={p.productoid} value={p.productoid}>{p.nombre}</option>)}
            </select>
          </div>
          <button type="button" className="ct-btn ct-btn--primario" onClick={agregarProducto} disabled={!nuevoId}>
            <Plus size={16} aria-hidden="true" /><span>Agregar</span>
          </button>
        </div>
      </section>

      {configurados.length === 0 ? (
        <div className="pp-vacio">
          <Tags size={28} aria-hidden="true" />
          <p>Aún no hay precios por cantidad con este proveedor.</p>
        </div>
      ) : (
        <div className="pp-lista">
          {configurados.map((c) => (
            <section key={c.productoid} className="ct-form-tarjeta pp-producto">
              <header className="pp-producto-cabecera">
                <div>
                  <h2>{c.nombre}</h2>
                  <p>Precio base: {moneda(c.precioCompra)} por {c.unidadMedida || 'und'} (se usa mientras no llegues al primer escalón)</p>
                </div>
                <button type="button" className="tbl-icon-btn tbl-icon-btn--borrar" title="Quitar este producto" aria-label={`Quitar precios de ${c.nombre}`} onClick={() => quitarProducto(c)} disabled={guardando === c.productoid}>
                  <Trash2 size={14} />
                </button>
              </header>

              <div className="pp-escalones">
                <div className="pp-escalones-titulos" aria-hidden="true"><span>Desde (unidades)</span><span>Precio por unidad</span><span /></div>
                {c.filas.map((f, i) => (
                  <div className="pp-escalon" key={i}>
                    <div className="ct-campo">
                      <label className="sr-only" htmlFor={`pp-desde-${c.productoid}-${i}`}>Desde cuántas unidades</label>
                      <input id={`pp-desde-${c.productoid}-${i}`} type="number" inputMode="decimal" min="0" step="any" placeholder="Ej: 6" value={f.desde} onChange={(e) => cambiarFila(c.productoid, i, 'desde', e.target.value)} />
                    </div>
                    <div className="ct-campo">
                      <label className="sr-only" htmlFor={`pp-precio-${c.productoid}-${i}`}>Precio por unidad</label>
                      <input id={`pp-precio-${c.productoid}-${i}`} type="number" inputMode="decimal" min="0" step="any" placeholder="Ej: 28000" value={f.precio} onChange={(e) => cambiarFila(c.productoid, i, 'precio', e.target.value)} />
                    </div>
                    <button type="button" className="tbl-icon-btn" aria-label="Quitar escalón" onClick={() => quitarFila(c.productoid, i)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pp-producto-acciones">
                <button type="button" className="ct-btn ct-btn--neutro" onClick={() => agregarFila(c.productoid)} disabled={c.filas.length >= 10}>
                  <Plus size={15} aria-hidden="true" /><span>Agregar escalón</span>
                </button>
                <button type="button" className="ct-btn ct-btn--primario" onClick={() => guardar(c)} disabled={c.guardado || guardando === c.productoid}>
                  <Save size={15} aria-hidden="true" /><span>{guardando === c.productoid ? 'Guardando...' : c.guardado ? 'Guardado' : 'Guardar'}</span>
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default PreciosProveedor;
