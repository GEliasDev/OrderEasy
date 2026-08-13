import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, TrendingDown } from 'lucide-react';
import '../vistas/styles/TablaVentas.css';
import { getEgresos } from '../../../../../services/egresoService';
import { getProveedores } from '../../../../../services/proveedorService';
import { exportarEgresos } from '../exportarBalance';

const formatearFecha = (fecha) => {
  const d = new Date(fecha);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const REGISTROS_POR_PAGINA = 15;

const TablaEgresos = ({ from = '', to = '' }) => {
  const navigate = useNavigate();
  const [egresos, setEgresos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState(from);
  const [dateTo, setDateTo] = useState(to);
  const [selectedProveedor, setSelectedProveedor] = useState('');

  const fetchEgresos = async (f, t) => {
    try {
      const params = f && t ? { from: f, to: t } : {};
      const [egresosData, proveedoresData] = await Promise.all([
        getEgresos(params),
        getProveedores()
      ]);
      setEgresos(egresosData);
      setProveedores(proveedoresData);
      setPaginaActual(1);
    } catch (error) {
      console.error('Error al obtener datos:', error);
    }
  };

  useEffect(() => {
    setDateFrom(from);
    setDateTo(to);
    fetchEgresos(from, to);
  }, [from, to]);

  const handleDateChange = (f, t) => {
    setDateFrom(f);
    setDateTo(t);
    if ((f && t) || (!f && !t)) {
      fetchEgresos(f, t);
    }
  };

  const egresosFiltrados = egresos.filter((egreso) => {
    const nombresProductos = egreso.detalles?.map((d) => d.productoNombre).join(' ').toLowerCase() || '';
    const coincideBusqueda =
      nombresProductos.includes(searchTerm.toLowerCase()) ||
      egreso.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      egreso.proveedor?.nombreProveedor?.toLowerCase().includes(searchTerm.toLowerCase());
    const coincideProveedor = selectedProveedor
      ? selectedProveedor === 'null' ? !egreso.proveedorid : String(egreso.proveedorid) === String(selectedProveedor)
      : true;
    return coincideBusqueda && coincideProveedor;
  });

  const totalPaginas = Math.ceil(egresosFiltrados.length / REGISTROS_POR_PAGINA);
  const egresosPaginados = egresosFiltrados.slice(
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
        <h3>Egresos (Compras)</h3>
        <button
          className="tabla-export-btn"
          onClick={() => exportarEgresos(egresosFiltrados)}
          disabled={egresosFiltrados.length === 0}
          title="Exportar a Excel"
        >
          <FileDown size={14} />
          <span>Exportar</span>
        </button>
      </div>

      <div className="filters-container">
        <input
          type="text"
          placeholder="Buscar producto, proveedor o descripción..."
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
          value={selectedProveedor}
          onChange={(e) => { setSelectedProveedor(e.target.value); setPaginaActual(1); }}
        >
          <option value="">Todos los proveedores</option>
          <option value="null">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.proveedorid} value={p.proveedorid}>{p.nombreProveedor}</option>
          ))}
        </select>
      </div>

      <div className="results-count">
        {egresosFiltrados.length} resultado{egresosFiltrados.length !== 1 ? 's' : ''}
      </div>

      <table className="tabla-productos">
        <thead>
          <tr>
            <th className="text-left">Fecha</th>
            <th className="text-left">Productos</th>
            <th className="text-left">Descripción</th>
            <th className="text-left">Proveedor</th>
            <th className="text-right">Items</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {egresosPaginados.length > 0 ? (
            egresosPaginados.map((egreso) => {
              const totalItems = egreso.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0;
              const resumen = egreso.detalles?.length > 1
                ? `${egreso.detalles[0].productoNombre} (+${egreso.detalles.length - 1})`
                : egreso.detalles?.[0]?.productoNombre || '-';
              return (
                <tr
                  key={egreso.egresoid}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/dashboard/egreso/${egreso.egresoid}`, { state: { egreso } })}
                >
                  <td className="text-left">{formatearFecha(egreso.createdAt)}</td>
                  <td className="text-left"><strong>{resumen}</strong></td>
                  <td className="text-left">{egreso.descripcion || <span style={{ opacity: 0.4 }}>—</span>}</td>
                  <td className="text-left">{egreso.proveedor?.nombreProveedor || <span style={{ opacity: 0.5 }}>General</span>}</td>
                  <td className="text-right">{totalItems}</td>
                  <td className="text-right total-cell egreso-text">${Number(egreso.total).toLocaleString('es-CO')}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="6" className="tabla-empty">
                <TrendingDown size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                <p>{searchTerm || dateFrom || selectedProveedor ? 'Sin resultados para los filtros aplicados' : 'Aún no hay egresos registrados'}</p>
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

export default TablaEgresos;
