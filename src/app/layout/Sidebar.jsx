import React from 'react';

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Background Overlay Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sidebar Panel Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-emerald-900 text-white p-5 transform transition-transform duration-300 ease-in-out
        md:relative md:transform-none md:z-0 flex flex-col justify-between
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight">Farmers Connect</h2>
            <button onClick={onClose} className="p-2 -mr-2 rounded-lg md:hidden hover:bg-emerald-800" aria-label="Close menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          
          {/* Navigation Items (Target sizes optimized for touch interactivity) */}
          <nav className="space-y-1">
            <a href="#dashboard" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-emerald-800 text-white min-h-[48px]">
              <span>Dashboard</span>
            </a>
            {/* Additional links */}
          </nav>
        </div>
      </aside>
    </>
  );
}