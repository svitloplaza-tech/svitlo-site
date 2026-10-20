"use client";
import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { initHome } from "./home/scenes";
import "./home/home.css";

export default function HomeScenes({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => initHome(ref.current, Lenis), []);
  return <div className="home" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
