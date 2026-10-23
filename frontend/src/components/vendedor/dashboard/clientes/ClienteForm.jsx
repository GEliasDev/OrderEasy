import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getClientes, createCliente, updateCliente } from '../../../../services/clienteService';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';

const VACIO = { nombreCliente: '', telefono: '', correo: '', direccion: '' };
const RUTA_LISTA = '/dashboard/clientes';

// Crear o editar un cliente: pantalla completa (ruta), no ventana emergente
function ClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const [form, setForm] = useState(VACIO);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const cliente = (await getClientes()).find((c) => String(c.clienteid) === String(id));
        if (!cliente) {
          toast.error('No se encontró el cliente.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setForm({
          nombreCliente: cliente.nombreCliente || '',
          telefono: cliente.telefono ?? '',
          correo: cliente.correo ?? '',
          direccion: cliente.direccion ?? '',
        });
      } catch {
        toast.error('No se pudo cargar el cliente.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, editando, navigate]);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        await updateCliente(id, form);
        toast.success('Cliente actualizado.');
      } else {
        await createCliente(form);
        toast.success('Cliente registrado.');
      }
      navigate(RUTA_LISTA);
    } catch (error) {
      toast.error(error?.mensaje || error?.response?.data?.mensaje || 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Clientes / {editando ? 'Editar' : 'Nuevo'}</>}>
        {editando ? 'Editar cliente' : 'Nuevo cliente'}
      </EncabezadoPagina>

      <form className="ct-form" onSubmit={guardar}>
        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <h2>Datos del cliente</h2>
          <p>Solo el nombre es obligatorio; el resto sirve para contactarlo y enviarle recibos.</p>
          <div className="ct-campos">
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="cli-nombre">Nombre del cliente *</label>
              <input id="cli-nombre" name="nombreCliente" value={form.nombreCliente} onChange={cambiar} required autoFocus placeholder="Nombre completo" />
            </div>
            <div className="ct-campo">
              <label htmlFor="cli-telefono">Teléfono <span className="campo-opcional">(opcional)</span></label>
              <input id="cli-telefono" name="telefono" type="tel" inputMode="tel" value={form.telefono} onChange={cambiar} placeholder="3001234567" />
            </div>
            <div className="ct-campo">
              <label htmlFor="cli-correo">Correo <span className="campo-opcional">(opcional)</span></label>
              <input id="cli-correo" name="correo" type="email" value={form.correo} onChange={cambiar} placeholder="correo@email.com" />
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="cli-direccion">Dirección <span className="campo-opcional">(opcional)</span></label>
              <input id="cli-direccion" name="direccion" value={form.direccion} onChange={cambiar} placeholder="Calle 123 #45-67" />
            </div>
          </div>
        </section>

        <div className="ct-form-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={() => navigate(RUTA_LISTA)}>Cancelar</button>
          <button type="submit" className="ct-btn ct-btn--primario" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ClienteForm;
