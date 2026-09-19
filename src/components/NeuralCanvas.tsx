'use client';

import { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Node extends Point {
  vx: number;
  vy: number;
  radius: number;
  originalVx: number;
  originalVy: number;
}

interface Pulse {
  startNode: Node;
  endNode: Node;
  progress: number;
  speed: number;
}

export default function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let mouse: Point = { x: -1000, y: -1000 };

    const MAX_CONNECTION_DIST = 200;
    const MOUSE_REPULSION_DIST = 250;
    const MOUSE_REPULSION_FORCE = 0.05;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      ctx.scale(dpr, dpr);
      initNodes(width, height);
    };

    const initNodes = (width: number, height: number) => {
      nodes = [];
      pulses = [];
      const isMobile = width < 768;
      const nodeCount = isMobile ? 35 : 100;

      for (let i = 0; i < nodeCount; i++) {
        const vx = (Math.random() - 0.5) * 0.8;
        const vy = (Math.random() - 0.5) * 0.8;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: vx,
          vy: vy,
          originalVx: vx,
          originalVy: vy,
          radius: Math.random() * 1.5 + 1,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const drawNode = (node: Node) => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    };

    const drawPulse = (pulse: Pulse) => {
      const currentX = pulse.startNode.x + (pulse.endNode.x - pulse.startNode.x) * pulse.progress;
      const currentY = pulse.startNode.y + (pulse.endNode.y - pulse.startNode.y) * pulse.progress;

      ctx.beginPath();
      ctx.arc(currentX, currentY, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.9)'; // Indigo pulse color
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(99, 102, 241, 1)';
      ctx.fill();
      ctx.shadowBlur = 0; // Reset shadow
    };

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Dark background matching the hero section overlay
      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, width, height);

      // Update and draw connections
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Magnetic repulsion from mouse
        const dxMouse = node.x - mouse.x;
        const dyMouse = node.y - mouse.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

        if (distMouse < MOUSE_REPULSION_DIST) {
          const angle = Math.atan2(dyMouse, dxMouse);
          const force = (MOUSE_REPULSION_DIST - distMouse) / MOUSE_REPULSION_DIST;
          node.vx += Math.cos(angle) * force * MOUSE_REPULSION_FORCE;
          node.vy += Math.sin(angle) * force * MOUSE_REPULSION_FORCE;
        } else {
          // Gently return to original velocity
          node.vx += (node.originalVx - node.vx) * 0.02;
          node.vy += (node.originalVy - node.vy) * 0.02;
        }

        // Apply velocity
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x <= 0 || node.x >= width) {
          node.vx *= -1;
          node.originalVx *= -1;
          node.x = Math.max(0, Math.min(node.x, width));
        }
        if (node.y <= 0 || node.y >= height) {
          node.vy *= -1;
          node.originalVy *= -1;
          node.y = Math.max(0, Math.min(node.y, height));
        }

        drawNode(node);

        // Check connections
        for (let j = i + 1; j < nodes.length; j++) {
          const otherNode = nodes[j];
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MAX_CONNECTION_DIST) {
            // Opacity is higher when nodes are closer
            const opacity = 1 - (dist / MAX_CONNECTION_DIST);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.stroke();

            // Randomly spawn a pulse along this connection
            if (Math.random() < 0.0002) {
              pulses.push({
                startNode: Math.random() > 0.5 ? node : otherNode,
                endNode: Math.random() > 0.5 ? otherNode : node,
                progress: 0,
                speed: 0.005 + Math.random() * 0.015,
              });
            }
          }
        }
      }

      // Update and draw pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        pulse.progress += pulse.speed;
        
        if (pulse.progress >= 1) {
          pulses.splice(i, 1);
        } else {
          drawPulse(pulse);
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    resizeCanvas();
    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block"
      style={{
        willChange: 'transform',
        pointerEvents: 'auto',
      }}
    />
  );
}
