import React, { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateProduct } from "../../../../../services/productServices";
import { getCategoriesByUser } from "../../../../../services/categoryServices";
import './styles/CrearProductoForm.css';
import './styles/EditarProductoForm.css';

const formatCOP = (val) =>
  val
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(val)
    : null;

function EditarProductoForm({ producto, onClose, onUpdate }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidadDisponible, setCantidadDisponible] = useState(0);
  const [precioCompra, setPrecioCompra] = useState(0);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [categoriaId, setCategoriaId] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [imagenes, setImagenes] = useState([]);
  const [preview, setPreview] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre || "");
      setDescripcion(producto.descripcion || "");
      setCantidadDisponible(producto.cantidadDisponible || 0);
      setPrecioCompra(producto.precioCompra || 0);
      setPrecioVenta(producto.precioVenta || 0);
      setCategoriaId(producto.categoriaid || "");
      setPreview(producto.imagenes || []);
    }
  }, [producto]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategoriesByUser();
        setCategorias(data);
      } catch (error) {
        console.error("Error al obtener categorías:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    return () => {
      preview.forEach((url) => { if (url.startsWith('blob:')) URL.revokeObjectURL(url); });
    };
  }, [preview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCargando(true);
    try {
      const categoriaSeleccionada = categorias.find(cat => String(cat.categoriaid) === String(categoriaId));
      if (!categoriaSeleccionada) throw new Error("Por favor selecciona una categoría válida");

      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("descripcion", descripcion);
      formData.append("cantidadDisponible", Number(cantidadDisponible));
      formData.append("precioCompra", Number(precioCompra));
      formData.append("precioVenta", Number(precioVenta));
      formData.append("categoriaid", Number(categoriaId));
      formData.append("categoria_nombre", categoriaSeleccionada.nombre);
      imagenes.forEach((img) => formData.append("imagenes", img));

      const response = await updateProduct(producto.productoid, formData);
      if (!response) throw new Error("No se recibió respuesta del servidor.");

      onUpdate(response.producto || response);
      onClose();
      toast.success("Producto actualizado correctamente.");
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el producto.");
    } finally {
      setCargando(false);
    }
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    setImagenes(files);
    setPreview(files.map((f) => URL.createObjectURL(f)));
  };

  const margen = precioCompra > 0 && precioVenta > 0
    ? (((precioVenta - precioCompra) / precioCompra) * 100).toFixed(1)
    : null;

  return (
    <div className="popup editar-card">

        <div className="popup-header">
          <div className="popup-header-left">
            <Pencil size={15} className="popup-header-icon" />
            <h2>Editar Producto</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} encType="multipart/form-data" className="popup-body">

          <p className="form-section-title">Información básica</p>

          <div className="form-group">
            <label htmlFor="editNombre">Nombre <span className="required">*</span></label>
            <input
              type="text"
              id="editNombre"
              placeholder="Ej: Arroz Diana 500g"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="editDescripcion">Descripción <span className="required">*</span></label>
            <textarea
              id="editDescripcion"
              placeholder="Describe el producto brevemente"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="editCategoria">Categoría <span className="required">*</span></label>
              <select
                id="editCategoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {categorias.map((cat) => (
                  <option key={cat.categoriaid} value={cat.categoriaid}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="editCantidad">Stock disponible <span className="required">*</span></label>
              <input
                type="number"
                id="editCantidad"
                min="0"
                placeholder="0"
                value={cantidadDisponible}
                onChange={(e) => setCantidadDisponible(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="form-section-title">Precios</p>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="editPrecioCompra">Precio de compra <span className="required">*</span></label>
              <input
                type="number"
                id="editPrecioCompra"
                placeholder="0"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(parseInt(e.target.value) || 0)}
                required
              />
              {formatCOP(precioCompra) && <span className="field-preview">{formatCOP(precioCompra)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="editPrecioVenta">Precio de venta <span className="required">*</span></label>
              <input
                type="number"
                id="editPrecioVenta"
                placeholder="0"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(parseInt(e.target.value) || 0)}
                required
              />
              {formatCOP(precioVenta) && <span className="field-preview">{formatCOP(precioVenta)}</span>}
            </div>
          </div>

          {margen !== null && (
            <div className="editar-margen-card">
              <span className="editar-margen-label">Margen estimado</span>
              <span className="editar-margen-valor">{margen}%</span>
            </div>
          )}

          <p className="form-section-title">Imágenes</p>

          <div className="form-group">
            <label htmlFor="editImagenes">Fotos del producto</label>
            <input
              type="file"
              id="editImagenes"
              multiple
              accept="image/*"
              onChange={handleImageChange}
            />
            <span className="field-helper">Sube nuevas imágenes para reemplazar las actuales.</span>
          </div>

          {preview.length > 0 && (
            <div className="preview-container">
              {preview.map((img, i) => (
                <img
                  key={i}
                  src={img.startsWith('blob:') ? img : img.startsWith('http') ? img : `http://localhost:3000/uploads/${img}`}
                  alt="Vista previa"
                  className="preview-image"
                />
              ))}
            </div>
          )}

          <div className="form-buttons">
            <button type="button" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" disabled={cargando}>
              {cargando ? <><span className="btn-spinner" />Guardando...</> : 'Guardar cambios'}
            </button>
          </div>
        </form>
    </div>
  );
}

export default EditarProductoForm;
