import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ClipboardList,
  Package,
  DollarSign,
  ArrowUpRight,
  Users,
  ShieldCheck,
  Clock,
  HeartHandshake,
  ArrowRight,
  Check,
  Sun,
  Moon
} from "lucide-react";
import "./landing.css";

function Landing() {
  // Theme state: light or dark
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("ordereasy-landing-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark"; // Default to dark for high-tech premium feel
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ordereasy-landing-theme", nextTheme);
      return nextTheme;
    });
  };

  return (
    <div className={`app theme-${theme}`}>
      {/* Background Decorative Blobs */}
      <div className="bg-blob blob-purple"></div>
      <div className="bg-blob blob-cyan"></div>
      <div className="bg-blob blob-blue"></div>

      {/* Navigation */}
      <nav className="navbar anim-fade-down">
        <div className="nav-container">
          <div className="logo">
            <Sparkles className="logo-icon animate-pulse-slow" />
            <span className="logo-text">OrderEasy</span>
            <span className="logo-badge">Inventario + Pedidos</span>
          </div>

          <div className="nav-buttons">
            <button 
              onClick={toggleTheme} 
              className="theme-toggle-btn" 
              aria-label="Cambiar tema"
              title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              {theme === "dark" ? <Sun className="toggle-icon sun" /> : <Moon className="toggle-icon moon" />}
            </button>

            <Link className="btn-secondary no-underline" to="/login">
              Iniciar Sesión
            </Link>
            <Link className="btn-primary no-underline btn-glow" to="/registro">
              Registrarse<span className="solo-escritorio"> Gratis</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content text-left anim-fade-left">
            <div className="promo-badge">
              <ClipboardList className="promo-icon" />
              <span>Inventario, ventas y pedidos en un solo lugar</span>
            </div>
            <h1 className="hero-title">
              La gestión de tu negocio, <span className="gradient-text">simple y siempre bajo control</span>
            </h1>
            <p className="subtitle text-left">
              Controla tu inventario, registra ventas y egresos, y lleva tus pedidos al proveedor con las compras, abonos y entregas de cada cliente. <strong>OrderEasy</strong> une potencia y sencillez en una sola interfaz diseñada para crecer contigo.
            </p>
            <div className="button-group">
              <Link
                to="/registro"
                className="btn-primary flex items-center no-underline btn-glow btn-lg"
              >
                Comenzar Gratis <ArrowUpRight className="icon" />
              </Link>
              <a href="#funciones" className="btn-outline btn-lg flex items-center gap-2">
                Ver funcionalidades <ArrowRight className="w-4 h-4 text-primary" />
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <ShieldCheck className="stat-icon" />
                <span>Seguro y Confiable</span>
              </div>
              <div className="stat-item">
                <Users className="stat-icon" />
                <span>Control Multiusuario</span>
              </div>
              <div className="stat-item">
                <Clock className="stat-icon" />
                <span>Control Financiero 24/7</span>
              </div>
            </div>
          </div>

          {/* Vista previa de un pedido */}
          <div className="hero-visual anim-fade-right">
            <div className="mock-pedido glass-panel">
              <div className="mock-pedido-header">
                <div>
                  <h4>Pedido de octubre</h4>
                  <span>3 compras de clientes</span>
                </div>
                <span className="mock-pedido-estado">Abierto</span>
              </div>
              <div className="mock-pedido-lista">
                <div className="mock-pedido-fila">
                  <div><strong>Ana Gómez</strong><small>2× Sandalia Camille · 38</small></div>
                  <div className="mock-pedido-montos"><span>Abonó $40.000</span><strong>Saldo $70.000</strong></div>
                </div>
                <div className="mock-pedido-fila">
                  <div><strong>Luis Pérez</strong><small>1× Sandalia Serena · 39</small></div>
                  <div className="mock-pedido-montos"><span>Abonó $0</span><strong>Saldo $45.000</strong></div>
                </div>
                <div className="mock-pedido-fila">
                  <div><strong>María Díaz</strong><small>3× Sandalia Alma · 37</small></div>
                  <div className="mock-pedido-montos"><span className="mock-pagado">Pagado</span><strong>Saldo $0</strong></div>
                </div>
              </div>
              <div className="mock-pedido-pie">
                <span>Por cobrar a clientes</span>
                <strong>$115.000</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="funciones">
        <div className="container">
          <div className="section-header text-center anim-fade-up">
            <span className="section-tag">Funcionalidades del Sistema</span>
            <h2>Todo lo que necesitas para controlar tu negocio</h2>
            <p className="section-subtitle">
              OrderEasy está diseñado de punta a punta para cubrir las necesidades operativas de comercios modernos y emprendedores.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper purple-glow">
                <ClipboardList className="feature-icon" />
              </div>
              <h3>Pedidos al Proveedor</h3>
              <p>
                Arma cada pedido con las compras de tus clientes, registra abonos y pagos, y al llegar la mercancía reparte cada par a quien corresponde. Lleva siempre claro cuánto te debe cada cliente.
              </p>
            </div>
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper blue-glow">
                <Package className="feature-icon" />
              </div>
              <h3>Control de Inventario Avanzado</h3>
              <p>
                Monitorea stock en tiempo real, clasifica por categorías personalizadas y recibe alertas visuales inmediatas cuando un producto esté por debajo de su umbral mínimo.
              </p>
            </div>
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper indigo-glow">
                <DollarSign className="feature-icon" />
              </div>
              <h3>Balance, Ingresos y Egresos</h3>
              <p>
                Lleva un control financiero de tu negocio con el registro de egresos (compras, gastos operativos). Compara ingresos vs egresos para ver tu margen y rentabilidad neta real.
              </p>
            </div>
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper teal-glow">
                <Users className="feature-icon" />
              </div>
              <h3>Control de Roles y Permisos</h3>
              <p>
                Define qué módulos puede ver tu personal. El sistema restringe accesos según el rol (Administrador vs Vendedor), protegiendo la información sensible de tu balance y configuración.
              </p>
            </div>
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper rose-glow">
                <HeartHandshake className="feature-icon" />
              </div>
              <h3>Gestión de Clientes y Proveedores</h3>
              <p>
                Integra un directorio completo de clientes (CRM) y proveedores. Asocia ventas a tus clientes recurrentes y registra tus compras o egresos a tus proveedores oficiales de stock.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="benefits">
        <div className="container">
          <div className="section-header text-center anim-fade-up">
            <span className="section-tag">Ventajas OrderEasy</span>
            <h2>¿Por qué OrderEasy es la elección correcta?</h2>
          </div>
          <div className="benefits-grid">
            <div className="benefit-item glass-panel card-hover-lift anim-fade-up">
              <div className="benefit-badge"><Check className="benefit-check-icon" /></div>
              <h3>Extremadamente Intuitivo</h3>
              <p>
                Cero curvas complejas de aprendizaje. Tus vendedores pueden aprender a operar el sistema en menos de 10 minutos.
              </p>
            </div>
            <div className="benefit-item glass-panel card-hover-lift anim-fade-up">
              <div className="benefit-badge"><Check className="benefit-check-icon" /></div>
              <h3>Seguridad a Nivel de Datos</h3>
              <p>
                Control estricto de roles. Toda acción crítica (como eliminar ventas o productos) cuenta con confirmaciones en tiempo real y registro de auditoría.
              </p>
            </div>
            <div className="benefit-item glass-panel card-hover-lift anim-fade-up">
              <div className="benefit-badge"><Check className="benefit-check-icon" /></div>
              <h3>100% Personalizable</h3>
              <p>
                Ajusta las categorías, configura alertas de stock por producto y personaliza los métodos de pago según las necesidades de tu comercio.
              </p>
            </div>
            <div className="benefit-item glass-panel card-hover-lift anim-fade-up">
              <div className="benefit-badge"><Check className="benefit-check-icon" /></div>
              <h3>Decisiones Basadas en Datos</h3>
              <p>
                Deja de adivinar tus ganancias. Visualiza estadísticas de ventas y compras anuales y mensuales de forma gráfica y consolidada al instante.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="stats">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">24/7</div>
              <div className="stat-label">Acceso desde Cualquier Dispositivo</div>
            </div>
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">10 Min</div>
              <div className="stat-label">Configuración Inicial</div>
            </div>
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">100%</div>
              <div className="stat-label">Control Financiero del Negocio</div>
            </div>
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">0%</div>
              <div className="stat-label">Comisión por Ventas Realizadas</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="container">
          <div className="section-header text-center anim-fade-up">
            <span className="section-tag">Testimonios</span>
            <h2>La opinión de comercios reales</h2>
          </div>
          <div className="testimonials-grid">
            <div className="testimonial-card glass-panel card-hover-lift anim-fade-up">
              <p>
                “Con los pedidos al proveedor sé qué le debo a cada cliente, cuánto ha abonado y cuándo llega cada par. Ya no se me pierde ninguna cuenta y todo lo reviso desde el celular.”
              </p>
              <div className="testimonial-author">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=80&h=80&q=80"
                  alt="Diana Valencia"
                />
                <div>
                  <div className="author-name">Diana Valencia</div>
                  <div className="author-title">Propietaria, MiniMarket La 70</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card glass-panel card-hover-lift anim-fade-up">
              <p>
                “Antes llevaba el control de ventas y egresos en hojas de cálculo. Con OrderEasy tengo el balance del día al instante y sé exactamente cuánto gané.”
              </p>
              <div className="testimonial-author">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=80&h=80&q=80"
                  alt="Andrés Restrepo"
                />
                <div>
                  <div className="author-name">Andrés Restrepo</div>
                  <div className="author-title">Gerente General, Distribuidora Oriente</div>
                </div>
              </div>
            </div>
            <div className="testimonial-card glass-panel card-hover-lift anim-fade-up">
              <p>
                “Implementamos OrderEasy por el control de inventario, pero nos quedamos por todo lo demás. El balance financiero mensual y el control de accesos de vendedores nos da una tranquilidad inmensa.”
              </p>
              <div className="testimonial-author">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=80&h=80&q=80"
                  alt="Valeria Ospina"
                />
                <div>
                  <div className="author-name">Valeria Ospina</div>
                  <div className="author-title">Fundadora, Tendencias Tienda de Ropa</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta anim-fade-up">
        <div className="container relative">
          <div className="cta-content glass-panel">
            <h2>Toma el control absoluto de tu negocio hoy mismo</h2>
            <p>Empieza gratis con OrderEasy, configura tu inventario en minutos y lleva tus pedidos, abonos y entregas en un solo lugar.</p>
            <div className="cta-buttons">
              <Link to="/registro" className="btn-primary no-underline btn-lg btn-glow">
                Crear Mi Cuenta Gratis
              </Link>
              <Link to="/login" className="btn-outline btn-lg">
                Acceder al Sistema
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer anim-fade-up">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="logo">
                <Sparkles className="logo-icon" />
                <span className="logo-text">OrderEasy</span>
              </div>
              <p>
                Gestión comercial sencilla y accesible para todos los comercios: inventario, ventas, pedidos y balance en un solo lugar.
              </p>
            </div>
            <div className="footer-links">
              <h3>Sistema</h3>
              <ul>
                <li>
                  <Link to="/login">Iniciar Sesión</Link>
                </li>
                <li>
                  <Link to="/registro">Registro Gratuito</Link>
                </li>
              </ul>
            </div>
            <div className="footer-links">
              <h3>Funciones</h3>
              <ul>
                <li>
                  <a href="#">Pedidos y Abonos</a>
                </li>
                <li>
                  <a href="#">Gestión de Clientes</a>
                </li>
                <li>
                  <a href="#">Gestión de Stock</a>
                </li>
                <li>
                  <a href="#">Balance e Informes</a>
                </li>
              </ul>
            </div>
            <div className="footer-links">
              <h3>Soporte</h3>
              <ul>
                <li>
                  <a href="#">Centro de Ayuda</a>
                </li>
                <li>
                  <a href="#">Guías de Configuración</a>
                </li>
                <li>
                  <a href="#">Contacto Técnico</a>
                </li>
              </ul>
            </div>
            <div className="footer-links">
              <h3>Seguridad</h3>
              <ul>
                <li>
                  <a href="#">Políticas de Privacidad</a>
                </li>
                <li>
                  <a href="#">Términos del Servicio</a>
                </li>
                <li>
                  <a href="#">Respaldo de Datos</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} OrderEasy. Todos los derechos reservados.</p>
            <div className="footer-bottom-links">
              <a href="#">Seguridad del Servidor</a>
              <a href="#">Términos y Condiciones</a>
              <a href="#">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
