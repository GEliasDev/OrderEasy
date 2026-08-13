import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, TrendingUp } from 'lucide-react';
import '../vistas/styles/TablaVentas.css';
import { getVentas } from '../../../../../services/ventaService';
import { getClientes } from '../../../../../services/clienteService';
import { exportarVentas } from '../exportarBalance';

const formatearFecha = (fecha) => {
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const REGISTROS_POR_PAGINA = 15;

const TablaIngresos = ({ from = '', to = '' }) => {
  const navigate = useNavigate();
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(from);
  const [dateTo, setDateTo] = useState(to);
  const [selectedCliente, setSelectedCliente] = useState('');

  const fetchVentas = async (f, t) => {
    try {
      const params = f && t ? { from: f, to: t } : {};
      const [ventasData, clientesData] = await Promise.all([
        getVentas(params),
        getClientes()
      ]);
      setVentas(ventasData);
      setClientes(clientesData);
      setPaginaActual(1);
    } catch (error) {
      console.error('Error al obtener datos:', error);
    }
  };

  useEffect(() => {
    setDateFrom(from);
    setDateTo(to);
    fetchVentas(from, to);
  }, [from, to]);

  const handleDateChange = (f, t) => {
    setDateFrom(f);
    setDateTo(t);
    if ((f && t) || (!f && !t)) {
      fetchVentas(f, t);
    }
  };

  const ventasFiltradas = ventas.filter((venta) => {
    const nombresProductos = venta.detalles?.map((d) => d.productoNombre).join(' ').toLowerCase() || '';
    const coincideBusqueda =
      nombresProductos.includes(searchTerm.toLowerCase()) ||
      venta.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venta.cliente?.nombreCliente?.toLowerCase().includes(searchTerm.toLowerCase());
    const coincideCliente = selectedCliente
      ? selectedCliente === 'null' ? !venta.clienteid : String(venta.clienteid) === String(selectedCliente)
      : true;
    return coincideBusqueda && coincideCliente;
  });

  const totalPaginas = Math.ceil(ventasFiltradas.length / REGISTROS_POR_PAGINA);
  const ventasPaginadas = ventasFiltradas.slice(
    (paginaActual - 1) * REGISTROS_POR_PAGINA,
    paginaActual * REGISTROS_POR_PAGINA
  );

  const pageNumbers = Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => {
    if (totalPaginas <= 5) return i + 1;
    if (paginaActual <= 3) return i + 1;
    if (paginaActual >= totalPaginas - 2) return totalPaginas - 4 + i;
    return paginaActual - 2 + i;
  });

  return (
    <div className="tabla-container">
      <div className="tabla-top-bar">
        <h3>Ingresos (Ventas)</h3>
        <button
          className="tabla-export-btn"
          onClick={() => exportarVentas(ventasFiltradas)}
          disabled={ventasFiltradas.length === 0}
          title="Exportar a Excel"
        >
          <FileDown size={14} />
          <span>Exportar</span>
        </button>
      </div>

      <div className="filters-container">
        <input
          type="text"
          placeholder="Buscar producto, cliente o descripción..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPaginaActual(1); }}
          className="filter-input"
        />
        <div className="date-range-inputs">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange(e.target.value, dateTo)}
            className="filter-input filter-input--date"
          />
          <span className="date-range-sep">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange(dateFrom, e.target.value)}
            className="filter-input filter-input--date"
          />
        </div>
        <select
          className="filter-input"
          value={selectedCliente}
          onChange={(e) => { setSelectedCliente(e.target.value); setPaginaActual(1); }}
        >
          <option value="">Todos los clientes</option>
          <option value="null">Sin cliente</option>
          {clientes.map((c) => (
            <option key={c.clienteid} value={c.clienteid}>{c.nombreCliente}</option>
          ))}
        </select>
      </div>

      <div className="results-count">
        {ventasFiltradas.length} resultado{ventasFiltradas.length !== 1 ? 's' : ''}
      </div>

      <table className="tabla-productos">
        <thead>
          <tr>
            <th className="text-left">Fecha</th>
            <th className="text-left">Productos</th>
            <th className="text-left">Descripción</th>
            <th className="text-left">Cliente</th>
            <th className="text-right">Items</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {ventasPaginadas.length > 0 ? (
            ventasPaginadas.map((venta) => {
              const totalItems = venta.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0;
              const resumen = venta.detalles?.length > 1
                ? `${venta.detalles[0].productoNombre} (+${venta.detalles.length - 1})`
                : venta.detalles?.[0]?.productoNombre || '-';
              return (
                <tr
                  key={venta.ventaid}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/dashboard/venta/${venta.ventaid}`, { state: { venta } })}
                >
                  <td className="text-left">{formatearFecha(venta.createdAt)}</td>
                  <td className="text-left"><strong>{resumen}</strong></td>
                  <td className="text-left">{venta.descripcion || <span style={{ opacity: 0.4 }}>—</span>}</td>
                  <td className="text-left">{venta.cliente?.nombreCliente || <span style={{ opacity: 0.5 }}>General</span>}</td>
                  <td className="text-right">{totalItems}</td>
                  <td className="text-right total-cell">${Number(venta.total).toLocaleString('es-CO')}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6" className="tabla-empty">
                <TrendingUp size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p>{searchTerm || dateFrom || selectedCliente ? 'Sin resultados para los filtros aplicados' : 'Aún no hay ventas registradas'}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPaginas > 1 && (
        <div className="paginacion">
          <button onClick={() => setPaginaActual((p) => p - 1)} disabled={paginaActual === 1}>
            Anterior
          </button>
          <div className="paginacion-pages">
            {pageNumbers.map((n) => (
              <button
                key={n}
                className={`paginacion-page ${paginaActual === n ? 'paginacion-page--active' : ''}`}
                onClick={() => setPaginaActual(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button onClick={() => setPaginaActual((p) => p + 1)} disabled={paginaActual === totalPaginas}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default TablaIngresos;
