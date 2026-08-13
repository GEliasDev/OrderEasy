import React, { useState, useEffect } from "react";
import { X, Package } from "lucide-react";
import { toast } from "sonner";
import "./styles/CrearProductoForm.css";
import { createProduct } from "../../../../../services/productServices";
import { getCategoriesByUser } from "../../../../../services/categoryServices";

const formatCOP = (val) =>
  val
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(val)
    : null;

function CrearProductoForm({ isVisible, onClose }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidadDisponible, setCantidadDisponible] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [imagenes, setImagenes] = useState([]);
  const [preview, setPreview] = useState([]);
  const [categoriaNombre, setCategoriaNombre] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);

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
      preview.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [preview]);

  if (!isVisible) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setCargando(true);
    try {
      const formData = new FormData();
      formData.append("nombre", nombre);
      formData.append("descripcion", descripcion);
      formData.append("cantidadDisponible", cantidadDisponible);
      formData.append("precioCompra", precioCompra);
      formData.append("precioVenta", precioVenta);
      formData.append("categoriaNombre", categoriaNombre);
      imagenes.forEach((img) => formData.append("imagenes", img));

      await createProduct(formData);
      toast.success("Producto creado correctamente.");
      setNombre(""); setDescripcion(""); setCantidadDisponible("");
      setPrecioCompra(""); setPrecioVenta(""); setImagenes([]); setPreview(""); setCategoriaNombre("");
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.mensaje || "Hubo un problema al crear el producto.");
    } finally {
      setCargando(false);
    }
  };

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files);
    setImagenes(files);
    setPreview(files.map((f) => URL.createObjectURL(f)));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-header">
          <div className="popup-header-left">
            <Package size={16} className="popup-header-icon" />
            <h2>Nuevo Producto</h2>
          </div>
          <button type="button" className="popup-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} encType="multipart/form-data" className="popup-body">

          <p className="form-section-title">Información básica</p>

          <div className="form-group">
            <label htmlFor="productoNombre">Nombre <span className="required">*</span></label>
            <input
              type="text"
              id="productoNombre"
              placeholder="Ej: Arroz Diana 500g"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="productoDescripcion">Descripción <span className="required">*</span></label>
            <textarea
              id="productoDescripcion"
              placeholder="Describe el producto brevemente"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="productoCategoria">Categoría <span className="required">*</span></label>
              <select
                id="productoCategoria"
                value={categoriaNombre}
                onChange={(e) => setCategoriaNombre(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {categorias.map((cat) => (
                  <option key={cat.categoriaId} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="productoCantidad">Stock inicial <span className="required">*</span></label>
              <input
                type="number"
                id="productoCantidad"
                placeholder="0"
                min="0"
                value={cantidadDisponible}
                onChange={(e) => setCantidadDisponible(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="form-section-title">Precios</p>

          <div className="form-row-2">
            <div className="form-group">
              <label htmlFor="productoPrecioCompra">Precio de compra <span className="required">*</span></label>
              <input
                type="number"
                id="productoPrecioCompra"
                placeholder="0"
                min="0"
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                required
              />
              {formatCOP(precioCompra) && (
                <span className="field-preview">{formatCOP(precioCompra)}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="productoPrecioVenta">Precio de venta <span className="required">*</span></label>
              <input
                type="number"
                id="productoPrecioVenta"
                placeholder="0"
                min="0"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                required
              />
              {formatCOP(precioVenta) && (
                <span className="field-preview">{formatCOP(precioVenta)}</span>
              )}
            </div>
          </div>

          <p className="form-section-title">Imágenes</p>

          <div className="form-group">
            <label htmlFor="productoImagenes">Fotos del producto</label>
            <input
              type="file"
              id="productoImagenes"
              multiple
              accept="image/*"
              onChange={handleImageChange}
            />
            <span className="field-helper">Puedes subir varias imágenes. Formatos: JPG, PNG, WEBP.</span>
          </div>

          {preview.length > 0 && (
            <div className="preview-container">
              {preview.map((img, i) => (
                <img key={i} src={img} alt="Vista previa" className="preview-image" />
              ))}
            </div>
          )}

          <div className="form-buttons">
            <button type="button" onClick={onClose} disabled={cargando}>
              Cancelar
            </button>
            <button type="submit" disabled={cargando}>
              {cargando ? (
                <><span className="btn-spinner" />Guardando...</>
              ) : (
                'Guardar Producto'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CrearProductoForm;
