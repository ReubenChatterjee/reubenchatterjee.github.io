import React from 'react';
import { motion } from 'framer-motion';
import './ExperienceSection.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

// Career timeline — chronological newest first. Each entry is one card
// on the right of the rail. The current role gets a "Now" badge + a
// pulsing ripple on its rail dot.
const EXPERIENCES = [
  {
    id: 'amat',
    date: 'Dec 2025 — Present',
    company: 'Applied Materials',
    role: "Data Scientist · AI/ML, Data Insights & Apps",
    bullets: [
      'Architected multi-model OCR pipeline using vision-language models achieving 85.7% precision on 500+ industrial labels.',
      'Trained RT-DETR object detection achieving 97.8% precision on printed labels.',
      'Improved inference efficiency 3–5× through GPU optimization and NVMe caching on Databricks.',
    ],
    tint: 'blue',
    current: true,
  },
  {
    id: 'alcamo',
    date: 'Jul — Oct 2025',
    company: 'Alcamo Marketing',
    role: 'Data Scientist',
    bullets: [
      'Built 15 production ETL pipelines processing 50GB+ daily data using SQL, Fivetran, Snowflake, Looker.',
      'Reduced operational costs 60% through infrastructure migration from Adverity to Snowflake.',
      'Developed XGBoost churn prediction model identifying $2.1M in at-risk revenue.',
    ],
    tint: 'green',
  },
  {
    id: 'ucsd',
    date: 'Sep 2023 — Jun 2025',
    company: 'UC San Diego',
    role: "Master's in Data Science · 3.82 GPA",
    bullets: [
      'Lead TA for COGS 108, managing a team of 16 TAs across 800+ students (Jan — Jun 2025).',
      'Research Lead at Ellis Lab — gender disparities in data science education (Sep 2024 — Jun 2025).',
      'Data Science Intern at Datamatics Global Services, 92% prediction accuracy on demand forecasting (Jul — Sep 2024).',
      'Coursework: Statistical Models, Causal Inference, Scalable Systems, Deep Learning.',
    ],
    tint: 'purple',
  },
  {
    id: 'tlb',
    date: 'Mar — Jun 2022',
    company: 'The Learning Buddy',
    role: '3D Design Lead',
    bullets: [
      'Created AR/VR-ready 3D assets using Blender for an EdTech startup.',
      'Helped shape the 3D animation team and visual language.',
    ],
    tint: 'pink',
  },
  {
    id: 'mumbai',
    date: '2019 — 2023',
    company: 'University of Mumbai',
    role: 'BE Computer Engineering',
    bullets: [
      'Foundation in machine learning, statistical analysis, and scalable systems.',
      'Found my path in data science in 2020 — Python, SQL, DBMS.',
    ],
    tint: 'amber',
  },
];

const TimelineItem = ({ exp, index }) => {
  const { date, company, role, bullets, tint, current } = exp;
  return (
    <motion.div
      className="apple-timeline-item"
      data-current={current ? 'true' : undefined}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.9,
        delay: index * 0.08,
        ease: APPLE_EASE,
      }}
    >
      {/* Date column (desktop only — hidden on mobile, repeated inside card) */}
      <div className="apple-timeline-aside">
        <span className="apple-timeline-date">{date}</span>
      </div>

      {/* Rail with vertical line + dot */}
      <div className="apple-timeline-rail" data-tint={tint}>
        <span className="apple-timeline-dot" aria-hidden="true" />
        {current && (
          <span className="apple-timeline-dot-pulse" aria-hidden="true" />
        )}
      </div>

      {/* Content card */}
      <div className="apple-timeline-content">
        <div className="apple-timeline-card" data-tint={tint}>
          <div className="apple-timeline-card-header">
            <div className="apple-timeline-card-meta">
              <div className="apple-timeline-date apple-timeline-date-mobile">
                {date}
              </div>
              <div className="apple-timeline-company">{company}</div>
              <div className="apple-timeline-role">{role}</div>
            </div>
            {current && (
              <div className="apple-timeline-now" aria-label="Currently here">
                <span className="apple-timeline-now-dot" />
                Now
              </div>
            )}
          </div>

          <ul className="apple-timeline-bullets">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

const ExperienceSection = () => {
  return (
    <section className="apple-experience">
      <div className="apple-experience-inner">
        <motion.div
          className="apple-about-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: APPLE_EASE }}
        >
          <span className="apple-eyebrow">Experience</span>
          <h2 className="apple-section-title">
            From classroom{' '}
            <span className="apple-title-muted">to production.</span>
          </h2>
        </motion.div>

        <div className="apple-timeline">
          {EXPERIENCES.map((exp, i) => (
            <TimelineItem key={exp.id} exp={exp} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ExperienceSection;
