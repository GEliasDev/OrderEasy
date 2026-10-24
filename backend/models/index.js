// Registra todos los modelos de Sequelize (y sus asociaciones) para que sequelize.sync() cree todas las tablas.
// El orden importa: los modelos referenciados se cargan antes que los que los referencian.

require('./negocioModel');
require('./roleSeccionModel');
require('./rolModel');
require('./userModel');
require('./categoryModel');
require('./productModel');
require('./varianteModel');
require('./ventaModel');
require('./ventaDetalleModel');
require('./egresoModel');
require('./egresoDetalleModel');
require('./clientModel');
require('./ventaPagoModel');
require('./proveedorModel');
require('./proveedorPrecioEscalonadoModel');
require('./pedidoModel');
require('./pedidoPagoModel');
require('./pedidoDevolucionModel');
require('./ordenCompraModel');
require('./ordenCompraAsignacionModel');
