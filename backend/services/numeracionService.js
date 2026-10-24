// Numeración visible de pedidos al proveedor y compras de clientes: consecutiva por negocio y sin reutilizar números.
// El contador vive en `negocios`; el UPDATE ... RETURNING es atómico, así que dos creaciones simultáneas nunca repiten número.

const sequelize = require('../config/database');

const COLUMNAS = { pedido: 'ultimo_numero_pedido', compra: 'ultimo_numero_compra' };

// tipo: 'pedido' (pedido al proveedor) o 'compra' (compra de un cliente)
const siguienteNumero = async (negocioid, tipo, transaction) => {
  const columna = COLUMNAS[tipo];
  if (!columna) throw new Error(`Tipo de numeración desconocido: ${tipo}`);
  const [filas] = await sequelize.query(
    `UPDATE negocios SET ${columna} = ${columna} + 1 WHERE negocioid = :negocioid RETURNING ${columna} AS numero`,
    { replacements: { negocioid }, transaction },
  );
  return filas[0].numero;
};

module.exports = { siguienteNumero };
