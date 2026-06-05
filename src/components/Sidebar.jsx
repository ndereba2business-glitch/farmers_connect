import React, { useState } from 'react';
import './Sidebar.css'; // Make sure to link the CSS file

const Sidebar = () => {
  // State to track if the sidebar is open (true) or closed (false)
  const [isOpen, setIsOpen] = useState(false);

  // Function to toggle the state
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* 1. The Hamburger Button (Top Left) */}
      <button className="hamburger-btn" onClick={toggleMenu}>
        ☰
      </button>

      {/* 2. Dark Overlay (Clicking this closes the menu) */}
      {isOpen && <div className="overlay" onClick={toggleMenu}></div>}

      {/* 3. The Sidebar Menu */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <button className="close-btn" onClick={toggleMenu}>
          ✕
        </button>
        
        <nav className="sidebar-links">
          <a href="/" onClick={toggleMenu}>Dashboard</a>
          <a href="/gallery" onClick={toggleMenu}>Farm Gallery</a>
          <a href="/progress" onClick={toggleMenu}>Progress Tracking</a>
          <a href="/settings" onClick={toggleMenu}>Settings</a>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;