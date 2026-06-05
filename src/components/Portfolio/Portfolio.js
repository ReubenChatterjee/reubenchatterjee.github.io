import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiGithub, FiArrowUpRight } from 'react-icons/fi';
import './Portfolio.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

// Project catalog — full set, used on /portfolio. The home page shows a
// curated subset via ProjectsSection.
const PROJECTS = [
  {
    id: 1,
    title: 'Multi-Model OCR Pipeline for Industrial Labels',
    eyebrow: 'Applied Materials',
    description:
      'Production-grade OCR pipeline using vision-language models (Claude Sonnet 4.5, Qwen VL, PaddleOCR), 85.7% precision across 500+ industrial part labels. Trained an RT-DETR detector at 97.8% precision and improved inference efficiency 3–5× through NVMe caching and float16 GPU optimization on Databricks.',
    image: '/images/part-serialization.png',
    categories: ['ds'],
    tags: ['Claude Sonnet 4.5', 'Qwen VL', 'PaddleOCR', 'RT-DETR', 'Databricks'],
    proprietary: true,
  },
  {
    id: 2,
    title: 'Afterpay Customer Retention Prediction',
    eyebrow: 'Alcamo Marketing',
    description:
      'Gradient boosting churn prediction model — 89% accuracy, 0.92 ROC-AUC — built on 50+ behavioral features from 350K+ transaction records. Identified $2.1M in at-risk revenue via 4-tier risk segmentation, improving customer lifetime value by 18%.',
    image: '/images/afterpay-churn.jpg',
    categories: ['ds', 'da'],
    tags: ['XGBoost', 'LightGBM', 'SHAP', 'Snowflake', 'SQL'],
    proprietary: true,
  },
  {
    id: 3,
    title: 'Snowflake Data Infrastructure Migration',
    eyebrow: 'Alcamo Marketing',
    description:
      'End-to-end migration of enterprise marketing from Adverity to Snowflake — 60% cost reduction with zero downtime. Architected 15+ automated ETL pipelines via Fivetran and SQL, processing 50GB+ daily across multiple platforms.',
    image: '/images/data-migration.jpg',
    categories: ['ds', 'fs'],
    tags: ['Snowflake', 'Fivetran', 'SQL', 'ETL', 'Python'],
    proprietary: true,
  },
  {
    id: 4,
    title: 'Credit Card Anomaly Detection',
    eyebrow: 'Personal',
    description:
      'Engineered 3,200+ behavioral features from 97K credit card transactions. Tuned LightGBM via multi-model comparison (Random Forest, XGBoost, CatBoost), 92% accuracy and 0.59 OOT AUC. Threshold tuning + SMOTE reduced false positives 10%, $2M+ projected annual savings.',
    image: '/images/fraud-detection.jpg',
    categories: ['ds', 'da'],
    tags: ['LightGBM', 'XGBoost', 'CatBoost', 'CNN', 'SMOTE'],
    github: 'https://github.com/ReubenChatterjee/credit-card-fraud-detection',
  },
  {
    id: 5,
    title: 'Gender & Group Dynamics Study',
    eyebrow: 'UCSD · Ellis Lab',
    description:
      'Analyzed demographic data from 500+ students on gender composition effects in team dynamics for COGS108. Used ANOVA to ensure balanced experimental groupings; surfaced statistically significant gender-based differences in programming comfort.',
    image: '/images/gender-study.png',
    categories: ['ds'],
    tags: ['R-Studio', 'ANOVA', 'Wilcoxon', 'ggplot2', 'NLP'],
    github: 'https://github.com/ReubenChatterjee/gender_groupwork',
  },
  {
    id: 6,
    title: 'Climate Change Analysis',
    eyebrow: 'Personal',
    description:
      'Built a NorESM2 linear regression model to predict global warming from CO₂ emissions in the ClimateBench dataset, extending the analysis to regional temperature variations across countries.',
    image: '/images/climate-change.jpg',
    categories: ['ds'],
    tags: ['Python', 'Regression', 'ClimateBench', 'Visualization'],
    github: 'https://github.com/ReubenChatterjee/Climate-Data-Analysis',
  },
  {
    id: 7,
    title: 'Document Summarization with LSI',
    eyebrow: 'Personal',
    description:
      'Extractive text summarization pipeline using Latent Semantic Indexing and Truncated SVD, benchmarked against BERTSUM on CNN-DailyMail. ROUGE evaluation surfaced LSI\'s limitations and the contextual edge of transformer architectures.',
    image: '/images/docs.png',
    categories: ['fs', 'ds'],
    tags: ['NLTK', 'BERTSUM', 'scikit-learn', 'SVD', 'NLP'],
    github: 'https://chocolate-yard-038.notion.site/Document-Summarization-Using-Latent-Semantic-Indexing-eb81fc4925054d54af65571ceb5227e5',
  },
  {
    id: 8,
    title: 'Student Accommodation Service',
    eyebrow: 'Mobile App',
    description:
      'Roommate-matching mobile app pairing students via K-Means clustering on the OCEAN personality model. Features lifestyle questionnaire, profile browsing, in-app messaging, and landlord–tenant matching.',
    image: '/images/sas.png',
    categories: ['fs'],
    tags: ['Flutter', 'Python', 'MySQL', 'Node.js', 'K-Means'],
    github: 'https://github.com/ReubenChatterjee/student-accommodation-app',
  },
  {
    id: 9,
    title: 'NYC Property Tax Fraud Detection',
    eyebrow: 'Personal',
    description:
      'Anomaly detection on 1M+ NYC property records to surface potential tax fraud. 25+ valuation/size ratio features, PCA for dimensionality reduction, Isolation Forest + LOF for irregularity scoring, validated against satellite imagery.',
    image: '/images/nyc.webp',
    categories: ['ds', 'da'],
    tags: ['scikit-learn', 'PCA', 'Isolation Forest', 'LOF', 'Python'],
    github: 'https://github.com/ReubenChatterjee/new-york-tax-fraud-detection',
  },
];

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ds', label: 'Data Science' },
  { id: 'da', label: 'Data Analytics' },
  { id: 'fs', label: 'Full Stack' },
];

