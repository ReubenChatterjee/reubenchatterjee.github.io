import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import './Home.css';

const AnimatedCounter = ({ end, duration = 2, suffix = '', decimals = 0 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    if (!isInView) return;

    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) / (duration * 1000);

      if (progress < 1) {
        const currentValue = end * progress;
        setCount(decimals > 0 ? currentValue.toFixed(decimals) : Math.floor(currentValue));
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(decimals > 0 ? end.toFixed(decimals) : end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, end, duration, decimals]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const Home = () => {
  return (
    <div className="home-container">
      {/* Gradient mesh background */}
      <div className="gradient-mesh" aria-hidden="true" />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-columns">
          {/* Left: Name */}
          <motion.div
            className="hero-left"
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <motion.span
              className="hero-eyebrow"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              Data Scientist · ML/AI &amp; Production Systems
            </motion.span>
            <motion.div
              className="hero-name"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="hero-name-line">REUBEN</span>
              <span className="hero-name-line">CHATTERJEE</span>
            </motion.div>
          </motion.div>

          {/* Right: Tagline + sub */}
          <motion.div
            className="hero-right"
            whileHover={{ scale: 1.04 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <motion.h1
              className="hero-display"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Building<br />
              <span className="hero-display-accent">End-to-End</span><br />
              Data Systems
            </motion.h1>
            <motion.p
              className="hero-sub"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              From automated data pipelines to fine-tuned ML models to
              executive-ready dashboards. M.S. Data Science, UC San Diego (3.82 GPA).
            </motion.p>
          </motion.div>
        </div>

        {/* CTAs centered below both columns */}
        <motion.div
          className="cta-buttons"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          <Link to="/portfolio" className="primary-btn">View My Work</Link>
          <Link to="/contact" className="secondary-btn">Get In Touch</Link>
        </motion.div>
      </section>

      {/* Impact by Numbers Section */}
      <motion.section
        className="impact-section"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7 }}
      >
        <div className="section-header-split">
          <div>
            <span className="section-tag">IMPACT</span>
            <h3 className="section-heading-main">By the Numbers</h3>
          </div>
        </div>

        <motion.div
          className="impact-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="impact-card">
            <div className="impact-number">
              <AnimatedCounter end={60} suffix="%" />
            </div>
            <div className="impact-label">Cost Reduction</div>
            <div className="impact-description">Infrastructure migration savings</div>
          </div>

          <div className="impact-card">
            <div className="impact-number">
              $<AnimatedCounter end={2.1} suffix="M+" duration={2.5} decimals={1} />
            </div>
            <div className="impact-label">Revenue Protected</div>
            <div className="impact-description">At-risk revenue identified</div>
          </div>

          <div className="impact-card">
            <div className="impact-number">
              <AnimatedCounter end={15} suffix="+" />
            </div>
            <div className="impact-label">Production Pipelines</div>
            <div className="impact-description">Processing 50GB+ daily data</div>
          </div>

          <div className="impact-card">
            <div className="impact-number">
              <AnimatedCounter end={800} suffix="+" />
            </div>
            <div className="impact-label">Students Mentored</div>
            <div className="impact-description">As Lead TA at UCSD</div>
          </div>
        </motion.div>
      </motion.section>

      {/* Featured Projects Section */}
      <motion.section
        className="featured-section"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.7 }}
      >
        <div className="section-header-split">
          <div>
            <span className="section-tag">WORK</span>
            <h3 className="section-heading-main">Featured Projects</h3>
          </div>
          <Link to="/portfolio" className="view-all-link">View all →</Link>
        </div>

        <div className="featured-projects-wrapper">
          <div className="featured-projects">
            <div className="project-card">
              <div
                className="project-image"
                style={{ backgroundImage: "url(/images/part-serialization.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
              ></div>
              <div className="project-card-body">
                <h4>Multi-Model OCR Pipeline for Industrial Labels</h4>
                <p>Architected production-grade OCR pipeline using vision-language models (Claude Sonnet 4.5, Qwen VL, PaddleOCR), achieving 85.7% precision on 500+ industrial labels. Trained RT-DETR object detection achieving 97.8% precision and improved inference efficiency by 3–5x through GPU optimization.</p>
                <span className="project-link proprietary">Proprietary Work</span>
              </div>
            </div>

            <div className="project-card">
              <div
                className="project-image"
                style={{ backgroundImage: "url(/images/afterpay-churn.jpg)", backgroundSize: 'cover', backgroundPosition: 'center' }}
              ></div>
              <div className="project-card-body">
                <h4>Afterpay Customer Retention Prediction</h4>
                <p>Built gradient boosting churn prediction model achieving 89% accuracy and 0.92 ROC-AUC. Identified $2.1M in at-risk revenue through 4-tier risk segmentation, enabling targeted retention campaigns that improved customer lifetime value by 18%.</p>
                <span className="project-link proprietary">Proprietary Work</span>
              </div>
            </div>

            <div className="project-card">
              <div
                className="project-image"
                style={{ backgroundImage: "url(/images/gender-study.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
              ></div>
              <div className="project-card-body">
                <h4>Gender &amp; Group Dynamics Research Study</h4>
                <p>Analyzed demographic data from 500+ students to investigate gender composition effects on team dynamics in COGS108. Found statistically significant gender-based differences in programming comfort using ANOVA and created visualizations to support findings.</p>
                <a href="https://github.com/ReubenChatterjee/gender_groupwork" target="_blank" rel="noopener noreferrer" className="project-link">View Project →</a>
              </div>
            </div>

            <div className="project-card">
              <div
                className="project-image"
                style={{ backgroundImage: "url(/images/fraud-detection.jpg)", backgroundSize: 'cover', backgroundPosition: 'center' }}
              ></div>
              <div className="project-card-body">
                <h4>Fraud Detection for Credit Card Transactions</h4>
                <p>Built a fraud detection model on 97K+ credit card transactions using LightGBM, CNN, XGBoost, and more.</p>
                <a href="https://github.com/ReubenChatterjee/credit-card-fraud-detection" target="_blank" rel="noopener noreferrer" className="project-link">View on GitHub →</a>
              </div>
            </div>

            <div className="project-card">
              <div
                className="project-image"
                style={{ backgroundImage: "url(/images/sas.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
              ></div>
              <div className="project-card-body">
                <h4>Student Accommodation Service</h4>
                <p>Designed a mobile application that matches students with compatible roommates using the K-Means clustering algorithm and OCEAN personality model.</p>
                <a href="https://github.com/ReubenChatterjee/student-accommodation-app" target="_blank" rel="noopener noreferrer" className="project-link">View Project →</a>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default Home;
