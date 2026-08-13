import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const formatFecha = (fecha) => {
  const f = new Date(fecha);
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
};

const exportar = (datos, hoja) => {
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    `${hoja}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

export const exportarVentas = (ventas) => {
  const datos = ventas.map((v) => ({
    Fecha: formatFecha(v.createdAt),
    Productos: v.detalles?.map((d) => d.productoNombre).join(', ') || '-',
    Cliente: v.cliente?.nombreCliente || 'General',
    Items: v.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0,
    Total: Number(v.total),
  }));
  exportar(datos, 'Ventas');
};

export const exportarEgresos = (egresos) => {
  const datos = egresos.map((e) => ({
    Fecha: formatFecha(e.createdAt),
    Productos: e.detalles?.map((d) => d.productoNombre).join(', ') || '-',
    Proveedor: e.proveedor?.nombreProveedor || 'General',
    Items: e.detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0,
    Total: Number(e.total),
  }));
  exportar(datos, 'Egresos');
};
