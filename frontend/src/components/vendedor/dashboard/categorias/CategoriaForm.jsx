import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getCategoriesByUser, createCategory, updateCategory } from '../../../../services/categoryServices';
import EncabezadoPagina from '../../../comunes/EncabezadoPagina';
import '../../../comunes/contactos.css';

const RUTA_LISTA = '/dashboard/categorias';

// Crear o editar una categoría: pantalla completa (ruta), no ventana emergente
function CategoriaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editando = Boolean(id);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [cargando, setCargando] = useState(editando);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const categorias = await getCategoriesByUser();
        const c = (Array.isArray(categorias) ? categorias : []).find((x) => String(x.categoriaid) === String(id));
        if (!c) {
          toast.error('No se encontró la categoría.');
          navigate(RUTA_LISTA, { replace: true });
          return;
        }
        setForm({ nombre: c.nombre || '', descripcion: c.descripcion || '' });
      } catch {
        toast.error('No se pudo cargar la categoría.');
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
        await updateCategory(id, form);
        toast.success('Categoría actualizada.');
      } else {
        await createCategory(form);
        toast.success('Categoría registrada.');
      }
      navigate(RUTA_LISTA);
    } catch (error) {
      toast.error(error?.mensaje || error?.response?.data?.mensaje || 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <div className="view-loading"><div className="loader-spinner-dark" /></div>;

  return (
    <div className="ct-form-pagina">
      <EncabezadoPagina onVolver={() => navigate(RUTA_LISTA)} migas={<>Categorías / {editando ? 'Editar' : 'Nueva'}</>}>
        {editando ? 'Editar categoría' : 'Nueva categoría'}
      </EncabezadoPagina>

      <form className="ct-form" onSubmit={guardar}>
        <section className="ct-form-tarjeta ct-form-tarjeta--ancha">
          <h2>Datos de la categoría</h2>
          <div className="ct-campos">
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="cat-nombre">Nombre de la categoría *</label>
              <input id="cat-nombre" name="nombre" value={form.nombre} onChange={cambiar} required autoFocus placeholder="Ej: Sandalias" />
            </div>
            <div className="ct-campo ct-campo--completo">
              <label htmlFor="cat-descripcion">Descripción *</label>
              <textarea id="cat-descripcion" name="descripcion" value={form.descripcion} onChange={cambiar} required placeholder="Para qué productos sirve esta categoría" rows={4} />
            </div>
          </div>
        </section>

        <div className="ct-form-acciones">
          <button type="button" className="ct-btn ct-btn--neutro" onClick={() => navigate(RUTA_LISTA)}>Cancelar</button>
          <button type="submit" className="ct-btn ct-btn--primario" disabled={guardando}>
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Registrar categoría'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CategoriaForm;
