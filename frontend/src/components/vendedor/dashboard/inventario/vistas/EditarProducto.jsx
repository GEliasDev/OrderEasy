import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, ImageIcon, Save, X, DollarSign, Info, Barcode } from 'lucide-react';
import { toast } from 'sonner';
import { getProductById, updateProduct } from '../../../../../services/productServices';
import { getCategoriesByUser } from '../../../../../services/categoryServices';
import './styles/NuevoProducto.css';

const formatCOP = (val) =>
  val
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(val)
    : null;

function EditarProducto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidadDisponible, setCantidadDisponible] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [tasaIva, setTasaIva] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [imagenes, setImagenes] = useState([]);
  const [preview, setPreview] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [producto, cats] = await Promise.all([
          getProductById(id),
          getCategoriesByUser(),
        ]);

        if (!producto) {
          toast.error('No se pudo cargar el producto.');
          navigate('/dashboard/inventario');
          return;
        }

        setCategorias(cats);
        setNombre(producto.nombre || '');
        setDescripcion(producto.descripcion || '');
        setCantidadDisponible(producto.cantidadDisponible ?? '');
        setPrecioCompra(producto.precioCompra ?? '');
        setPrecioVenta(producto.precioVenta ?? '');
        setCategoriaId(producto.categoriaid || '');
        setCodigoBarras(producto.codigoBarras || '');
        setTasaIva(producto.tasaIva ?? 0);
        setPreview(
          (producto.imagenes || []).map((img) =>
            img.startsWith('http') ? img : `http://localhost:3000/uploads/${img}`
          )
        );
      } catch {
        toast.error('Ocurrió un error inesperado.');
        navigate('/dashboard/inventario');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    setImagenes(files);
    setPreview(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setCargando(true);
    try {
      const cat = categorias.find((c) => String(c.categoriaid) === String(categoriaId));
      if (!cat) throw new Error('Por favor selecciona una categoría válida');

      const formData = new FormData();
      formData.append('nombre', nombre);
      formData.append('descripcion', descripcion);
      formData.append('cantidadDisponible', Number(cantidadDisponible));
      formData.append('precioCompra', Number(precioCompra));
      formData.append('precioVenta', Number(precioVenta));
      formData.append('categoriaid', Number(categoriaId));
      formData.append('categoria_nombre', cat.nombre);
      formData.append('codigoBarras', codigoBarras.trim());
      formData.append('tasaIva', tasaIva);
      imagenes.forEach((img) => formData.append('imagenes', img));

      await updateProduct(id, formData);
      toast.success('Producto actualizado correctamente.');
      navigate(`/dashboard/producto/${id}`);
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el producto.');
    } finally {
      setCargando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="loader-spinner" />
      </div>
    );
  }

  const margen =
    precioCompra > 0 && precioVenta > 0
      ? (((precioVenta - precioCompra) / precioCompra) * 100).toFixed(1)
      : null;

  return (
    <div className="nuevo-producto-view">
      <div className="view-header">
        <button className="btn-circle-back" onClick={() => navigate(`/dashboard/producto/${id}`)} title="Volver">
          <ArrowLeft size={22} />
        </button>
        <div className="header-text">
          <h1>Editar Producto</h1>
          <span>Modifica los datos del producto</span>
        </div>
      </div>

      <div className="view-content">
        <form onSubmit={handleSubmit} className="minimal-form-grid">

          <div className="form-column">
            <div className="form-card-minimal">
              <div className="card-header-minimal">
                <Info size={18} />
                <h3>Información Básica</h3>
              </div>
              <div className="form-group-minimal">
                <label>Nombre del Producto</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  placeholder="Ej: Camisa Oxford Azul"
                />
              </div>
              <div className="form-group-minimal">
                <label>Descripción</label>
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                  placeholder="Especificaciones, material, etc."
                />
              </div>
              <div className="form-group-minimal">
                <label>
                  <Barcode size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.3rem' }} />
                  Código de Barras
                  <span className="campo-opcional"> (opcional)</span>
                </label>
                <input
                  type="text"
                  value={codigoBarras}
                  onChange={(e) => setCodigoBarras(e.target.value)}
                  placeholder="Ej: 7702001234567"
                />
              </div>
              <div className="form-row-minimal">
                <div className="form-group-minimal">
                  <label>Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map((cat) => (
                      <option key={cat.categoriaid} value={cat.categoriaid}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group-minimal">
                  <label>Stock Disponible</label>
                  <input
                    type="number"
                    value={cantidadDisponible}
                    onChange={(e) => setCantidadDisponible(e.target.value)}
                    required
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="form-column">
            <div className="form-card-minimal">
              <div className="card-header-minimal">
                <DollarSign size={18} />
                <h3>Costos y Ventas</h3>
              </div>
              <div className="form-group-minimal">
                <label>Precio de Compra</label>
                <input
                  type="number"
                  value={precioCompra}
                  onChange={(e) => setPrecioCompra(e.target.value)}
                  required
                  min="0"
                />
                <span className="price-hint">{formatCOP(precioCompra)}</span>
              </div>
              <div className="form-group-minimal">
                <label>Precio de Venta</label>
                <input
                  type="number"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  required
                  min="0"
                />
                <span className="price-hint">{formatCOP(precioVenta)}</span>
              </div>
              {margen !== null && (
                <div className="profit-badge-minimal">
                  Margen: <strong>{margen}%</strong>
                </div>
              )}
              <div className="form-group-minimal">
                <label>Tasa de IVA</label>
                <select value={tasaIva} onChange={(e) => setTasaIva(Number(e.target.value))}>
                  <option value={0}>0% — Exento</option>
                  <option value={5}>5%</option>
                  <option value={19}>19%</option>
                </select>
              </div>
            </div>

            <div className="form-card-minimal">
              <div className="card-header-minimal">
                <ImageIcon size={18} />
                <h3>Imágenes</h3>
              </div>
              <div className="simple-upload">
                <input type="file" id="file-up" multiple accept="image/*" onChange={handleImageChange} />
                <label htmlFor="file-up">Seleccionar imágenes</label>
              </div>
              <div className="previews-minimal">
                {preview.map((img, i) => (
                  <div key={i} className="preview-thumb">
                    <img src={img} alt="prev" />
                    <button
                      type="button"
                      onClick={() => {
                        const nI = [...imagenes]; nI.splice(i, 1); setImagenes(nI);
                        const nP = [...preview]; nP.splice(i, 1); setPreview(nP);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="form-actions-minimal">
            <button type="button" className="btn-cancel" onClick={() => navigate(`/dashboard/producto/${id}`)}>
              Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={cargando}>
              {cargando ? 'Guardando...' : <><Pencil size={18} /> Guardar cambios</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default EditarProducto;
