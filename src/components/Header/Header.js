import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import './Header.css';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const { scrollY } = useScroll();
  const headerBg = useTransform(scrollY, [0, 80], ['rgba(14,14,14,0)', 'rgba(14,14,14,0.92)']);
  const headerBorder = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)']);
  const headerBlur = useTransform(scrollY, [0, 80], [0, 1]);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  return (
    <motion.header
      className="header"
      style={{
        backgroundColor: headerBg,
        borderBottomColor: headerBorder,
      }}
    >
      <div className="logo">
        <Link to="/">RC</Link>
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
    </motion.header>
  );
};

export default Header;
