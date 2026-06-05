import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiTarget, FiFeather, FiCompass, FiBookOpen, FiArrowUpRight } from 'react-icons/fi';
import './About.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

// Long-form narrative split into clean chapters. The dedicated /about
// page goes deeper than the home About section — full journey + strengths.
const JOURNEY_CHAPTERS = [
  {
    year: '2017 — 2020',
    title: 'The first lines of code.',
    body:
      'Started in high school with C and C++. The languages were unforgiving, but the loop felt right — write, run, watch it work. By my second year at the University of Mumbai I had a real foothold: Python, SQL, and Database Management Systems became the daily tools. Python has been my go-to language ever since.',
  },
  {
    year: '2020 — 2022',
    title: 'Curiosity, in three dimensions.',
    body:
      'A parallel interest in computer graphics led me to The Learning Buddy in 2022 as 3D Design Lead, building AR/VR-ready assets in Blender and shaping the visual language of the EdTech startup. I still ship the occasional design project on the side — the work lives on Behance.',
  },
  {
    year: '2023 — 2024',
    title: 'San Diego, and the deep end.',
    body:
      'Fall 2023 I started my Master\'s in Data Science at UC San Diego — Statistical Models, Causal Inference, Scalable Systems, Deep Learning. Alongside the degree I worked part-time as a Social Media Analyst at the Halıcıoğlu Data Science Institute, then interned at Datamatics Global Services on demand-forecasting pipelines that hit 92% accuracy.',
  },
  {
    year: '2024 — 2025',
    title: 'Teaching what I was learning.',
    body:
      'Appointed TA for COGS 108 — one of UCSD\'s largest undergrad courses — and promoted to Lead TA in Winter 2025, managing a team of 16 TAs across 800+ students. In parallel I led data analysis at the Ellis Lab on a study of gender-based patterns in data science education, using NLP and statistics in R.',
  },
  {
    year: '2025',
    title: 'From research to revenue.',
    body:
      'Graduated June 2025 with a 3.82 GPA and joined Alcamo Marketing as a Data Scientist. Within months I migrated the data infrastructure to Snowflake (60% cost reduction), built 15 production ETL pipelines processing 50GB+ daily, and shipped a churn prediction model that identified $2.1M in at-risk revenue for Afterpay.',
  },
  {
    year: 'Dec 2025 — Now',
    title: 'Applied AI, at scale.',
    body:
      'Joined the AI/ML team at Applied Materials in the Data Insights & Apps department. I architect production computer-vision systems — multi-model OCR pipelines combining Claude Sonnet 4.5, Qwen VL, and PaddleOCR with custom RT-DETR detectors, optimized 3–5× through GPU work on Databricks. Where cutting-edge AI meets industrial reality.',
  },
];

const STRENGTHS = [
  {
    icon: FiTarget,
    title: 'Problem solver.',
    body:
      'Real-world problems, framed in data. From predictive models to end-to-end workflow automation, I look for the root cause and ship the fix.',
    tint: 'blue',
  },
  {
    icon: FiFeather,
    title: 'Creative technologist.',
    body:
      'Analytical rigor with design sensibility. ML pipelines, frontends, 3D scenes — I move between them and keep the work cohesive.',
    tint: 'pink',
  },
  {
    icon: FiCompass,
    title: 'Detail-oriented leader.',
    body:
      'I sweat the small things — naming, ergonomics, error states. I lead with empathy and precision, whether the team is students or engineers.',
    tint: 'purple',
  },
  {
    icon: FiBookOpen,
    title: 'Continuous learner.',
    body:
      'I stay sharp across Python, R, SQL, and cloud platforms. New tools, new theory — I treat the field as something I get to keep growing into.',
    tint: 'green',
  },
];

const About = () => {
  return (
    <div className="apple-about-page">
      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="apple-about-page-hero">
        <div className="apple-about-page-glow" aria-hidden="true" />

        <div className="apple-about-page-hero-inner">
          <motion.div
            className="apple-about-page-hero-content"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: APPLE_EASE }}
          >
            <span className="apple-eyebrow">About</span>
            <h1 className="apple-about-page-title">
              Data Scientist,{' '}
              <span className="apple-title-muted">building in production.</span>
            </h1>
            <p className="apple-about-page-lead">
              I'm Reuben — a Data Scientist who treats ML systems as products. I
              build the pipeline, the model, the interface — whatever it takes to
              ship something measurable.
            </p>
            <p className="apple-about-page-lead-secondary">
              Currently at Applied Materials. Before that, Alcamo Marketing,
              UC San Diego, and a few years of figuring out where I wanted to
              point all this curiosity.
            </p>
          </motion.div>

          <motion.div
            className="apple-about-page-headshot"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.2, ease: APPLE_EASE }}
          >
            <div className="apple-about-page-headshot-glow" aria-hidden="true" />
            <img src="/images/headshot.png" alt="Reuben Chatterjee" />
          </motion.div>
        </div>
      </section>

      {/* ─── Journey ───────────────────────────────────────── */}
      <section className="apple-about-page-journey">
        <div className="apple-about-page-section-inner">
          <motion.div
            className="apple-about-page-section-header"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease: APPLE_EASE }}
          >
            <span className="apple-eyebrow">Journey</span>
            <h2 className="apple-section-title">
              From the first line{' '}
              <span className="apple-title-muted">to now.</span>
            </h2>
          </motion.div>

          <div className="apple-about-page-chapters">
            {JOURNEY_CHAPTERS.map((c, i) => (
              <motion.article
                key={c.year}
                className="apple-about-page-chapter"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.9,
                  delay: i * 0.05,
                  ease: APPLE_EASE,
                }}
              >
                <div className="apple-about-page-chapter-year">{c.year}</div>
                <div className="apple-about-page-chapter-body">
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Strengths ─────────────────────────────────────── */}
      <section className="apple-about-page-strengths">
        <div className="apple-about-page-section-inner">
          <motion.div
            className="apple-about-page-section-header"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, ease: APPLE_EASE }}
          >
            <span className="apple-eyebrow">Strengths</span>
            <h2 className="apple-section-title">
              What I bring{' '}
              <span className="apple-title-muted">to the table.</span>
            </h2>
          </motion.div>

          <div className="apple-about-page-strengths-grid">
            {STRENGTHS.map(({ icon: Icon, title, body, tint }, i) => (
              <motion.div
                key={title}
                className="apple-about-page-strength-card"
                data-tint={tint}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.9,
                  delay: i * 0.08,
                  ease: APPLE_EASE,
                }}
              >
                <div className="apple-about-page-strength-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────────── */}
      <section className="apple-about-page-cta">
        <motion.div
          className="apple-about-page-cta-inner"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1, ease: APPLE_EASE }}
        >
          <span className="apple-eyebrow">Next</span>
          <h2 className="apple-about-page-cta-title">
            Want to build{' '}
            <span className="apple-title-muted">something together?</span>
          </h2>
          <Link to="/contact" className="apple-about-page-cta-btn">
            Get in touch
            <FiArrowUpRight size={18} />
          </Link>
        </motion.div>
      </section>
    </div>
  );
};

export default About;
