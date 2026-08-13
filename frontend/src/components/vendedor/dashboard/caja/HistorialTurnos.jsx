import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, ArrowLeft, Banknote, CreditCard, Smartphone, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import axiosInstance from '../../../../api/axiosConfig';
import './HistorialTurnos.css';

const fmt = (n) => Number(n || 0).toLocaleString('es-CO');

const fmtFecha = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const duracion = (apertura, cierre) => {
  if (!cierre) return null;
  const diff = new Date(cierre) - new Date(apertura);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

function HistorialTurnos() {
  const navigate = useNavigate();
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    axiosInstance
      .get('/api/turnos')
      .then((res) => setTurnos(res.data.turnos || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const turnosFiltrados = turnos.filter((t) => {
    if (filtro === 'abiertos') return t.estado === 'abierto';
    if (filtro === 'cerrados') return t.estado === 'cerrado';
    return true;
  });

  const toggle = (id) => setExpandido((prev) => (prev === id ? null : id));

  return (
    <div className="ht-page">
      <div className="ht-header">
        <button className="ht-back" onClick={() => navigate('/dashboard/configuracion')}>
          <ArrowLeft size={16} />
        </button>
        <div className="ht-header-icon"><History size={18} /></div>
        <div>
          <h1 className="ht-titulo">Historial de Turnos</h1>
          <p className="ht-subtitulo">Registro de aperturas y cierres de caja</p>
        </div>
        <div className="ht-filtros">
          {['todos', 'abiertos', 'cerrados'].map((f) => (
            <button
              key={f}
              className={`ht-filtro-btn ${filtro === f ? 'activo' : ''}`}
              onClick={() => setFiltro(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="ht-loading"><div className="ht-spinner" /></div>
      ) : turnosFiltrados.length === 0 ? (
        <div className="ht-empty">
          <History size={40} strokeWidth={1.5} />
          <p>No hay turnos registrados</p>
        </div>
      ) : (
        <div className="ht-lista">
          {turnosFiltrados.map((t) => {
            const diferencia = t.montoEfectivoReal !== null && t.montoEfectivoReal !== undefined
              ? Number(t.montoEfectivoReal) - Number(t.resumen?.efectivoEsperado || 0)
              : null;
            const abierto = t.estado === 'abierto';
            const dur = duracion(t.fechaApertura, t.fechaCierre);
            const nombre = t.usuario
              ? `${t.usuario.primer_nombre || ''} ${t.usuario.primer_apellido || ''}`.trim()
              : 'Usuario';

            return (
              <div key={t.turnoid} className={`ht-card ${abierto ? 'abierto' : ''}`}>
                <div className="ht-card-top" onClick={() => toggle(t.turnoid)}>
                  <div className="ht-card-left">
                    <span className={`ht-badge ${abierto ? 'badge-abierto' : 'badge-cerrado'}`}>
                      {abierto ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                      {abierto ? 'Abierto' : 'Cerrado'}
                    </span>
                    <div className="ht-card-info">
                      <span className="ht-card-nombre">{nombre}</span>
                      <span className="ht-card-fecha">{fmtFecha(t.fechaApertura)}</span>
                    </div>
                  </div>

                  <div className="ht-card-stats">
                    <div className="ht-stat">
                      <span className="ht-stat-label">Ventas</span>
                      <span className="ht-stat-val">{t.resumen?.totalVentas ?? 0}</span>
                    </div>
                    <div className="ht-stat">
                      <span className="ht-stat-label">Total</span>
                      <span className="ht-stat-val verde">${fmt(t.resumen?.totalVendido)}</span>
                    </div>
                    {diferencia !== null && (
                      <div className="ht-stat">
                        <span className="ht-stat-label">Diferencia</span>
                        <span className={`ht-stat-val ${diferencia === 0 ? '' : diferencia > 0 ? 'verde' : 'rojo'}`}>
                          {diferencia === 0 ? '±0' : diferencia > 0 ? `+$${fmt(diferencia)}` : `-$${fmt(Math.abs(diferencia))}`}
                        </span>
                      </div>
                    )}
                    {dur && (
                      <div className="ht-stat">
                        <span className="ht-stat-label">Duración</span>
                        <span className="ht-stat-val">{dur}</span>
                      </div>
                    )}
                  </div>

                  <button className={`ht-expand-btn ${expandido === t.turnoid ? 'expandido' : ''}`}>
                    ▾
                  </button>
                </div>

                {expandido === t.turnoid && (
                  <div className="ht-detalle">
                    <div className="ht-detalle-grid">
                      <div className="ht-detalle-col">
                        <p className="ht-detalle-titulo">Pagos recibidos</p>
                        <div className="ht-detalle-fila">
                          <span><Banknote size={13} /> Efectivo</span>
                          <span>${fmt(t.resumen?.efectivo)}</span>
                        </div>
                        <div className="ht-detalle-fila">
                          <span><CreditCard size={13} /> Tarjeta</span>
                          <span>${fmt(t.resumen?.tarjeta)}</span>
                        </div>
                        <div className="ht-detalle-fila">
                          <span><Smartphone size={13} /> Transferencia</span>
                          <span>${fmt(t.resumen?.transferencia)}</span>
                        </div>
                        <div className="ht-detalle-fila negrita">
                          <span><TrendingUp size={13} /> Total vendido</span>
                          <span>${fmt(t.resumen?.totalVendido)}</span>
                        </div>
                      </div>

                      <div className="ht-detalle-col">
                        <p className="ht-detalle-titulo">Caja</p>
                        <div className="ht-detalle-fila">
                          <span>Monto inicial</span>
                          <span>${fmt(t.montoInicial)}</span>
                        </div>
                        <div className="ht-detalle-fila">
                          <span>Efectivo esperado</span>
                          <span>${fmt(t.resumen?.efectivoEsperado)}</span>
                        </div>
                        {t.montoEfectivoReal !== null && t.montoEfectivoReal !== undefined && (
                          <>
                            <div className="ht-detalle-fila">
                              <span>Efectivo real</span>
                              <span>${fmt(t.montoEfectivoReal)}</span>
                            </div>
                            <div className={`ht-detalle-fila negrita ${diferencia === 0 ? '' : diferencia > 0 ? 'verde' : 'rojo'}`}>
                              <span>
                                {diferencia === 0
                                  ? <><CheckCircle2 size={12} /> Cuadre perfecto</>
                                  : diferencia > 0
                                    ? <><AlertCircle size={12} /> Sobrante</>
                                    : <><AlertCircle size={12} /> Faltante</>
                                }
                              </span>
                              <span>${fmt(Math.abs(diferencia))}</span>
                            </div>
                          </>
                        )}
                        {t.fechaCierre && (
                          <div className="ht-detalle-fila">
                            <span>Cierre</span>
                            <span>{fmtFecha(t.fechaCierre)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HistorialTurnos;
