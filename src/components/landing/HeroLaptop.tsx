"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion, useSpring, useTransform } from "framer-motion";
import { useIsReducedMotion, useMotionReady } from "./motion-primitives";
import styles from "./hero-laptop.module.css";

interface HeroLaptopProps {
  className?: string;
}

export function HeroLaptop({ className = "" }: HeroLaptopProps) {
  const reduced = useIsReducedMotion();
  const motionReady = useMotionReady();
  const [isFinePointer, setIsFinePointer] = useState(false);

  useEffect(() => {
    setIsFinePointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  // Smooth mouse physics for restrained 2-4px depth and sub-degree tilt
  const springX = useSpring(0, { stiffness: 40, damping: 24 });
  const springY = useSpring(0, { stiffness: 40, damping: 24 });

  useEffect(() => {
    if (reduced || !isFinePointer) return;

    function handleMouseMove(e: MouseEvent) {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      springX.set(nx);
      springY.set(ny);
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reduced, isFinePointer, springX, springY]);

  // Restrained cursor parallax bounds: rotateY +-1.4 deg, rotateX +-1.0 deg, slight shift +-4px
  const laptopParallaxX = useTransform(springX, [-0.5, 0.5], [-5, 5]);
  const laptopParallaxY = useTransform(springY, [-0.5, 0.5], [-4, 4]);
  const laptopRotateY = useTransform(springX, [-0.5, 0.5], [-1.3, 1.3]);
  const laptopRotateX = useTransform(springY, [-0.5, 0.5], [1.0, -1.0]);

  // Atmospheric glow moves in counter-direction for 3D depth
  const glowParallaxX = useTransform(springX, [-0.5, 0.5], [14, -14]);
  const glowParallaxY = useTransform(springY, [-0.5, 0.5], [10, -10]);

  return (
    <div className={`${styles.laptopStage} ${className}`}>
      {/* Ambient Breathing Violet Glow behind the workstation */}
      <motion.div
        className={styles.atmosphericGlow}
        aria-hidden="true"
        animate={
          reduced
            ? undefined
            : {
                opacity: [0.22, 0.36, 0.22],
                scale: [0.98, 1.03, 0.98],
              }
        }
        transition={
          reduced
            ? undefined
            : {
                duration: 9.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
        style={!reduced && isFinePointer ? { x: glowParallaxX, y: glowParallaxY } : undefined}
      />

      {/* Ground horizon reflection & contact shadow */}
      <div className={styles.groundReflection} aria-hidden="true" />

      {/* Main Laptop Workstation Assembly */}
      <motion.div
        className={styles.laptopContainer}
        role="img"
        aria-label="ZTerminal quantitative research workstation showing authentic terminal interface"
        initial={
          motionReady
            ? {
                opacity: 0,
                y: 36,
                scale: 0.975,
                filter: "blur(8px)",
              }
            : false
        }
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
        }}
        transition={{
          duration: 1.0,
          delay: 0.25,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={
          !reduced && isFinePointer
            ? {
                x: laptopParallaxX,
                y: laptopParallaxY,
                rotateX: laptopRotateX,
                rotateY: laptopRotateY,
              }
            : undefined
        }
      >
        {/* Continuous Slow Floating Loop (imperceptible life: +-4px, +-0.3 deg over 7.5s) */}
        <motion.div
          className={styles.floatingWrapper}
          animate={
            reduced
              ? undefined
              : {
                  y: [-4, 4, -4],
                  rotateZ: [-0.3, 0.3, -0.3],
                }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 7.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        >
          {/* Photorealistic Workstation Image with Real ZTerminal Chart & UI */}
          <div className={styles.imageFrame}>
            <Image
              src="/landing/hero-laptop-photorealistic.png"
              alt="Authentic ZTerminal quantitative research workstation with live order book, candlestick chart, and Python strategy tabs"
              width={1488}
              height={992}
              priority
              className={styles.laptopImage}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 55vw, 1020px"
            />

            {/* Specular Screen Sheen Sweep on Entry */}
            {!reduced && (
              <motion.div
                className={styles.screenSheen}
                aria-hidden="true"
                initial={{ x: "-120%", opacity: 0 }}
                animate={motionReady ? { x: "130%", opacity: [0, 0.85, 0.6, 0] } : { opacity: 0 }}
                transition={{ duration: 1.3, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
