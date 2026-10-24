import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getProveedores, createProveedor, updateProveedor } from '../../../../services/proveedorService';
import { getCategoriesByUser } from '../../../../services/categoryServices';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';
import './precios.css';

const ESTADO_OPTS = ['Activo', 'Inactivo'];
const TIPO_CUENTA_OPTS = ['Ahorros', 'Corriente'];
const RUTA_LISTA = '/dashboard/proveedores';

const VACIO = {
  razonSocial: '', nombreProveedor: '', nit: '', telefono: '',
  correo: '', direccion: '', banco: '', numeroCuenta: '',
  tipoCuenta: '', categoriaids: [], estado: 'Activo',
};

// Crear o editar un proveedor: pantalla completa (ruta), no ventana emergente
function ProveedorForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const [form, setForm] = useState(VACIO);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getCategoriesByUser().then(setCategorias).catch(() => toast.error('No se pudieron cargar las categorías.'));
  }, []);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const p = (await getProveedores()).find((x) => String(x.proveedorid) === String(id));
        if (!p) {
          toast.error('No se encontró el proveedor.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setForm({
          razonSocial: p.razonSocial || '', nombreProveedor: p.nombreProveedor || '',
          nit: p.nit || '', telefono: p.telefono || '', correo: p.correo || '',
          direccion: p.direccion || '', banco: p.banco || '', numeroCuenta: p.numeroCuenta || '',
          tipoCuenta: p.tipoCuenta || '', categoriaids: (p.categorias || []).map((c) => c.categoriaid),
          estado: p.estado || 'Activo',
        });
      } catch {
        toast.error('No se pudo cargar el proveedor.');
        navigate(RUTA_LISTA, { replace: true });
      } finally {
        setCargando(false);
      }
    })();
  }, [id, editando, navigate]);

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const alternarCategoria = (categoriaid) => setForm((f) => ({
    ...f,
    categoriaids: f.categoriaids.includes(categoriaid) ? f.categoriaids.filter((c) => c !== categoriaid) : [...f.categoriaids, categoriaid],
  }));

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        await updateProveedor(id, form);
        toast.success('Proveedor actualizado.');
      } else {
        await createProveedor(form);
        toast.success('Proveedor registrado.');
      }
      navigate(RUTA_LISTA);
    } catch (error) {
      toast.error(error?.mensaje || error?.response?.data?.mensaje || 'No se pudo guardar el proveedor.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Proveedores / {editando ? 'Editar' : 'Nuevo'}</>}>
        {editando ? 'Editar proveedor' : 'Nuevo proveedor'}
      </EncabezadoPagina>

      <form className="ct-form" onSubmit={guardar}>
        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <h2>Datos del proveedor</h2>
          <p>Con la razón social basta para registrarlo; el resto lo puedes completar después.</p>
          <div className="ct-campos">
            <div className="ct-campo">
              <label htmlFor="prov-razon">Nombre / razón social *</label>
              <input id="prov-razon" name="razonSocial" value={form.razonSocial} onChange={cambiar} required autoFocus />
            </div>
            <div className="ct-campo">
              <label htmlFor="prov-contacto">Nombre de contacto <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-contacto" name="nombreProveedor" value={form.nombreProveedor} onChange={cambiar} />
            </div>
            <div className="ct-campo">
              <label htmlFor="prov-estado">Estado *</label>
              <select id="prov-estado" name="estado" value={form.estado} onChange={cambiar} required>
                {ESTADO_OPTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <h2>Categorías que suministra</h2>
          <p>Los precios por cantidad de este proveedor solo cuentan los productos de estas categorías.</p>
          {categorias.length === 0 ? (
            <p className="campo-opcional">Aún no tienes categorías creadas.</p>
          ) : (
            <div className="pf-categorias" role="group" aria-label="Categorías que suministra">
              {categorias.map((c) => (
                <label key={c.categoriaid} className={`pf-categoria${form.categoriaids.includes(c.categoriaid) ? ' pf-categoria--activa' : ''}`}>
                  <input type="checkbox" checked={form.categoriaids.includes(c.categoriaid)} onChange={() => alternarCategoria(c.categoriaid)} />
                  <span>{c.nombre}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="ct-form-tarjeta">
          <h2>Contacto y ubicación</h2>
          <div className="ct-campos">
            <div className="ct-campo">
              <label htmlFor="prov-nit">NIT <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-nit" name="nit" value={form.nit} onChange={cambiar} />
            </div>
            <div className="ct-campo">
              <label htmlFor="prov-telefono">Teléfono <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-telefono" name="telefono" type="tel" inputMode="tel" value={form.telefono} onChange={cambiar} />
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="prov-correo">Correo <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-correo" name="correo" type="email" value={form.correo} onChange={cambiar} />
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="prov-direccion">Dirección <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-direccion" name="direccion" value={form.direccion} onChange={cambiar} />
            </div>
          </div>
        </section>

        <section className="ct-form-tarjeta">
          <h2>Datos bancarios</h2>
          <div className="ct-campos">
            <div className="ct-campo">
              <label htmlFor="prov-banco">Banco <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-banco" name="banco" value={form.banco} onChange={cambiar} />
            </div>
            <div className="ct-campo">
              <label htmlFor="prov-tipo">Tipo de cuenta <span className="campo-opcional">(opcional)</span></label>
              <select id="prov-tipo" name="tipoCuenta" value={form.tipoCuenta} onChange={cambiar}>
                <option value="">Sin especificar</option>
                {TIPO_CUENTA_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="prov-cuenta">Número de cuenta <span className="campo-opcional">(opcional)</span></label>
              <input id="prov-cuenta" name="numeroCuenta" inputMode="numeric" value={form.numeroCuenta} onChange={cambiar} />
            </div>
          </div>
        </section>

        <div className="ct-form-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={() => navigate(RUTA_LISTA)}>Cancelar</button>
          <button type="submit" className="ct-btn ct-btn--primario" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar proveedor'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProveedorForm;
