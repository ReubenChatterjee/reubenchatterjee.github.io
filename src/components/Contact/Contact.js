import React from 'react';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedin, FaEnvelope, FaMapMarkerAlt, FaPhone } from 'react-icons/fa';
import './Contact.css';

const Contact = () => {
  return (
    <motion.div 
      className="contact-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <span className="section-tag">CONTACT</span>
        <h2 className="page-heading">Get In Touch</h2>
      </motion.div>
      
      <motion.div 
        className="contact-content-centered"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="contact-info">
          <h3>Let's Talk</h3>
          <p>Feel free to reach out if you're looking for a Data Science enthusiast, have a question, or just want to connect.</p>
          
          <div className="contact-details">
            <div className="contact-item">
              <FaEnvelope className="contact-icon" />
              <span>reuben.a.chatterjee@gmail.com</span>
            </div>
            <div className="contact-item">
              <FaPhone className="contact-icon" />
              <span>+1 (858) 220-2422</span>
            </div>
            <div className="contact-item">
              <FaMapMarkerAlt className="contact-icon" />
              <span>Mountain View, California</span>
            </div>
          </div>
          
          <div className="social-links">
            <a href="https://github.com/ReubenChatterjee" className="social-link">
              <FaGithub />
            </a>
            <a href="https://www.linkedin.com/in/reuben-chatterjee/" className="social-link">
              <FaLinkedin />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Contact;