// Apple system color tints rotated per card for visual variety
const TINTS = ['blue', 'purple', 'green', 'pink', 'amber', 'teal'];
const tintFor = (idx) => TINTS[idx % TINTS.length];

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

const PortfolioCard = ({ project, tint }) => (
  <article className="apple-project-card apple-portfolio-card" data-tint={tint}>
    <div
      className="apple-project-card-image"
      style={{ backgroundImage: `url(${project.image})` }}
    >
      <div className="apple-project-card-image-tint" aria-hidden="true" />
    </div>
    <div className="apple-project-card-content">
      <div className="apple-project-eyebrow">{project.eyebrow}</div>
      <h3 className="apple-project-card-title">{project.title}</h3>
      <p className="apple-project-card-description apple-portfolio-description">
        {project.description}
      </p>
      <div className="apple-project-tags">
        {project.tags.slice(0, 4).map((t) => (
          <span key={t} className="apple-project-tag">{t}</span>
        ))}
      </div>
      <ProjectCTA proprietary={project.proprietary} github={project.github} />
    </div>
  </article>
);

const Portfolio = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return PROJECTS;
    return PROJECTS.filter((p) => (p.categories || []).includes(activeFilter));
  }, [activeFilter]);

  return (
    <div className="apple-portfolio-page">
      {/* ─── Hero header ───────────────────────────────────── */}
      <section className="apple-portfolio-hero">
        <div className="apple-portfolio-hero-glow" aria-hidden="true" />
        <div className="apple-portfolio-hero-inner">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: APPLE_EASE }}
          >
            <span className="apple-eyebrow">Work</span>
            <h1 className="apple-portfolio-title">
              Projects, end{' '}
              <span className="apple-title-muted">to end.</span>
            </h1>
            <p className="apple-portfolio-subtitle">
              A catalog of the systems I've built — from production ML pipelines
              and forecasting models to research studies and full-stack apps.
            </p>
          </motion.div>

          {/* Apple-style segmented filter */}
          <motion.div
            className="apple-portfolio-filters"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: APPLE_EASE }}
            role="tablist"
            aria-label="Filter projects by category"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`apple-portfolio-filter${
                  activeFilter === f.id ? ' active' : ''
                }`}
                role="tab"
                aria-selected={activeFilter === f.id}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Grid ──────────────────────────────────────────── */}
      <section className="apple-portfolio-grid-section">
        <div className="apple-portfolio-grid-inner">
          <motion.div className="apple-portfolio-grid" layout>
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{
                    duration: 0.55,
                    delay: i * 0.04,
                    ease: APPLE_EASE,
                  }}
                >
                  <PortfolioCard project={p} tint={tintFor(i)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredProjects.length === 0 && (
            <div className="apple-portfolio-empty">
              No projects in this category yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Portfolio;
