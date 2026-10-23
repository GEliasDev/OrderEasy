import { useEffect, useState, useMemo, useCallback } from "react";
import { TrendingDown } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCategoriesByUser } from "../../../../../services/categoryServices";
import { getAllProducts } from "../../../../../services/productServices";
import { createEgresoBatch } from "../../../../../services/egresoService";
import { getProveedores } from "../../../../../services/proveedorService";
import { useEsMovil } from '../../../../../hooks/useEsMovil';
import { useCarrito } from "../../../../../hooks/useCarrito";
import CarritoPantalla from '../../../../comunes/CarritoPantalla';

const RegistrarEgresoForm = () => {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const {
    carrito, productoParaTalla, elegirProducto, elegirTalla, cerrarSelectorTalla,
    actualizarCantidad, setCantidadDirecta, eliminarDelCarrito,
  } = useCarrito({ limitarPorStock: false });
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [categoriasData, productosData, proveedoresData] = await Promise.all([
          getCategoriesByUser(),
          getAllProducts(),
          getProveedores()
        ]);
        if (Array.isArray(categoriasData)) setCategorias(categoriasData);
        if (Array.isArray(productosData)) setProductos(productosData);
        if (Array.isArray(proveedoresData)) setProveedores(proveedoresData);
      } catch {
        toast.error("No se pudieron cargar los productos.");
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      const coincideCategoria = categoriaSeleccionada ? String(p.categoriaid) === String(categoriaSeleccionada) : true;
      return coincideBusqueda && coincideCategoria;
    });
  }, [productos, busqueda, categoriaSeleccionada]);

  const totalCarrito = carrito.reduce((sum, item) => sum + (Number(item.precioCompra) * item.cantidad), 0);

  const finalizarEgreso = async () => {
    if (carrito.length === 0) return;
    try {
      setProcesando(true);
      const items = carrito.map(item => ({
        productoNombre: item.nombre,
        talla: item.talla,
        cantidad: item.cantidad,
      }));
      await createEgresoBatch(items, proveedorId || null, descripcion);
      toast.success(`¡Egreso registrado! ${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades registradas.`);
      navigate("/dashboard/balance");
    } catch (error) {
      toast.error(error?.mensaje || "Ocurrió un problema al registrar el egreso.");
    } finally {
      setProcesando(false);
    }
  };

  const cerrarCarrito = useCallback(() => setCarritoAbierto(false), []);

  return (
    <CarritoPantalla
      tono="egreso"
      modoTalla="compra"
      titulo="Registrar egreso"
      subtitulo="Agrega la mercancía que compraste: el stock sube y el gasto queda en el balance."
      icono={TrendingDown}
      onVolver={() => navigate("/dashboard/balance")}
      tituloCarrito="Carrito de compra"
      textoBoton="Registrar egreso"
      etiquetaBarra="Registrar"
      textoTotal="Total del egreso"
      precioDe={(p) => Number(p.precioCompra)}
      productos={productosFiltrados}
      cargando={cargando}
      busqueda={busqueda}
      onBusqueda={setBusqueda}
      categorias={categorias}
      categoriaSeleccionada={categoriaSeleccionada}
      onCategoria={setCategoriaSeleccionada}
      contactoEtiqueta="Proveedor"
      contactoVacio="Proveedor genérico / otros"
      contactos={proveedores.map((p) => ({ id: p.proveedorid, nombre: p.razonSocial || p.nombreProveedor }))}
      contactoId={proveedorId}
      onContacto={setProveedorId}
      notas={descripcion}
      onNotas={setDescripcion}
      notasPlaceholder="Descripción o referencia del egreso..."
      carrito={carrito}
      totalCarrito={totalCarrito}
      onAgregar={elegirProducto}
      onCantidad={actualizarCantidad}
      onCantidadDirecta={setCantidadDirecta}
      onEliminar={eliminarDelCarrito}
      procesando={procesando}
      onFinalizar={finalizarEgreso}
      esMovil={esMovil}
      abierto={carritoAbierto}
      onAbrir={() => setCarritoAbierto(true)}
      onCerrar={cerrarCarrito}
      productoParaTalla={productoParaTalla}
      onElegirTalla={elegirTalla}
      onCerrarTalla={cerrarSelectorTalla}
    />
  );
};

export default RegistrarEgresoForm;
