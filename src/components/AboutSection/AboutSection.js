import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import './AboutSection.css';

const APPLE_EASE = [0.25, 0.46, 0.45, 0.94];

// Tween a number from 0 → end when the element scrolls into view.
// Used by every stat card on this section — scoped here so AboutSection
// is self-contained.
const AnimatedCounter = ({ end, duration = 2, prefix = '', suffix = '', decimals = 0 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  useEffect(() => {
    if (!inView) return;
    let start;
    let frame;
    const tick = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / (duration * 1000), 1);
      // ease-out cubic for that smooth Apple-y settle
      const eased = 1 - Math.pow(1 - p, 3);
      const value = end * eased;
      setCount(decimals > 0 ? value.toFixed(decimals) : Math.floor(value));
      if (p < 1) frame = requestAnimationFrame(tick);
      else setCount(decimals > 0 ? end.toFixed(decimals) : end);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, end, duration, decimals]);

  return (
    <span ref={ref}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
};

const STATS = [
  {
    end: 60,
    suffix: '%',
    label: 'Cost Reduction',
    sub: 'Infrastructure migration savings',
  },
  {
    end: 2.1,
    prefix: '$',
    suffix: 'M+',
    decimals: 1,
    duration: 2.4,
    label: 'Revenue Protected',
    sub: 'At-risk revenue identified',
  },
  {
    end: 15,
    suffix: '+',
    label: 'Production Pipelines',
    sub: 'Processing 50GB+ daily',
  },
  {
    end: 800,
    suffix: '+',
    duration: 2.4,
    label: 'Students Mentored',
    sub: 'Lead TA at UCSD',
  },
];

const AboutSection = () => {
  return (
    <section className="apple-about">
      <div className="apple-about-inner">
        {/* Header */}
        <motion.div
          className="apple-about-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: APPLE_EASE }}
        >
          <span className="apple-eyebrow">About</span>
          <h2 className="apple-section-title">
            The story <span className="apple-title-muted">so far.</span>
          </h2>
        </motion.div>

        {/* Two-column grid: bio | stats */}
        <div className="apple-about-grid">
          {/* Glassmorphic bio card */}
          <motion.div
            className="apple-glass-card apple-bio-card"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1, ease: APPLE_EASE }}
          >
            <div className="apple-bio-header">
              <div className="apple-bio-avatar">
                <img src="/images/headshot.png" alt="Reuben Chatterjee" />
              </div>
              <div className="apple-bio-id">
                <div className="apple-bio-name">Reuben Chatterjee</div>
                <div className="apple-bio-role">
                  Data Scientist <span className="apple-bio-sep">·</span> Applied Materials
                </div>
              </div>
            </div>

            <div className="apple-bio-body">
              <p className="apple-bio-lead">
                I build end-to-end ML systems and scalable data pipelines that turn complex data into clear business impact.
              </p>
              <p>
                Currently on the AI/ML team at Applied Materials, architecting solutions for Computer Vision problems, training custom object detection models (RT-DETR, YOLO etc.), and designing OCR pipelines with
                vision-language models (GLM, Qwen VL, Paddle, Gemini etc.) 
              </p>
              <p>
                Previously at Alcamo Marketing, where I cut infrastructure costs by 60% and built a churn model
                identifying $2.1M in at-risk revenue.
              </p>

              <p>
              Master's in Data Science from UC San Diego.
              </p>
            </div>

            <Link to="/about" className="apple-text-link">
              Read more about the journey
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M5.5 3L10.5 8L5.5 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </motion.div>

          {/* Stat cards — 2x2 grid */}
          <div className="apple-stats-grid">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="apple-glass-card apple-stat-card"
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.9,
                  delay: 0.15 + i * 0.1,
                  ease: APPLE_EASE,
                }}
              >
                <div className="apple-stat-number">
                  <AnimatedCounter
                    end={stat.end}
                    prefix={stat.prefix || ''}
                    suffix={stat.suffix || ''}
                    decimals={stat.decimals || 0}
                    duration={stat.duration || 2}
                  />
                </div>
                <div className="apple-stat-label">{stat.label}</div>
                <div className="apple-stat-sub">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
