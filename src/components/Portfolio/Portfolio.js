import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './Portfolio.css';

const Portfolio = () => {
  // Sample project data
  const projects = [
    {
      id: 1,
      title: 'Afterpay Customer Churn Prediction',
      description: 'Developed a production-ready churn prediction model that identified $2.1M+ in at-risk revenue for Alcamo MArketing\'s  client Afterpay. Built comprehensive customer segmentation pipeline with feature engineering on transaction patterns, engagement metrics, and behavioral indicators. Deployed XGBoost classifier achieving high precision, enabling proactive customer retention strategies.',
      image: 'afterpay-churn.jpg',
      categories: ['ds', 'da'],
      technologies: ['Python', 'XGBoost', 'Colab', 'Synthetic Data Generation', 'Feature Engineering', 'Customer Segmentation'],
      github: null
    },
    {
      id: 2,
      title: 'Snowflake Data Infrastructure Migration',
      description: 'Led end-to-end migration of Enterprise marketing from Adverity to Snowflake, reducing operational costs by 60% while improving data quality and accessibility. Architected and deployed 15+ automated and production-ready ETL pipelines using Fivetran and SQL, processing 50GB+ daily data across multiple marketing platforms. Designed scalable data warehouse schema and implemented data governance frameworks ensuring zero downtime during transition.',
      image: 'data-migration.jpg',
      categories: ['ds', 'fs'],
      technologies: ['Snowflake', 'Fivetran', 'SQL', 'ETL Pipelines', 'Python', 'Data Architecture'],
      github: null
    },
    {
      id: 3,
      title: 'Fraud Detection for Credit Card Transactions',
      description: 'Developed a robust fraud detection model for 97,000+ credit card transactions using advanced machine learning techniques like LightGBM, CNN, and XGBoost, achieving 92% accuracy. ',
      image: 'fraud-detection.jpg',
      categories: ['ds', 'da'],
      technologies: ['Python', 'Pytorch', 'XGBoost', 'LightGBM', 'CNN', 'Seaborn'],
      github: 'https://github.com/ReubenChatterjee/credit-card-fraud-detection'
    },
    {
        id: 4,
        title: 'Gender & Group Dynamics Research Study',
        description: 'Analyzed demographic data from 500+ students to investigate the effects of gender composition on team dynamics in COGS108, a data science course at UCSD. Conducted statistical tests (ANOVA) to ensure balanced experimental groupings across demographics like race, first-gen, international status etc. Found statistically significant gender-based differences in programming comfort and created visualizations to support findings.',
        image: 'gender-study.png',
        categories: 'ds',
        technologies: ['R', 'ggplot2', 'ANOVA', 'Wilcoxon Rank Sum test', 'Tukey Stats test', 'Data Wrangling'],
        github: 'https://github.com/ReubenChatterjee/gender_groupwork'
      },
    {
      id: 5,
      title: 'Climate Change Analysis',
      description: 'Built and evaluated a NorESM2 linear regression model to predict global warming based on CO2 emissions from the ClimateBench Dataset, extending the analysis to regional temperature variations by country.',
      image: 'climate-change.jpg',
      categories: 'ds',
      technologies: ['React', 'Firebase', 'Redux', 'Styled Components'],
      github: 'https://github.com/ReubenChatterjee/Climate-Data-Analysis'
    },
    {
      id: 6,
      title: 'Document Summarization Using Latent Semantic Indexing',
      description: 'Implemented a pipeline for extractive text summarization using Latent Semantic Indexing (LSI) and Truncated SVD, comparing its performance with BERTSUM, a transformer-based SOTA model. Applied advanced pre-processing, TF-IDF vectorization, and ROUGE evaluation on a subset of the CNN-DailyMail dataset to generate and assess summaries. Demonstrated the limitations of LSI and the effectiveness of transformer architectures for contextual summarization.',
      image: 'docs.png',
      category: 'fs',
      technologies: ['NLTK', 'BERTSUM', 'Scikit-learn', 'Singular Value Decomposition', 'Latent Semantic Indexing'],
      github: 'https://chocolate-yard-038.notion.site/Document-Summarization-Using-Latent-Semantic-Indexing-eb81fc4925054d54af65571ceb5227e5'
    },
    {
      id: 7,
      title: 'Student Accommodation Service',
      description: 'Designed a mobile application that matches students with compatible roommates using the K-Means clustering algorithm and OCEAN personality model. The app collects lifestyle preferences via a personality questionnaire and clusters users to suggest matches with similar traits. Features include profile browsing, in-app messaging, and landlord–tenant matching.',
      image: 'sas.png',
      category: 'fs',
      technologies: ['Flutter', 'Python', 'MySQL', 'Node.js', 'Unsupervised Learning'],
      github: 'https://github.com/ReubenChatterjee/student-accommodation-app'
    },
    {
        id: 8,
        title: 'Tax Fraud Detection for NYC Properties',
        description: 'Built an anomaly detection pipeline on 1M+ NYC property records to identify potential tax fraud. Engineered 25+ valuation and size ratio features, applied PCA for dimensionality reduction, and used Isolation Forest and Local Outlier Factor to detect irregularities. Flagged high-risk properties and validated anomalies using satellite imagery and statistical deviations.',
        image: 'nyc.webp',
        categories: ['ds', 'da'],
        technologies: ['Python', 'Scikit-learn', 'PCA', 'LOF', 'Isolation Forest', 'Seaborn'],
        github: 'https://github.com/ReubenChatterjee/new-york-tax-fraud-detection'
      }
  ];

  // Comprehensive skills data
  const allSkills = [
    // Data Engineering
    { name: 'SQL', category: 'data-engineering' },
    { name: 'Python', category: 'data-engineering' },
    { name: 'Snowflake', category: 'data-engineering' },
    { name: 'Fivetran', category: 'data-engineering' },
    { name: 'Pandas | Numpy', category: 'data-engineering' },
    { name: 'ETL Pipelines', category: 'data-engineering' },
    { name: 'PostgreSQL', category: 'data-engineering' },
    { name: 'MongoDB', category: 'data-engineering' },
    { name: 'Spark', category: 'data-engineering' },
    { name: 'Hadoop', category: 'data-engineering' },
    { name: 'AWS', category: 'data-engineering' },
    { name: 'Azure', category: 'data-engineering' },
    { name: 'GCP', category: 'data-engineering' },

    // Machine Learning
    { name: 'XGBoost', category: 'ML' },
    { name: 'LightGBM', category: 'ML' },
    { name: 'Tensorflow', category: 'ML' },
    { name: 'Pytorch', category: 'ML' },
    { name: 'Keras', category: 'ML' },
    { name: 'scikit-learn', category: 'ML' },
    { name: 'Neural Networks', category: 'ML' },
    { name: 'Feature Engineering', category: 'ML' },
    { name: 'Decision Trees', category: 'ML' },

    // Data Analytics
    { name: 'R-studio | R-GUI', category: 'data-analytics' },
    { name: 'Tableau', category: 'data-analytics' },
    { name: 'PowerBI', category: 'data-analytics' },
    { name: 'Looker', category: 'data-analytics' },
    { name: 'Excel', category: 'data-analytics' },
    { name: 'Seaborn | Matplotlib', category: 'data-analytics' },
    { name: 'Statistical Analysis', category: 'data-analytics' },
    { name: 'A/B Testing', category: 'data-analytics' },

    // Frontend
    { name: 'React', category: 'frontend' },
    { name: 'JavaScript', category: 'frontend' },
    { name: 'HTML5', category: 'frontend' },
    { name: 'CSS3', category: 'frontend' },
    { name: 'Redux', category: 'frontend' },

    // Backend
    { name: 'Node.js', category: 'backend' },
    { name: 'Express', category: 'backend' },
    { name: 'Firebase', category: 'backend' },

    // Other Tools
    { name: 'Git', category: 'tools' },
    { name: 'Bash', category: 'tools' },
    { name: 'Jupyter', category: 'tools' },
    { name: 'G-suite', category: 'tools' },
    { name: 'MS Office', category: 'tools' },
    { name: 'Adobe Premiere Pro', category: 'tools' },
    { name: 'Blender 3D', category: 'tools' },


  ];

  const [filter, setFilter] = useState('all');
  
  // State to track if we need to scroll to the skills section
  const [scrollToSkills, setScrollToSkills] = useState(false);
  
  useEffect(() => {
    // Check if URL has the #skills hash
    if (window.location.hash === '#skills') {
      setScrollToSkills(true);
    }
  }, []);
  
  useEffect(() => {
    // Scroll to the skills section if needed
    if (scrollToSkills) {
      const skillsSection = document.getElementById('skills-section');
      if (skillsSection) {
        skillsSection.scrollIntoView({ behavior: 'smooth' });
        setScrollToSkills(false);
      }
    }
  }, [scrollToSkills]);

  const filteredProjects = filter === 'all' 
  ? projects 
  : projects.filter(project => {
      // Handle both formats (backward compatibility)
      if (project.categories) {
        return project.categories.includes(filter);
      } else if (project.category) {
        return project.category === filter;
      }
      return false;
    });

  return (
    <motion.div 
      className="portfolio-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div 
        className="section-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2>My Portfolio</h2>
      </motion.div>

      <motion.div 
        className="filter-buttons"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <button 
          className={filter === 'all' ? 'active' : ''} 
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'ds' ? 'active' : ''} 
          onClick={() => setFilter('ds')}
        >
          Data Science
        </button>
        <button 
          className={filter === 'da' ? 'active' : ''} 
          onClick={() => setFilter('da')}
        >
          Data Analytics
        </button>

        <button 
          className={filter === 'fs' ? 'active' : ''} 
          onClick={() => setFilter('fs')}
        >
          Full Stack
        </button>
      </motion.div>

      <motion.div 
        className="projects-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {filteredProjects.map((project, index) => (
          <motion.div 
            key={project.id}
            className="project-item"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 * (index + 3) }}
            whileHover={{ y: -10, transition: { duration: 0.3 } }}
          >
            <div
                className="project-image"
                style={{ 
                    backgroundImage: `url(/images/${project.image})`
                    }}
                ></div>
            <div className="project-details">
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="technologies">
                {project.technologies.map((tech, i) => (
                  <span key={i} className="tech-tag">{tech}</span>
                ))}
              </div>
              
              <div className="project-links">
                {project.github ? (
                  <a href={project.github} target="_blank" rel="noopener noreferrer" className="view-project">View on Github</a>
                ) : (
                  <span className="confidential-tag">Proprietary Work</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* NEW: Skills Section */}
      <motion.div 
        id="skills-section"
        className="skills-section-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div 
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h2>My Complete Skill Set</h2>
        </motion.div>
        
        <motion.div
          className="skills-categories"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="skills-category">
            <h3>Data Engineering</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'data-engineering')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="skills-category">
            <h3>Machine Learning</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'ML')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="skills-category">
            <h3>Data Analytics & Visualization</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'data-analytics')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="skills-category">
            <h3>Frontend</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'frontend')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="skills-category">
            <h3>Backend</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'backend')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="skills-category">
            <h3>Other Tools</h3>
            <div className="skills-grid">
              {allSkills
                .filter(skill => skill.category === 'tools')
                .map((skill, index) => (
                  <div key={index} className="skill-item">
                    {skill.name}
                  </div>
                ))
              }
            </div>
          </div>



        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default Portfolio;