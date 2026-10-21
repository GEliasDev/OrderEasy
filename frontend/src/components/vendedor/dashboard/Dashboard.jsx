import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar/Sidebar';
import Navbar from './navbar/Navbar';
import { ChatProvider } from '../../../context/ChatContext';
import ChatWidget from '../../chat/ChatWidget';
import { vigilarTablas } from '../../../utils/tablaTarjetas';
import './Dashboard.css';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Las tablas con la clase `tabla-tarjetas` se etiquetan solas para mostrarse como tarjetas en el celular
  useEffect(() => vigilarTablas(), []);

  return (
    <ChatProvider>
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
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}

export default Dashboard;
