import React from 'react';
import { motion } from 'framer-motion';
import { FaGithub, FaLinkedin, FaBehance } from 'react-icons/fa';
import { FiMapPin, FiArrowUpRight, FiMail, FiPhone } from 'react-icons/fi';
import './Contact.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

const SOCIALS = [
  { href: 'https://github.com/ReubenChatterjee', label: 'GitHub', Icon: FaGithub },
  { href: 'https://www.linkedin.com/in/reuben-chatterjee/', label: 'LinkedIn', Icon: FaLinkedin },
  { href: 'https://www.behance.net/reubenchatterjee', label: 'Behance', Icon: FaBehance },
];

const Contact = () => {
  return (
    <div className="apple-contact-page">
      <div className="apple-contact-page-glow" aria-hidden="true" />

      <div className="apple-contact-page-inner">
        <motion.span
          className="apple-eyebrow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: APPLE_EASE }}
        >
          Contact
        </motion.span>

        <motion.h1
          className="apple-contact-page-title"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1, ease: APPLE_EASE }}
        >
          Let's work{' '}
          <span className="apple-title-muted">together.</span>
        </motion.h1>

        <motion.p
          className="apple-contact-page-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: APPLE_EASE }}
        >
          Open to roles, collaborations, or just a good conversation about data,
          ML, and what's next. The fastest path is email.
        </motion.p>

        <motion.a
          href="mailto:reuben.a.chatterjee@gmail.com"
          className="apple-contact-page-email-cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: APPLE_EASE }}
        >
          <span>reuben.a.chatterjee@gmail.com</span>
          <FiArrowUpRight size={18} />
        </motion.a>

        {/* Detail cards row */}
        <motion.div
          className="apple-contact-page-details"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: APPLE_EASE }}
        >
          <a
            href="mailto:reuben.a.chatterjee@gmail.com"
            className="apple-contact-page-detail"
            data-tint="blue"
          >
            <div className="apple-contact-page-detail-icon" aria-hidden="true">
              <FiMail size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="apple-contact-page-detail-label">Email</div>
              <div className="apple-contact-page-detail-value">
                reuben.a.chatterjee@gmail.com
              </div>
            </div>
          </a>

          <a href="tel:+18582202422" className="apple-contact-page-detail" data-tint="green">
            <div className="apple-contact-page-detail-icon" aria-hidden="true">
              <FiPhone size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="apple-contact-page-detail-label">Phone</div>
              <div className="apple-contact-page-detail-value">+1 (858) 220-2422</div>
            </div>
          </a>

          <div className="apple-contact-page-detail" data-tint="purple">
            <div className="apple-contact-page-detail-icon" aria-hidden="true">
              <FiMapPin size={18} strokeWidth={1.8} />
            </div>
            <div>
              <div className="apple-contact-page-detail-label">Location</div>
              <div className="apple-contact-page-detail-value">
                Mountain View, California
              </div>
            </div>
          </div>
        </motion.div>

        {/* Socials */}
        <motion.div
          className="apple-contact-page-socials"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.7, ease: APPLE_EASE }}
        >
          <div className="apple-contact-page-socials-label">Find me elsewhere</div>
          <div className="apple-contact-page-socials-row">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="apple-social-btn"
                aria-label={label}
              >
                <Icon size={20} />
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Contact;
