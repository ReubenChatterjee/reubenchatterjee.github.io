import React from 'react';
import { FaGithub, FaLinkedin, FaBehance } from 'react-icons/fa';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="apple-footer">
      <div className="apple-footer-inner">
        <div className="apple-footer-row">
          <div className="apple-footer-copy">
            &copy; {new Date().getFullYear()} Reuben Chatterjee. All rights reserved.
          </div>
          <div className="apple-footer-socials">
            <a
              href="https://github.com/ReubenChatterjee"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <FaGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/reuben-chatterjee/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <FaLinkedin />
            </a>
            <a
              href="https://www.behance.net/reubenchatterjee"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Behance"
            >
              <FaBehance />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
