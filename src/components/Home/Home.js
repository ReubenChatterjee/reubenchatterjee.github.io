import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
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
          Hello, I'm <span className="highlight">Reuben</span>
        </motion.h1>
        
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Data Scientist | Machine Learning & Analytics Specialist
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          I specialize in building intelligent, scalable data solutions and telling compelling stories through data. Currently completing my Master’s in Data Science at UC San Diego.

        </motion.p>
        
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
      style={{ backgroundImage: "url(/images/gender-study.png)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Gender & Group Dynamics Research Study</h4>
    <p>Ongoing research where I am analyzing demographic data from 500+ students to investigate the effects of gender composition on team dynamics in COGS108. I am currently conducting ANOVA tests for balanced experimental groupings across various demographics. Findings include significant gender-based differences in programming comfort.</p>
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
  <div className="project-card">
    <div 
      className="project-image"
      style={{ backgroundImage: "url(/images/climate-change.jpg)", backgroundSize: 'cover', backgroundPosition: 'center' }}
    ></div>
    <h4>Climate Change Analysis</h4>
    <p>Built and evaluated a NorESM2 linear regression model to predict global warming based on CO2 emissions from the ClimateBench Dataset, extending the analysis to regional temperature variations by country.</p>
    <a href="https://github.com/ReubenChatterjee/Climate-Data-Analysis" target="_blank" rel="noopener noreferrer" className="project-link">View Project</a>
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