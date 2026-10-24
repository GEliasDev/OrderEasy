import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { crearPedidoProveedor } from '../../../../services/pedidoService';
import { nombrePedido } from './comprasUtils';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../pedidos/Pedidos.css';
import './Compras.css';

function CrearPedidoProveedor() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);

  const volver = () => navigate('/dashboard/pedidos');

  const crear = async (e) => {
    e.preventDefault();
    try {
      setCreando(true);
      const orden = await crearPedidoProveedor({ nombre: nombre.trim() || undefined });
      toast.success(`${nombrePedido(orden)} creado. Agrégale las compras de tus clientes.`);
      navigate(`/dashboard/pedidos/${orden.ordenid}`, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.mensaje || 'No se pudo crear el pedido.');
      setCreando(false);
    }
  };

  return (
    <div className="detalle-tx-view detalle-ancho">
      <div className="pedido-pagina">
        <EncabezadoPagina onVolver={volver} migas={<>Pedidos / Nuevo</>}>Crear pedido</EncabezadoPagina>
        <div className="pedido-pagina-card">
          <form className="pedido-modal-form" onSubmit={crear}>
            <div className="pedido-form-group">
              <label htmlFor="nombre-pedido">Nombre del pedido (opcional)</label>
              <input
                id="nombre-pedido"
                type="text"
                maxLength={120}
                autoFocus
                placeholder="Ej. Pedido de octubre, Colección Aura..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <p className="pedido-ayuda">Si lo dejas vacío se llamará «Pedido N» (N es su número). Puedes cambiarlo cuando quieras.</p>
            <div className="pedido-modal-footer">
              <button type="button" className="pedidos-btn pedidos-btn-secundario" onClick={volver}>Cancelar</button>
              <button type="submit" className="pedidos-btn pedidos-btn-primary" disabled={creando}>{creando ? 'Creando...' : 'Crear pedido'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CrearPedidoProveedor;
