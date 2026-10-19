import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardList, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { crearLoteCompra, getPedidos, previewLoteCompra } from '../../../../services/pedidoService';
import { getProveedores } from '../../../../services/proveedorService';
import { formatearFecha, formatoMoneda } from './comprasUtils';
import '../balance/vistas/styles/DetalleTransaccion.css';
import '../pedidos/Pedidos.css';
import './Compras.css';

const ESTADOS_COMPRABLES = ['confirmado', 'en_compra', 'recibido'];
const pendienteDe = (detalle) => Math.round((Number(detalle.cantidad) - Number(detalle.cantidadEntregada || 0)) * 1000) / 1000;

function NuevaCompra() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [proveedorId, setProveedorId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [preview, setPreview] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const peticion = useRef(0);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [pedidosData, proveedoresData] = await Promise.all([getPedidos(), getProveedores()]);
        const comprables = (Array.isArray(pedidosData) ? pedidosData : [])
          .filter((p) => ESTADOS_COMPRABLES.includes(p.estado) && (p.detalles || []).some((d) => pendienteDe(d) > 0))
          .sort((a, b) => a.pedidoid - b.pedidoid);
        setPedidos(comprables);
        if (Array.isArray(proveedoresData)) setProveedores(proveedoresData);

        // ?pedidos=3,5 permite llegar con pedidos ya marcados
        const previos = String(searchParams.get('pedidos') || '').split(',').map(Number).filter(Boolean);
        if (previos.length) setSeleccion(new Set(previos.filter((id) => comprables.some((p) => p.pedidoid === id))));
      } catch {
        toast.error('No se pudieron cargar los pedidos.');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [searchParams]);

  // Cada vez que cambia la selección se recalcula qué hay que comprar
  const idsSeleccionados = useMemo(() => [...seleccion].sort((a, b) => a - b), [seleccion]);
  useEffect(() => {
    if (idsSeleccionados.length === 0) {
      setPreview(null);
      return undefined;
    }
    const mia = ++peticion.current;
    setCalculando(true);
    previewLoteCompra(idsSeleccionados)
      .then((data) => { if (mia === peticion.current) setPreview(data); })
      .catch((error) => {
        if (mia !== peticion.current) return;
        setPreview(null);
        toast.error(error?.response?.data?.mensaje || 'No se pudo calcular la compra.');
      })
      .finally(() => { if (mia === peticion.current) setCalculando(false); });
    return undefined;
  }, [idsSeleccionados]);

  const alternar = (id) => setSeleccion((prev) => {
    const siguiente = new Set(prev);
    if (siguiente.has(id)) siguiente.delete(id);
    else siguiente.add(id);
    return siguiente;
  });

  const todosMarcados = pedidos.length > 0 && pedidos.every((p) => seleccion.has(p.pedidoid));
  const alternarTodos = () => setSeleccion(todosMarcados ? new Set() : new Set(pedidos.map((p) => p.pedidoid)));

  const crear = async () => {
    try {
      setProcesando(true);
      const orden = await crearLoteCompra({
        pedidoids: idsSeleccionados,
        proveedorid: proveedorId || null,
        descripcion: descripcion.trim() || undefined,
      });
      toast.success(`Compra #${orden.ordenid} creada para ${idsSeleccionados.length} pedido(s).`);
      navigate(`/dashboard/compra/${orden.ordenid}`);
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo crear la compra.');
    } finally {
      setProcesando(false);
    }
  };

  const hayCompra = preview && preview.grupos.length > 0;

  return (
    <div className="pedidos-container">
      <div className="pedidos-header">
        <div className="compras-titulo-fila">
          <button className="btn-circle-back" onClick={() => navigate('/dashboard/compras')} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="pedidos-title">Nueva compra al proveedor</h1>
            <p className="pedidos-subtitle">Marca los pedidos de tus clientes: se compra solo lo que falta y queda registrado para quién es cada par.</p>
          </div>
        </div>
      </div>

      <div className="compras-nueva-grid">
        <section className="compras-panel">
          <div className="compras-panel-header">
            <h2><ClipboardList size={15} /> Pedidos por comprar</h2>
            {pedidos.length > 0 && (
              <label className="compras-check-todos">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
                <span>Marcar todos</span>
              </label>
            )}
          </div>

          {cargando ? (
            <p className="compras-vacio">Cargando pedidos...</p>
          ) : pedidos.length === 0 ? (
            <p className="compras-vacio">No hay pedidos confirmados con productos pendientes. Confirma un pedido para poder comprarlo.</p>
          ) : (
            <div className="compras-lista-pedidos">
              {pedidos.map((pedido) => {
                const pendientes = (pedido.detalles || []).filter((d) => pendienteDe(d) > 0);
                const enCompra = pendientes.reduce((s, d) => s + Number(d.enCompra || 0), 0);
                return (
                  <label key={pedido.pedidoid} className={`compras-pedido ${seleccion.has(pedido.pedidoid) ? 'marcado' : ''}`}>
                    <input type="checkbox" checked={seleccion.has(pedido.pedidoid)} onChange={() => alternar(pedido.pedidoid)} />
                    <div className="compras-pedido-info">
                      <strong>#{pedido.pedidoid} · {pedido.cliente?.nombreCliente || 'Sin cliente'}</strong>
                      <span>
                        {pendientes.map((d) => `${d.productoNombre}${d.talla ? ` (${d.talla})` : ''} x${pendienteDe(d)}`).join(' · ')}
                      </span>
                      <small>
                        {pedido.fechaEntrega ? `Entrega ${formatearFecha(pedido.fechaEntrega)}` : 'Sin fecha de entrega'}
                        {enCompra > 0 && ` · ya hay ${enCompra} en compra`}
                      </small>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        <section className="compras-panel">
          <div className="compras-panel-header">
            <h2><Truck size={15} /> Qué hay que comprar</h2>
          </div>

          {idsSeleccionados.length === 0 ? (
            <p className="compras-vacio">Marca uno o más pedidos para ver qué hay que comprar.</p>
          ) : calculando && !preview ? (
            <p className="compras-vacio">Calculando...</p>
          ) : preview && preview.grupos.length === 0 ? (
            <div className="compras-aviso">
              <AlertCircle size={16} />
              <span>El stock actual y las compras en curso ya cubren estos pedidos. No hace falta comprar más.</span>
            </div>
          ) : preview && (
            <>
              <div className="items-table-container">
                <table className="items-table compras-tabla-faltantes">
                  <thead>
                    <tr><th>Producto</th><th>Para quién</th><th>Faltan</th><th>Costo</th></tr>
                  </thead>
                  <tbody>
                    {preview.grupos.map((grupo) => (
                      <tr key={grupo.key}>
                        <td className="item-name">
                          {grupo.productoNombre}
                          {grupo.talla && <span className="cart-item-talla">Talla {grupo.talla}</span>}
                        </td>
                        <td className="compras-reparto-texto">
                          {grupo.lineas.filter((l) => l.faltante > 0).map((l) => `${l.cliente} ${l.faltante}`).join(' · ')}
                          {grupo.lineas.some((l) => l.cubiertoStock > 0) && (
                            <small>{` — ${grupo.lineas.reduce((s, l) => s + l.cubiertoStock, 0)} ya salen del stock`}</small>
                          )}
                        </td>
                        <td className="item-qty">{grupo.totalFaltante}</td>
                        <td className="item-subtotal">{formatoMoneda(grupo.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="footer-label">Total de la compra</td>
                      <td className="footer-value">{formatoMoneda(preview.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {preview.pedidos.some((p) => !p.conFaltante) && (
                <p className="pedido-ayuda">
                  {preview.pedidos.filter((p) => !p.conFaltante).map((p) => `#${p.pedidoid}`).join(', ')}: no necesitan compra (hay stock o ya viene en una compra).
                </p>
              )}
            </>
          )}

          <div className="compras-form">
            <div className="pedido-form-group">
              <label>Proveedor</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Sin proveedor asignado</option>
                {proveedores.map((p) => (
                  <option key={p.proveedorid} value={p.proveedorid}>{p.nombreProveedor || p.razonSocial}</option>
                ))}
              </select>
            </div>
            <div className="pedido-form-group">
              <label>Nota (opcional)</label>
              <input
                value={descripcion}
                maxLength={200}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: pedido semanal"
              />
            </div>
            <button className="pedidos-btn pedidos-btn-primary compras-btn-crear" disabled={!hayCompra || procesando} onClick={crear}>
              <CheckCircle2 size={16} />
              <span>{procesando ? 'Creando...' : `Crear compra${idsSeleccionados.length ? ` (${idsSeleccionados.length} pedido${idsSeleccionados.length > 1 ? 's' : ''})` : ''}`}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default NuevaCompra;
