'use client';

import { useState, FormEvent, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

// Dynamically import the canvas to prevent hydration mismatch and save initial load time
const NeuralCanvas = dynamic(() => import('./NeuralCanvas'), {
  ssr: false,
});

export default function Hero() {
  const [email, setEmail] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log('Submitted:', email);
    // Add waitlist logic here
    setEmail('');
  };

  // Optimize animations for mobile to prevent layout shifting
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: isMobile || shouldReduceMotion ? 0 : 20,
      scale: isMobile || shouldReduceMotion ? 0.98 : 1 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1] as const // Custom ease-out
      }
    },
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050B14] flex items-center justify-center">
      
      {/* 1. Base Architecture (Z-Index Layering) */}
      {/* Layer 1 (Bottom - z:1): Background Video & Overlay */}
      <div className="absolute inset-0 z-[1]">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster="/images/hero-poster.jpg" // Ensure you have a poster image
          className="w-full h-full object-cover opacity-15 mix-blend-screen"
        >
          {/* Replace with your actual premium abstract video path */}
          <source src="/videos/hero-background.mp4" type="video/mp4" />
        </video>
        {/* Dark semi-transparent overlay to ensure text readability */}
        <div className="absolute inset-0 bg-[#0a1628]/70 mix-blend-multiply" />
        {/* Soft gradient mask for edges */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/20 via-transparent to-[#0a1628]" />
      </div>

      {/* Layer 2 (z:2): Interactive Canvas */}
      <div className="absolute inset-0 z-[2]">
        <NeuralCanvas />
      </div>

      {/* Layer 3 (z:3): Static Noise Texture Overlay */}
      <div 
        className="absolute inset-0 z-[3] opacity-30 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Layer 4 (Top - z:10): Hero Content Container */}
      <div className="relative z-[10] max-w-5xl mx-auto px-6 sm:px-8 pt-32 pb-20 text-center flex flex-col items-center">
        
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center w-full"
        >
          {/* Eyebrow / Badge */}
          <motion.div 
            variants={itemVariants}
            className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-md shadow-[0_4px_24px_-8px_rgba(255,255,255,0.1)]"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium tracking-wide text-indigo-200">
              The Next Evolution of Design
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1 
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold tracking-tight text-white mb-6 drop-shadow-[0_2px_24px_rgba(255,255,255,0.1)]"
          >
            Build Digital <br className="hidden sm:block" />
            Experiences that{' '}
            <span className="relative whitespace-nowrap inline-block">
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
                Resonate
              </span>
              {/* Gradient Underline Effect */}
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
                className="absolute left-0 bottom-[0.1em] w-full h-[0.12em] bg-gradient-to-r from-indigo-500/80 to-cyan-400/80 rounded-full origin-left -z-10"
              />
            </span>
          </motion.h1>

          {/* Paragraph */}
          <motion.p 
            variants={itemVariants}
            className="max-w-2xl text-lg sm:text-xl text-white/70 mb-12 leading-relaxed"
          >
            Unleash the full potential of your brand with our highly performant, conversion-optimized architecture. Transform visitors into{' '}
            <span className="text-indigo-400 font-semibold">loyal customers</span> today.
          </motion.p>

          {/* Conversion Mechanism (Form) */}
          <motion.div variants={itemVariants} className="w-full max-w-md relative">
            {/* Soft background glow behind the form */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-50" />
            
            <form 
              onSubmit={handleSubmit}
              className="relative flex flex-col sm:flex-row items-center gap-2 p-1.5 bg-white/[0.06] backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_8px_40px_-12px_rgba(99,102,241,0.3)]"
            >
              <input
                type="email"
                required
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent text-white placeholder:text-white/40 px-5 py-3.5 outline-none text-base transition-colors focus:bg-white/[0.03] rounded-xl"
              />
              <button
                type="submit"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-500 text-white font-medium rounded-xl overflow-hidden transition-all duration-300 hover:bg-indigo-400 pulse-glow-btn"
              >
                <span>Join Waitlist</span>
                <ArrowRight 
                  className={`w-4 h-4 transition-transform duration-300 ease-out ${
                    isHovered ? 'translate-x-1' : 'translate-x-0'
                  }`} 
                />
              </button>
            </form>
          </motion.div>

        </motion.div>
      </div>

      {/* Global styles for specific animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .pulse-glow-btn {
          animation: pulseGlow 2.5s infinite;
        }
      `}} />
    </section>
  );
}
