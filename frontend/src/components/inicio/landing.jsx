import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Bot,
  Package,
  BarChart3,
  DollarSign,
  ArrowUpRight,
  TrendingUp,
  Users,
  ShieldCheck,
  Truck,
  Clock,
  HeartHandshake,
  ArrowRight,
  Send,
  Check,
  Sun,
  Moon
} from "lucide-react";
import "./landing.css";

function Landing() {
  // Theme state: light or dark
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("lumxis-landing-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark"; // Default to dark for high-tech premium feel
  });

  // AI Chatbot simulator state
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "👋 ¡Hola! Soy el **Asistente Inteligente de Lumxis**. Estoy aquí para ayudarte a gestionar tu negocio. Haz clic en cualquiera de las consultas rápidas de abajo para ver cómo puedo ayudarte en tiempo real:"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const predefinedQueries = [
    {
      id: "ventas",
      label: "📈 Ventas de hoy",
      query: "¿Cuáles fueron las ventas de hoy?",
      reply: "Hoy has registrado **5 ventas** por un total de **$1.850.000 COP**.\n\n📊 *Detalle de transacciones:*\n• **Venta #1024**: $420.000 COP (Cliente: Juan Pérez)\n• **Venta #1025**: $150.000 COP (Consumidor Final)\n• **Venta #1026**: $680.000 COP (Cliente: TechRetail)\n• **Venta #1027**: $320.000 COP (Consumidor Final)\n• **Venta #1028**: $280.000 COP (Cliente: María Gómez)\n\nEl método de pago principal fue **Transferencia Bancaria (60%)**."
    },
    {
      id: "stock",
      label: "⚠️ Stock bajo",
      query: "¿Qué productos tienen bajo stock?",
      reply: "⚠️ **Alerta de Stock Bajo**:\nHe encontrado **3 productos** que están por debajo de su umbral mínimo configurado:\n\n1. 📦 **Arroz Diana 500g**\n   • Disponible: 4 unidades | Mínimo: 15 unidades\n2. 📦 **Aceite Girasol 1L**\n   • Disponible: 2 unidades | Mínimo: 10 unidades\n3. 📦 **Leche Alquería Entera 1L**\n   • Disponible: 5 unidades | Mínimo: 20 unidades\n\n¿Deseas que prepare un reporte para realizar un pedido a sus respectivos proveedores?"
    },
    {
      id: "balance",
      label: "📊 Balance mensual",
      query: "¿Cuál es el balance financiero de este mes?",
      reply: "📊 **Balance Financiero (Mayo 2026)**:\n\n• **Ingresos Totales (Ventas):** $12.450.000 COP\n• **Egresos Totales (Compras/Gastos):** $4.820.000 COP\n• 📉 **Margen Neto:** **$7.630.000 COP**\n• 🎯 **Rentabilidad:** **61.28%**\n\n*Nota:* El balance es sumamente positivo. Los egresos principales corresponden al reabastecimiento de mercancía con el proveedor *GrowthMart*."
    }
  ];

  const handleQueryClick = (item) => {
    if (isTyping) return;

    if (chatMessages[chatMessages.length - 1]?.content === item.query) return;

    // Append user message
    setChatMessages((prev) => [...prev, { role: "user", content: item.query }]);
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      setIsTyping(false);
      setChatMessages((prev) => [...prev, { role: "assistant", content: item.reply }]);
    }, 1200);
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const nextTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("lumxis-landing-theme", nextTheme);
      return nextTheme;
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

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
            <span className="logo-text">Lumxis</span>
            <span className="logo-badge">ERP + IA</span>
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
              Registrarse Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content text-left anim-fade-left">
            <div className="promo-badge">
              <Bot className="promo-icon" />
              <span>ERP Inteligente con Asistente de IA</span>
            </div>
            <h1 className="hero-title">
              La gestión de tu negocio, <span className="gradient-text">simplificada e impulsada</span> por IA
            </h1>
            <p className="subtitle text-left">
              Controla tu inventario, procesa ventas en segundos, supervisa turnos de caja y toma decisiones financieras respaldadas por un asistente inteligente en lenguaje natural. **Lumxis** une potencia y sencillez en una sola interfaz diseñada para crecer contigo.
            </p>
            <div className="button-group">
              <Link
                to="/registro"
                className="btn-primary flex items-center no-underline btn-glow btn-lg"
              >
                Comenzar Gratis <ArrowUpRight className="icon" />
              </Link>
              <a href="#demo-asistente" className="btn-outline btn-lg flex items-center gap-2">
                Probar Asistente de IA <ArrowRight className="w-4 h-4 text-primary" />
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
                <span>Monitoreo de Caja 24/7</span>
              </div>
            </div>
          </div>

          {/* Interactive Chatbot Mockup */}
          <div className="hero-visual anim-fade-right" id="demo-asistente">
            <div className="chat-simulator-card glass-panel">
              <div className="chat-header">
                <div className="chat-user-info">
                  <div className="chat-avatar-pulse">
                    <Bot className="chat-avatar-icon" />
                  </div>
                  <div>
                    <h4>Asistente Lumxis IA</h4>
                    <span className="chat-status"><span className="status-dot"></span>En línea (Llama-3.1 8B)</span>
                  </div>
                </div>
                <span className="chat-header-badge">Demo Activa</span>
              </div>

              <div className="chat-body-viewport">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-message-bubble ${msg.role} msg-fade-in`}>
                    {msg.role === "assistant" && (
                      <div className="assistant-avatar">
                        <Sparkles className="avatar-spark" />
                      </div>
                    )}
                    <div className="message-content-wrapper">
                      <p className="message-text">
                        {msg.content.split("\n").map((line, idx) => {
                          let formattedLine = line;
                          const boldRegex = /\*\*(.*?)\*\*/g;
                          const parts = [];
                          let lastIndex = 0;
                          let match;

                          while ((match = boldRegex.exec(line)) !== null) {
                            parts.push(line.substring(lastIndex, match.index));
                            parts.push(<strong key={match.index}>{match[1]}</strong>);
                            lastIndex = boldRegex.lastIndex;
                          }
                          parts.push(line.substring(lastIndex));

                          return (
                            <React.Fragment key={idx}>
                              {parts.length > 1 ? parts : formattedLine}
                              {idx < msg.content.split("\n").length - 1 && <br />}
                            </React.Fragment>
                          );
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="chat-message-bubble assistant msg-fade-in">
                    <div className="assistant-avatar">
                      <Sparkles className="avatar-spark animate-spin-slow" />
                    </div>
                    <div className="message-content-wrapper typing-container">
                      <span className="dot"></span>
                      <span className="dot"></span>
                      <span className="dot"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="chat-input-simulator">
                <div className="chat-options-pills">
                  {predefinedQueries.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleQueryClick(item)}
                      className="option-pill"
                      disabled={isTyping}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="chat-input-box">
                  <span className="input-placeholder">Haz clic en un botón de arriba para preguntar...</span>
                  <div className="send-btn-mock">
                    <Send className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="container">
          <div className="section-header text-center anim-fade-up">
            <span className="section-tag">Funcionalidades del Sistema</span>
            <h2>Todo lo que necesitas para controlar tu negocio</h2>
            <p className="section-subtitle">
              Lumxis está diseñado de punta a punta para cubrir las necesidades operativas de comercios modernos y emprendedores.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper purple-glow">
                <Bot className="feature-icon" />
              </div>
              <h3>Asistente de IA Inteligente</h3>
              <p>
                Realiza consultas directas de tus ventas, egresos y niveles de stock. Pídele al asistente que modifique precios o elimine productos con confirmaciones dinámicas en pantalla.
              </p>
            </div>
            <div className="feature-card glass-panel card-hover-lift anim-fade-up">
              <div className="feature-icon-wrapper cyan-glow">
                <BarChart3 className="feature-icon" />
              </div>
              <h3>Terminal POS y Caja Registradora</h3>
              <p>
                Registra ventas al instante y lleva un control riguroso de turnos de caja. Supervisa la apertura, balance y cierre de cada turno de tus vendedores con registro de descuadres.
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
                Lleva un control financiero de tu caja con el registro de egresos (compras, gastos operativos). Compara ingresos vs egresos para ver tu margen y rentabilidad neta real.
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
            <span className="section-tag">Ventajas Lumxis</span>
            <h2>¿Por qué Lumxis es la elección correcta?</h2>
          </div>
          <div className="benefits-grid">
            <div className="benefit-item glass-panel card-hover-lift anim-fade-up">
              <div className="benefit-badge"><Check className="benefit-check-icon" /></div>
              <h3>Extremadamente Intuitivo</h3>
              <p>
                Cero curvas complejas de aprendizaje. Tus cajeros y vendedores pueden aprender a operar el POS y la caja registradora en menos de 10 minutos.
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
              <div className="stat-label">Asistencia por IA Activa</div>
            </div>
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">10 Min</div>
              <div className="stat-label">Configuración Inicial</div>
            </div>
            <div className="stat-box anim-fade-up">
              <div className="stat-number gradient-text">100%</div>
              <div className="stat-label">Control Financiero de Caja</div>
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
                \"El asistente de IA es una maravilla. Estoy en la calle y puedo preguntarle al asistente en el celular cuál fue el balance de ventas del día o qué productos tienen stock bajo y me responde al instante en segundos.\"
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
                \"Controlar los turnos de caja era un dolor de cabeza diario. Con Lumxis, mis cajeros abren y cierran turnos fácilmente, y puedo ver si hay descuadres de efectivo inmediatamente desde el panel administrador.\"
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
                \"Implementamos Lumxis por el control de inventario, pero nos quedamos por todo lo demás. El balance financiero mensual y el control de accesos de vendedores nos da una tranquilidad inmensa.\"
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
            <p>Empieza gratis con Lumxis, configura tu inventario en minutos y experimenta la gestión impulsada por inteligencia artificial.</p>
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
                <span className="logo-text">Lumxis</span>
              </div>
              <p>
                Revolucionando la gestión comercial con tecnología de vanguardia e inteligencia artificial accesible para todos los comercios.
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
                <li>
                  <a href="#demo-asistente">Demostración IA</a>
                </li>
              </ul>
            </div>
            <div className="footer-links">
              <h3>Funciones</h3>
              <ul>
                <li>
                  <a href="#">Asistente Chatbot</a>
                </li>
                <li>
                  <a href="#">Control de Caja POS</a>
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
            <p>&copy; {new Date().getFullYear()} Lumxis. Todos los derechos reservados.</p>
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
