import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const exportarProductosPorPaginas = (productos) => {
  const datos = productos.map((producto) => ({
    Fecha: formatFecha(producto.createdat),
    Nombre: producto.nombre,
    Descripción: producto.descripcion,
    Categoría: producto.categoriaNombre,
    Stock: producto.cantidadDisponible,
    'Precio Compra': producto.precioCompra,
    'Precio Venta': producto.precioVenta,
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(data, 'Productos_Exportados.xlsx');
};

const formatFecha = (fecha) => {
  const f = new Date(fecha);
  const dia = String(f.getDate()).padStart(2, '0');
  const mes = String(f.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${f.getFullYear()}`;
};
