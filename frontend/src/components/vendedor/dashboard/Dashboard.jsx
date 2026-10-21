import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar/Sidebar';
import Navbar from './navbar/Navbar';
import { vigilarTablas } from '../../../utils/tablaTarjetas';
import './Dashboard.css';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Las tablas con la clase `tabla-tarjetas` se etiquetan solas para mostrarse como tarjetas en el celular
  useEffect(() => vigilarTablas(), []);

  return (
    <>
      <div className="dashboard-container">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <div className="dashboard-main">
          <Navbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}

export default Dashboard;
