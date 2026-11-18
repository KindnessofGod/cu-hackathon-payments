"use client";
// A glass voice orb drawn with WebGL: ribbons of colour flow inside a sphere, with a bright rim,
// an inner glow and a highlight. It swells and flows faster with the voice level (0..1).
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type OrbMode = "idle" | "connecting" | "listening" | "speaking";

const PALETTES: Record<OrbMode, [string, string, string, string]> = {
  idle: ["#0b4f3e", "#1a9a84", "#8ef0d2", "#e2f8b8"],
  connecting: ["#3d5a52", "#7f9e94", "#cfe3dc", "#f1f7f4"],
  speaking: ["#06493a", "#11a88f", "#7cf0d8", "#d9f7a0"],
  listening: ["#103e8f", "#2a8fe0", "#8ce9ff", "#d8fff4"],
};

const vertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uLevel;
uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;

// 3D simplex-style value noise
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return v;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float edge = 1.0 - smoothstep(0.975, 1.0, r);
  if (edge <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = normalize(vec3(p, z));
  float t = uTime * (0.35 + uLevel * 0.9);

  // Silk: smooth folded ribbons of light that drift through the glass.
  vec3 q = n * 1.25;
  q.xy += 0.35 * vec2(sin(t * 0.7 + q.y * 2.0), cos(t * 0.6 + q.x * 2.0));
  float w1 = sin(q.x * 2.6 + t + 1.6 * sin(q.y * 1.9 - t * 0.6));
  float w2 = sin(q.y * 2.9 - t * 0.8 + 1.6 * sin(q.z * 2.3 + t * 0.5));
  float w3 = sin(q.z * 2.4 + t * 0.55 + 1.6 * sin(q.x * 2.1 + t * 0.9));
  float f = (w1 + w2 + w3) / 3.0;
  float silk = pow(0.5 + 0.5 * sin(f * 5.5 + t * 0.8 + uLevel * 2.0), 3.0);
  float silk2 = pow(0.5 + 0.5 * sin(f * 3.2 - t * 0.6 + 1.7), 4.0);

  // Soft vertical light inside the ball.
  vec3 col = mix(uC1, uC2, smoothstep(-0.9, 0.7, p.y + 0.35 * f));
  col = mix(col, uC3, silk * 0.85);
  col = mix(col, uC4, silk2 * 0.7);
  col += vec3(1.0) * pow(silk, 6.0) * 0.35;
  // Translucent body: lighter where the glass is thin.
  col = mix(col, mix(uC3, vec3(1.0), 0.6), (1.0 - z) * 0.35);
  // Glass rim, inner glow and highlights.
  float fres = pow(1.0 - z, 3.0);
  col = mix(col, vec3(1.0), fres * 0.6);
  col += uC3 * 0.25 * smoothstep(0.8, 0.0, r) * (0.4 + uLevel);
  col += vec3(1.0) * smoothstep(0.5, 0.0, length((p - vec2(-0.3, 0.45)) * vec2(1.0, 1.6))) * 0.38;
  col += vec3(1.0) * smoothstep(0.07, 0.0, length(p - vec2(-0.42, 0.55))) * 0.55;
  col += uC4 * smoothstep(0.35, 0.0, length((p - vec2(0.2, -0.62)) * vec2(1.0, 2.2))) * 0.25;
  gl_FragColor = vec4(col, edge);
}
`;

export function GlassOrb({
  mode = "idle",
  level,
  size = 260,
  className,
}: {
  mode?: OrbMode;
  /** Called every frame; returns the current voice level 0..1. */
  level?: () => number;
  size?: number | string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const levelRef = useRef(level);
  useEffect(() => {
    modeRef.current = mode;
    levelRef.current = level;
  }, [mode, level]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    } catch {
      el.classList.add("glass-orb-fallback");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const col = (h: string) => new THREE.Color(h);
    const start = PALETTES[modeRef.current];
    const uniforms = {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uC1: { value: col(start[0]) },
      uC2: { value: col(start[1]) },
      uC3: { value: col(start[2]) },
      uC4: { value: col(start[3]) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

    const fit = () => {
      const s = el.clientWidth;
      renderer.setSize(s, s, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const target = [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()];
    let smooth = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const lvl = Math.max(0, Math.min(1, levelRef.current?.() ?? (modeRef.current === "speaking" ? 0.35 : 0.1)));
      smooth += (lvl - smooth) * Math.min(1, dt * 8);
      uniforms.uLevel.value = smooth;
      uniforms.uTime.value += reduce ? dt * 0.2 : dt;
      const pal = PALETTES[modeRef.current];
      [uniforms.uC1, uniforms.uC2, uniforms.uC3, uniforms.uC4].forEach((u, i) => {
        target[i].set(pal[i]);
        u.value.lerp(target[i], Math.min(1, dt * 3));
      });
      el.style.setProperty("--orb-level", smooth.toFixed(3));
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className={`glass-orb ${mode} ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="glass-orb-halo" />
      <div className="glass-orb-canvas" ref={box} />
    </div>
  );
}
