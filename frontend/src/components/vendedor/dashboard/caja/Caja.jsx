import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CreditCard, Lock } from 'lucide-react';
import BuscadorProductos from './BuscadorProductos';
import CarritoCaja from './CarritoCaja';
import PanelPago from './PanelPago';
import ConfirmacionVenta from './ConfirmacionVenta';
import AperturaCaja from './AperturaCaja';
import CierreCaja from './CierreCaja';
import { registrarVenta, getNegocio } from '../../../../services/cajaService';
import { getTurnoActivo } from '../../../../services/turnoCajaService';
import './Caja.css';

function Caja() {
  const [items, setItems] = useState([]);
  const [descuentoTotal, setDescuentoTotal] = useState(0);
  const [descuentoTipoTotal, setDescuentoTipoTotal] = useState('fijo');
  const [pagos, setPagos] = useState([]);
  const [step, setStep] = useState('carrito');
  const [ventaConfirmada, setVentaConfirmada] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [negocio, setNegocio] = useState(null);

  const [turno, setTurno] = useState(null);
  const [resumenTurno, setResumenTurno] = useState(null);
  const [loadingTurno, setLoadingTurno] = useState(true);
  const [mostrandoCierre, setMostrandoCierre] = useState(false);

  useEffect(() => {
    getNegocio().then(setNegocio).catch(() => {});
    getTurnoActivo()
      .then(({ turno, resumen }) => {
        setTurno(turno);
        setResumenTurno(resumen);
      })
      .catch(() => {})
      .finally(() => setLoadingTurno(false));
  }, []);

  const agregarProducto = (producto) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.producto.productoid === producto.productoid);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
        return copia;
      }
      return [...prev, { producto, cantidad: 1, descuento: 0, descuentoTipo: 'fijo' }];
    });
  };

  const actualizarCantidad = (index, cantidad) => {
    if (cantidad < 1) return;
    setItems((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad };
      return copia;
    });
  };

  const actualizarDescuentoItem = (index, descuento, descuentoTipo) => {
    setItems((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], descuento: Number(descuento) || 0, descuentoTipo };
      return copia;
    });
  };

  const eliminarItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const agregarPago = (metodo, monto) => {
    setPagos((prev) => [...prev, { metodo, monto: Number(monto) }]);
  };

  const eliminarPago = (index) => {
    setPagos((prev) => prev.filter((_, i) => i !== index));
  };

  const calcularTotales = () => {
    let subtotalBruto = 0;
    let totalDescuentosItem = 0;
    const ivaMap = {};

    items.forEach(({ producto, cantidad, descuento, descuentoTipo }) => {
      const sub = cantidad * Number(producto.precioVenta);
      const desc = descuentoTipo === 'porcentaje'
        ? sub * (Number(descuento) / 100)
        : Number(descuento);
      const neto = sub - desc;
      subtotalBruto += sub;
      totalDescuentosItem += desc;

      const tasa = Number(producto.tasaIva || 0);
      if (tasa > 0) {
        const monto = neto * tasa / (100 + tasa);
        ivaMap[tasa] = (ivaMap[tasa] || 0) + monto;
      }
    });

    const totalAntes = subtotalBruto - totalDescuentosItem;
    const descVenta = descuentoTipoTotal === 'porcentaje'
      ? totalAntes * (Number(descuentoTotal) / 100)
      : Number(descuentoTotal);
    const totalFinal = Math.max(0, totalAntes - descVenta);

    const ratio = totalAntes > 0 ? totalFinal / totalAntes : 1;
    const ivaDesglose = Object.entries(ivaMap).map(([tasa, monto]) => ({
      tasa: Number(tasa),
      monto: monto * ratio,
    }));
    const totalIva = ivaDesglose.reduce((acc, { monto }) => acc + monto, 0);
    const sumPagos = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

    return { subtotalBruto, totalDescuentosItem, descVenta, totalFinal, sumPagos, ivaDesglose, totalIva };
  };

  const registrar = async () => {
    setCargando(true);
    try {
      const payload = {
        clienteid: null,
        descripcion: '',
        items: items.map((i) => ({
          productoNombre: i.producto.nombre,
          cantidad: i.cantidad,
          descuento: i.descuento,
          descuentoTipo: i.descuentoTipo,
        })),
        descuentoTotal,
        descuentoTipoTotal,
        pagos,
      };
      const venta = await registrarVenta(payload);
      setVentaConfirmada(venta);
      setStep('confirmacion');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al registrar la venta');
    } finally {
      setCargando(false);
    }
  };

  const nuevaVenta = () => {
    setItems([]);
    setDescuentoTotal(0);
    setDescuentoTipoTotal('fijo');
    setPagos([]);
    setVentaConfirmada(null);
    setStep('carrito');
  };

  const handleTurnoCerrado = () => {
    setMostrandoCierre(false);
    setTurno(null);
    setResumenTurno(null);
    nuevaVenta();
  };

  const totales = calcularTotales();

  if (loadingTurno) {
    return (
      <div className="caja-loading">
        <div className="caja-loading-spinner" />
      </div>
    );
  }

  if (!turno) {
    return <AperturaCaja onTurnoAbierto={(t) => { setTurno(t); setResumenTurno({ efectivo: 0, tarjeta: 0, transferencia: 0, totalVendido: 0, totalVentas: 0, efectivoEsperado: Number(t.montoInicial) }); }} />;
  }

  if (step === 'confirmacion' && ventaConfirmada) {
    return <ConfirmacionVenta venta={ventaConfirmada} onNuevaVenta={nuevaVenta} negocio={negocio} />;
  }

  return (
    <div className="caja-page">
      <div className="caja-header">
        <CreditCard size={18} className="caja-header-icon" />
        <h2 className="caja-titulo">Terminal de Caja</h2>
        <button className="caja-btn-cerrar-turno" onClick={() => setMostrandoCierre(true)}>
          <Lock size={14} />
          Cerrar turno
        </button>
      </div>

      <div className="caja-layout">
        <div className="caja-izquierda">
          <BuscadorProductos onAgregarProducto={agregarProducto} />
        </div>
        <div className="caja-derecha">
          <CarritoCaja
            items={items}
            descuentoTotal={descuentoTotal}
            descuentoTipoTotal={descuentoTipoTotal}
            onCantidadChange={actualizarCantidad}
            onDescuentoItemChange={actualizarDescuentoItem}
            onEliminarItem={eliminarItem}
            onDescuentoTotalChange={(val, tipo) => {
              setDescuentoTotal(val);
              setDescuentoTipoTotal(tipo);
            }}
            totales={totales}
            ivaDesglose={totales.ivaDesglose || []}
            totalIva={totales.totalIva || 0}
          />
          <PanelPago
            total={totales.totalFinal}
            pagos={pagos}
            onAgregarPago={agregarPago}
            onEliminarPago={eliminarPago}
            onRegistrar={registrar}
            cargando={cargando}
          />
        </div>
      </div>

      {mostrandoCierre && resumenTurno && (
        <CierreCaja
          turno={turno}
          resumen={resumenTurno}
          onCerrado={handleTurnoCerrado}
          onCancelar={() => setMostrandoCierre(false)}
        />
      )}
    </div>
  );
}

export default Caja;
