import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const closeMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className={scrolled ? 'header scrolled' : 'header'}>
      <div className="logo">
        <Link to="/">Reuben Chatterjee</Link>
      </div>
      <div className="menu-toggle" onClick={toggleMenu}>
        <div className={menuOpen ? 'hamburger open' : 'hamburger'}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
        <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={closeMenu}>Home</Link>
        <Link to="/about" className={location.pathname === '/about' ? 'active' : ''} onClick={closeMenu}>About</Link>
        <Link to="/portfolio" className={location.pathname === '/portfolio' ? 'active' : ''} onClick={closeMenu}>Portfolio</Link>
        <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''} onClick={closeMenu}>Contact</Link>
        <a href="/Resume_Reuben_Chatterjee_DS.pdf" className="resume-link" target="_blank" rel="noopener noreferrer" onClick={closeMenu}>Resume</a>
      </nav>
    </header>
  );
};

export default Header;