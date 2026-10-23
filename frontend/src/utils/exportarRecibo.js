import { saveAs } from 'file-saver';

// Descarga la hoja de un recibo como PDF o como imagen PNG. La librería se carga solo al exportar.
export const exportarRecibo = async (elemento, nombreArchivo, formato) => {
  const { default: html2pdf } = await import('html2pdf.js');
  const opciones = {
    margin: 8,
    filename: `${nombreArchivo}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
    jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' },
  };

  if (formato === 'pdf') {
    await html2pdf().set(opciones).from(elemento).save();
    return;
  }

  const canvas = await html2pdf().set(opciones).from(elemento).toCanvas().get('canvas');
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen');
  saveAs(blob, `${nombreArchivo}.png`);
};
