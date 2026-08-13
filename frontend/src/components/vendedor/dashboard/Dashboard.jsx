import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar/Sidebar';
import { ChatProvider } from '../../../context/ChatContext';
import ChatWidget from '../../chat/ChatWidget';
import './Dashboard.css';

function Dashboard() {
  return (
    <ChatProvider>
      <div className="dashboard-container">
        <Sidebar />
        <main className="main-content">
          <Outlet />
        </main>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}

export default Dashboard;