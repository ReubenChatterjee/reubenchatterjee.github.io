import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowUpRight, FiLock, FiGithub } from 'react-icons/fi';
import './ProjectsSection.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

// The featured/hero project — gets a wide two-column card at the top.
const HERO_PROJECT = {
  id: 'ocr',
  eyebrow: 'Featured · Applied Materials',
  title: 'Multi-Model OCR Pipeline for Industrial Labels',
  description:
    'Production-grade OCR system combining vision-language models (Claude Sonnet 4.5, Qwen VL, PaddleOCR) with a custom RT-DETR detector — 85.7% precision across 500+ industrial labels, 3–5× faster inference via GPU optimization on Databricks.',
  image: '/images/part-serialization.png',
  tags: ['Claude Sonnet 4.5', 'Qwen VL', 'PaddleOCR', 'RT-DETR', 'Databricks'],
  tint: 'blue',
  proprietary: true,
};

const PROJECTS = [
  {
    id: 'afterpay',
    eyebrow: 'Alcamo Marketing',
    title: 'Afterpay Retention Prediction',
    description:
      'Gradient boosting churn model — 89% accuracy, 0.92 ROC-AUC — identifying $2.1M in at-risk revenue across 4 risk tiers.',
    image: '/images/afterpay-churn.jpg',
    tags: ['XGBoost', 'Python', 'SHAP', 'Snowflake'],
    tint: 'green',
    proprietary: true,
  },
  {
    id: 'gender',
    eyebrow: 'UCSD · Ellis Lab',
    title: 'Gender & Group Dynamics Study',
    description:
      'Statistical analysis of 500+ students examining gender composition effects on team dynamics using ANOVA and NLP.',
    image: '/images/gender-study.png',
    tags: ['R-Studio', 'ANOVA', 'NLP', 'Statistics'],
    tint: 'pink',
    github: 'https://github.com/ReubenChatterjee/gender_groupwork',
  },
  {
    id: 'fraud',
    eyebrow: 'Personal',
    title: 'Credit Card Fraud Detection',
    description:
      'Ensemble fraud model trained on 97K+ transactions combining LightGBM, XGBoost, and a CNN classifier.',
    image: '/images/fraud-detection.jpg',
    tags: ['LightGBM', 'XGBoost', 'CNN', 'Python'],
    tint: 'amber',
    github: 'https://github.com/ReubenChatterjee/credit-card-fraud-detection',
  },
  {
    id: 'sas',
    eyebrow: 'Mobile App',
    title: 'Student Accommodation Service',
    description:
      'Roommate-matching mobile app pairing students via K-Means clustering on the OCEAN personality model.',
    image: '/images/sas.png',
    tags: ['K-Means', 'OCEAN', 'Mobile', 'Python'],
    tint: 'purple',
    github: 'https://github.com/ReubenChatterjee/student-accommodation-app',
  },
];

// "Chip" CTA at the bottom of each card — adapts based on whether the
// project is proprietary, on GitHub, or just informational.
const ProjectCTA = ({ proprietary, github }) => {
  if (proprietary) {
    return (
      <div className="apple-project-chip apple-project-chip-proprietary">
        <FiLock size={13} />
        <span>Proprietary Work</span>
      </div>
    );
  }
  if (github) {
    return (
      <a
        href={github}
        target="_blank"
        rel="noopener noreferrer"
        className="apple-project-chip apple-project-chip-link"
      >
        <FiGithub size={13} />
        <span>View on GitHub</span>
        <FiArrowUpRight size={13} className="apple-project-chip-arrow" />
      </a>
    );
  }
  return null;
};

const ProjectHeroCard = ({ project }) => {
  const { eyebrow, title, description, image, tags, tint, proprietary, github } = project;
  return (
    <motion.article
      className="apple-project-hero"
      data-tint={tint}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1, ease: APPLE_EASE }}
    >
      <div
        className="apple-project-hero-image"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className="apple-project-hero-image-tint" aria-hidden="true" />
      </div>
      <div className="apple-project-hero-content">
        <div className="apple-project-eyebrow">{eyebrow}</div>
        <h3 className="apple-project-hero-title">{title}</h3>
        <p className="apple-project-hero-description">{description}</p>
        <div className="apple-project-tags">
          {tags.map((tag) => (
            <span key={tag} className="apple-project-tag">{tag}</span>
          ))}
        </div>
        <ProjectCTA proprietary={proprietary} github={github} />
      </div>
    </motion.article>
  );
};

const ProjectCard = ({ project, index }) => {
  const { eyebrow, title, description, image, tags, tint, proprietary, github } = project;
  return (
    <motion.article
      className="apple-project-card"
      data-tint={tint}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.9,
        delay: index * 0.08,
        ease: APPLE_EASE,
      }}
    >
      <div
        className="apple-project-card-image"
        style={{ backgroundImage: `url(${image})` }}
      >
        <div className="apple-project-card-image-tint" aria-hidden="true" />
      </div>
      <div className="apple-project-card-content">
        <div className="apple-project-eyebrow">{eyebrow}</div>
        <h3 className="apple-project-card-title">{title}</h3>
        <p className="apple-project-card-description">{description}</p>
        <div className="apple-project-tags">
          {tags.slice(0, 4).map((tag) => (
            <span key={tag} className="apple-project-tag">{tag}</span>
          ))}
        </div>
        <ProjectCTA proprietary={proprietary} github={github} />
      </div>
    </motion.article>
  );
};

const ProjectsSection = () => {
  return (
    <section className="apple-projects">
      <div className="apple-projects-inner">
        <motion.div
          className="apple-about-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: APPLE_EASE }}
        >
          <div className="apple-projects-header-row">
            <div>
              <span className="apple-eyebrow">Work</span>
              <h2 className="apple-section-title">
                Selected <span className="apple-title-muted">projects.</span>
              </h2>
            </div>
            <Link to="/portfolio" className="apple-projects-see-all">
              See all work
              <FiArrowUpRight size={16} />
            </Link>
          </div>
        </motion.div>

        <ProjectHeroCard project={HERO_PROJECT} />

        <div className="apple-projects-grid">
          {PROJECTS.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;
