import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-b from-[#F4F7FB] via-[#EDF2F8] to-[#E4ECF4]/60 pt-20 pb-24 md:pt-28 md:pb-32 border-b border-slate-200/80 overflow-hidden">
      {/* Subtle blueprint grid line */}
      <div className="absolute inset-0 bg-blueprint-grid opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-block text-xs font-semibold text-[#9B2C78] uppercase tracking-wider mb-4">
            Engineering Consultants · Dubai, UAE
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-[#16254C] tracking-tight leading-[1.15] mb-6">
            Designing Spaces, <br className="hidden sm:inline" />
            Engineering Built Excellence.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8">
            Orchid Constructions L.L.C is an architectural and engineering consultancy practice based in Dubai. We deliver comprehensive structural design, architecture, MEP systems, and municipal authority approvals for commercial, industrial, and residential projects.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#projects"
              className="group inline-flex items-center gap-2 px-6 py-3.5 text-xs font-semibold text-white bg-[#16254C] hover:bg-[#223970] rounded shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              <span>Explore Projects</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </a>

            <a
              href="#contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300/80 rounded transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              <span>Get in Touch</span>
            </a>
          </div>
        </div>

        {/* Quiet, clean proof metrics row with soft white cards */}
        <div className="mt-20 pt-10 border-t border-slate-300/70 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
          <div className="p-4 bg-white/70 backdrop-blur-2xs rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-[#16254C] transition-colors duration-200">250+</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Completed Projects</div>
          </div>
          <div className="p-4 bg-white/70 backdrop-blur-2xs rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-[#16254C] transition-colors duration-200">15+</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Years UAE Experience</div>
          </div>
          <div className="p-4 bg-white/70 backdrop-blur-2xs rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-[#16254C] transition-colors duration-200">4.5M+</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Sq.Ft Designed</div>
          </div>
          <div className="p-4 bg-white/70 backdrop-blur-2xs rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-2xl sm:text-3xl font-bold text-[#16254C] transition-colors duration-200">100%</div>
            <div className="text-xs text-slate-500 font-medium mt-1">Authority Approvals</div>
          </div>
        </div>
      </div>
    </section>
  );
};
