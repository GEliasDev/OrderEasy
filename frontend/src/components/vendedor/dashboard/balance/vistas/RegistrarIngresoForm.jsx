import { useEffect, useState, useMemo, useCallback } from "react";
import { ShoppingCart } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCategoriesByUser } from "../../../../../services/categoryServices";
import { getAllProducts } from "../../../../../services/productServices";
import { createVentaBatch } from "../../../../../services/ventaService";
import { getClientes } from "../../../../../services/clienteService";
import { useEsMovil } from '../../../../../hooks/useEsMovil';
import { useCarrito } from "../../../../../hooks/useCarrito";
import CarritoPantalla from '../../../../comunes/CarritoPantalla';

const RegistrarIngresoForm = () => {
  const navigate = useNavigate();
  const esMovil = useEsMovil();
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const {
    carrito, productoParaTalla, elegirProducto, elegirTalla, cerrarSelectorTalla,
    actualizarCantidad, setCantidadDirecta, eliminarDelCarrito,
  } = useCarrito({ limitarPorStock: true });
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setCargando(true);
        const [categoriasData, productosData, clientesData] = await Promise.all([
          getCategoriesByUser(),
          getAllProducts(),
          getClientes()
        ]);
        if (Array.isArray(categoriasData)) setCategorias(categoriasData);
        if (Array.isArray(productosData)) setProductos(productosData);
        if (Array.isArray(clientesData)) setClientes(clientesData);
      } catch {
        toast.error("No se pudieron cargar los productos.");
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  const productosFiltrados = useMemo(() => {
    return productos
      .filter(p => {
        const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const coincideCategoria = categoriaSeleccionada ? String(p.categoriaid) === String(categoriaSeleccionada) : true;
        return p.activo !== false && coincideBusqueda && coincideCategoria;
      })
      .map(p => ({
        ...p,
        stockDisponible: Math.max(0, Number(p.cantidadDisponible) - Number(p.cantidadReservada || 0)),
      }));
  }, [productos, busqueda, categoriaSeleccionada]);

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);

  const finalizarVenta = async () => {
    if (carrito.length === 0) return;
    try {
      setProcesando(true);
      const items = carrito.map(item => ({
        productoNombre: item.nombre,
        talla: item.talla,
        cantidad: item.cantidad,
      }));
      await createVentaBatch(items, clienteId || null, descripcion);
      toast.success(`¡Venta completada! ${carrito.reduce((s, i) => s + i.cantidad, 0)} unidades registradas.`);
      navigate("/dashboard/balance");
    } catch (error) {
      toast.error(error?.mensaje || "Ocurrió un problema al registrar la venta.");
    } finally {
      setProcesando(false);
    }
  };

  const cerrarCarrito = useCallback(() => setCarritoAbierto(false), []);

  return (
    <CarritoPantalla
      tono="venta"
      modoTalla="venta"
      titulo="Registrar venta"
      subtitulo="Toca los productos que vendes y cobra desde el carrito."
      icono={ShoppingCart}
      onVolver={() => navigate("/dashboard/balance")}
      tituloCarrito="Carrito de venta"
      textoBoton="Registrar venta"
      etiquetaBarra="Cobrar"
      textoTotal="Total a cobrar"
      mostrarStock
      precioDe={(p) => Number(p.precioVenta)}
      productos={productosFiltrados}
      cargando={cargando}
      busqueda={busqueda}
      onBusqueda={setBusqueda}
      categorias={categorias}
      categoriaSeleccionada={categoriaSeleccionada}
      onCategoria={setCategoriaSeleccionada}
      contactoEtiqueta="Cliente"
      contactoVacio="Consumidor final / general"
      contactos={clientes.map((c) => ({ id: c.clienteid, nombre: c.nombreCliente }))}
      contactoId={clienteId}
      onContacto={setClienteId}
      notas={descripcion}
      onNotas={setDescripcion}
      notasPlaceholder="Descripción o referencia de la venta..."
      carrito={carrito}
      totalCarrito={totalCarrito}
      onAgregar={elegirProducto}
      onCantidad={actualizarCantidad}
      onCantidadDirecta={setCantidadDirecta}
      onEliminar={eliminarDelCarrito}
      procesando={procesando}
      onFinalizar={finalizarVenta}
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

export default RegistrarIngresoForm;
