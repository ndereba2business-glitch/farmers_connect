import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function AppShell({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile Top Navigation Header */}
      <Navbar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

      {/* Persistent Desktop / Drawer Mobile Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area Container */}
      <main className="flex-1 w-full max-w-full px-4 py-6 md:px-8 md:py-8 transition-all duration-300 ease-in-out">
        <div className="mx-auto max-w-7xl w-full">
          {children}
        </div>
      </main>
    </div>
  );
}