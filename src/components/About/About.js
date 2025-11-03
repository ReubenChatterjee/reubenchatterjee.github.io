import React from 'react';
import { motion } from 'framer-motion';
import './About.css';

const About = () => {
  return (
    <motion.div 
      className="about-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="section-title"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <h2>About Me</h2>
      </motion.div>
      
      <div className="about-content">
        <div className="about-flex">
          <motion.div 
            className="about-text"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <p className="intro-text">
            I'm a Data Scientist passionate about building end-to-end ML systems and scalable data pipelines that turn complex data into clear, actionable business impact.
            </p>

            <p>
            With a Master's in Data Science from UC San Diego (GPA: 3.82/4.00, graduated June 2025), I specialize in predictive analytics, customer segmentation, and production data infrastructure. My background in Computer Engineering gives me a strong foundation in machine learning, statistical analysis, scalable systems, and full-stack development.
            </p>

            <p>
            Most recently at Alcamo Marketing, I delivered measurable results: reduced operational costs by 60% through data infrastructure migration, built 15 production ETL pipelines processing 50GB+ daily data, and developed a churn prediction model that identified $2.1M in at-risk revenue for Afterpay. I work with modern data stacks including Snowflake, Fivetran, Python, SQL, and ML frameworks like XGBoost and LightGBM.
            </p>

            <p>
            My experience spans both academic and industry settings — from achieving 92% model accuracy at Datamatics Global Services, to analyzing educational equity data using NLP and statistical methods at UC San Diego's Ellis Lab, to teaching and mentoring 800+ students as Lead TA for UCSD's largest undergraduate data science course.
            </p>

            <p>I bridge the gap between technical depth and business impact, with a proven track record of delivering production ML systems and scalable analytics solutions that drive meaningful results.</p>
          </motion.div>
          
          <motion.div 
            className="about-image"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <img src="/images/headshot.png" alt="Reuben Chatterjee" />
          </motion.div>
        </div>
          
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="section-subheading"
        >
          My Journey
        </motion.h3>
        
        <div className="timeline-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="journey-text"
          >
            <p>I began my coding journey back in high school in 2017, starting with C and C++. But it was during my second year at the University of Mumbai (2020) that I truly found my footing in programming through Python, SQL, and Database Management Systems. Since then, Python has remained my go-to language for nearly everything, from scripting and automation to full-fledged machine learning pipelines.</p>
            <p>That same year, I joined a startup called The Learning Buddy as the 3D Design Lead, driven by a deep interest in computer graphics. I created AR/VR-ready assets and helped shape the 3D animation team. I'm especially proficient in <a href="https://www.behance.net/reubenchatterjee" target="_blank" rel="noopener noreferrer" className="inline-link">Blender</a>, and continue to explore design projects on the side.</p>
            <p>In my final undergraduate year, I was introduced to R-Studio, a tool I revisited more seriously later in grad school while working on a research study focused on gender disparities in data science education.</p>
            <p>In Fall 2023, I began my Master's in Data Science at UC San Diego, diving into courses like Statistical Models, Causal Inference, Scalable Systems, Deep Learning, and Fraud & Pricing Analytics. Alongside my studies, I worked part-time at the Halıcıoğlu Data Science Institute as a Social Media Analyst, where I turned engagement metrics into actionable insights to shape content strategy. I also interned at Datamatics Global Services, where I built scalable ETL pipelines and ML models for demand forecasting, achieving 92% accuracy.</p>
            <p>During my time at UCSD, I was appointed Teaching Assistant for COGS 108: Data Science in Practice — one of UCSD's largest undergraduate courses. I served as lead grader for 800+ students, wrote deployable Python scripts to improve grading efficiency, and mentored project groups throughout multiple quarters.</p>
            <p>In Winter 2025, I was promoted to Lead TA, managing a team of 16 TAs and IAs while overseeing student groups. During this time, I joined a research study at Ellis Lab focused on identifying gender-based patterns in data science education. I led the data analysis using NLP and statistical methods in R, contributing to research on educational equity.</p>
            <p>After graduating in June 2025, I joined Alcamo Marketing as a Data Scientist, where I made immediate impact: migrating data infrastructure to reduce costs by 60%, building 15 production ETL pipelines processing 50GB+ daily data using Snowflake and Fivetran, and developing a churn prediction model that identified $2.1M in at-risk revenue for Afterpay.</p>
            <p>Today, I continue to combine technical expertise with business acumen, building production ML systems and scalable data solutions that drive measurable results.</p>
          </motion.div>

          <motion.div
            className="timeline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2025</div>
              <div className="timeline-content">
                <h4>Data Scientist at Alcamo Marketing (Jul - Oct)</h4>
                <p>Built 15 production ETL pipelines processing 50GB+ daily data using SQL, Fivetran, Snowflake, Looker</p>
                <p>Reduced operational costs by 60% through infrastructure migration from Adverity to Snowflake</p>
                <p>Developed churn prediction model using XGBoost, identifying $2.1M in at-risk revenue</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2024 - 2025</div>
              <div className="timeline-content">
                <h4>Graduated from UC San Diego</h4>
                <p>Master's in Data Science (GPA: 3.82/4.00)</p>
                <p>Promoted to Lead TA for COGS 108, managing a team of 16 TAs and 800+ students (Jan 2025 - Jun 2025)</p>
                <p>Research Lead at Ellis Lab for the Gender disparities study (Sep 2024 - Jun 2025)</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2023 - 2024</div>
              <div className="timeline-content">
                <h4>Started Master's in Data Science at UC San Diego</h4>
                <p>Social Media Analyst at Halıcıoğlu Data Science Institute (Dec 2023 - Jun 2024)</p>
                <p>Data Science Intern at Datamatics Global Services (Jul 2024 - Sep 2024)</p>
                <p>Teaching Assistant for COGS 108 - Data Science in Practice (Oct 2024 - Dec 2024)</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2022</div>
              <div className="timeline-content">
                <h4>Found My Passion in Data Science</h4>
                <p>Mastered Python, SQL, and Database Management</p>
                <p>3D Design Lead at The Learning Buddy startup (Mar 2022 - Jun 2022)</p>
                <p>Created AR/VR-ready assets using Blender</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2019</div>
              <div className="timeline-content">
                <h4>Started University of Mumbai</h4>
                <p>BE in Computer Engineering</p>
                <p>Focused on Machine Learning and Data Analysis</p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-date">2017</div>
              <div className="timeline-content">
                <h4>Started Coding Journey</h4>
                <p>High school: C and C++</p>
                <p>Built foundation in programming fundamentals</p>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="section-subheading"
        >
          What I Bring to the Table
        </motion.h3>
        <motion.div 
          className="strength-cards"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4 }}
        >
          <div className="strength-card">
            <h4>Problem Solver</h4>
            <p>I enjoy solving real world problems using data, from building predictive models to automating entire workflows.</p>
          </div>
          <div className="strength-card">
            <h4>Creative Technologist</h4>
            <p>I blend analytical rigor with design thinking, from building ML pipelines to designing</p>
          </div>
          <div className="strength-card">
            <h4>Detail Oriented Leader</h4>
            <p>I pay close attention to the small details that make a big difference, and lead with empathy and precision, whether it's managing students or cross functional Teams.</p>
          </div>
          <div className="strength-card">
            <h4>Continuous Learner</h4>
            <p>I'm always diving into new tools, theories, and techniques, staying sharp across Python, R, SQL, and cloud platforms.</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default About;