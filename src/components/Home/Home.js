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

const Particles = () => {
  const particleCount = 100;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    // Create a more evenly distributed grid-like starting position
    const gridSize = Math.ceil(Math.sqrt(particleCount));
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;

    const baseX = (col / gridSize) * 100 + Math.random() * (100 / gridSize);
    const baseY = (row / gridSize) * 100 + Math.random() * (100 / gridSize);

    return {
      id: i,
      x: baseX,
      y: baseY,
      scale: Math.random() * 0.5 + 0.5,
      duration: Math.random() * 15 + 15,
      offsetX: (Math.random() - 0.5) * 20,
      offsetY: (Math.random() - 0.5) * 20,
    };
  });

  return (
    <div className="particles-container" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }}>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="particle"
          animate={{
            x: [`${particle.x}vw`, `${particle.x + particle.offsetX}vw`, `${particle.x}vw`],
            y: [`${particle.y}vh`, `${particle.y + particle.offsetY}vh`, `${particle.y}vh`],
            scale: [particle.scale, particle.scale * 1.3, particle.scale],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        />
      ))}
    </div>
  );
};

const Home = () => {
  return (
    <div className="home-container">
      <Particles />
      <motion.div
        className="hero-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Hi, I'm <span className="highlight">Reuben</span>
        </motion.h1>
        
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Data Scientist | Machine Learning & Analytics Specialist
        </motion.h2>
        
        <motion.div
          className="hero-description"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <div className="hero-tagline">
            <p className="tagline-main">Building <strong>END-TO-END DATA SYSTEMS</strong></p>
            <p className="tagline-detail">From automated data pulls</p>
            <p className="tagline-detail">to fine-tuned ML models</p>
            <p className="tagline-detail">to executive-ready dashboards.</p>
          </div>
          <p className="hero-credentials">
            Master's in Data Science, UC San Diego (3.82 GPA)
          </p>
        </motion.div>
        
        <motion.div 
          className="cta-buttons"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Link to="/portfolio" className="primary-btn">View My Work</Link>
          <Link to="/contact" className="secondary-btn">Get In Touch</Link>
        </motion.div>
      </motion.div>

      {/* Impact by Numbers Section */}
      <motion.div
        className="impact-section"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8 }}
      >
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6 }}
        >
          Impact by Numbers
        </motion.h3>

        <motion.div
          className="impact-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, delay: 0.2 }}
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
      </motion.div>

      <motion.div
        className="skills-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
      >
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          My Skills
        </motion.h3>
        
        <motion.div 
          className="skills-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <div className="skill-card">Python</div>
          <div className="skill-card">SQL</div>
          <div className="skill-card">Snowflake</div>
          <div className="skill-card">Looker</div>
          <div className="skill-card">R Programming</div>
          <div className="skill-card">AWS</div>
        </motion.div>
        
        <motion.div
          className="view-all-skills"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
        >
          <Link to="/portfolio#skills" className="view-all-link">View all skills...</Link>
        </motion.div>
      </motion.div>
      
      <motion.div 
        className="featured-section"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.6 }}
      >
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.8 }}
        >
          Featured Projects
        </motion.h3>
        <motion.div 
          className="featured-projects"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2 }}
        >
  <div className="project-card">
    <div
      className="project-image"
      style={{ backgroundImage: "url(/images/afterpay-churn.jpg)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Afterpay Customer Churn Prediction</h4>
    <p>Developed a production-ready churn prediction model that identified $2.1M+ in at-risk revenue for Afterpay. Built comprehensive customer segmentation pipeline with feature engineering on transaction patterns, achieving high precision with XGBoost classifier.</p>
    <span className="project-link" style={{ cursor: 'default', opacity: 0.7 }}>Proprietary Work</span>
  </div>

  <div className="project-card">
    <div
      className="project-image"
      style={{ backgroundImage: "url(/images/gender-study.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Gender & Group Dynamics Research Study</h4>
    <p>Analyzed demographic data from 500+ students to investigate gender composition effects on team dynamics in COGS108. Found statistically significant gender-based differences in programming comfort using ANOVA and created visualizations to support findings.</p>
    <a href="https://github.com/ReubenChatterjee/gender_groupwork" target="_blank" rel="noopener noreferrer" className="project-link">View Project</a>
  </div>

  <div className="project-card">
    <div
      className="project-image"
      style={{ backgroundImage: "url(/images/fraud-detection.jpg)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Fraud Detection for Credit Card Transactions</h4>
    <p>Built a fraud detection model on 97K+ credit card transactions using LightGBM, CNN, XGBoost, and more.</p>
    <a href="https://github.com/ReubenChatterjee/credit-card-fraud-detection" target="_blank" rel="noopener noreferrer" className="project-link">View on GitHub</a>
  </div>

  <div className="project-card">
    <div
      className="project-image"
      style={{ backgroundImage: "url(/images/sas.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Student Accommodation Service</h4>
    <p>Designed a mobile application that matches students with compatible roommates using the K-Means clustering algorithm and OCEAN personality model.</p>
    <a href="https://github.com/ReubenChatterjee/student-accommodation-app" target="_blank" rel="noopener noreferrer" className="project-link">View Project</a>
  </div>
  
        </motion.div>
        <motion.div 
          className="view-all"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2.2 }}
        >
          <Link to="/portfolio">View All Projects</Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Home;