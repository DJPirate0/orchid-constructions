import React from 'react';
import { ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-b from-[#F4F7FB] via-[#EDF2F8] to-[#E4ECF4]/60 pt-12 pb-16 sm:pt-20 sm:pb-24 md:pt-28 md:pb-32 border-b border-slate-200/80 overflow-hidden">
      {/* Subtle blueprint grid line */}
      <div className="absolute inset-0 bg-blueprint-grid opacity-40 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-block text-xs font-semibold text-[#9B2C78] uppercase tracking-wider mb-3 sm:mb-4">
            Engineering Consultants · UAE
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#16254C] tracking-tight leading-[1.2] sm:leading-[1.15] mb-4 sm:mb-6">
            Designing Spaces, <br className="hidden sm:inline" />
            Engineering Built Excellence.
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed mb-6 sm:mb-8">
            Orchid Constructions L.L.C is an architectural and engineering consultancy practice. We deliver comprehensive structural design, architecture, MEP systems, and municipal authority approvals for commercial, industrial, and residential projects across the UAE.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <a
              href="#projects"
              className="group inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 text-sm sm:text-xs font-semibold text-white bg-[#16254C] hover:bg-[#223970] rounded-lg sm:rounded shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              <span>Explore Projects</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
            </a>

            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 text-sm sm:text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-300/80 rounded-lg sm:rounded transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95 shadow-2xs hover:shadow-xs"
            >
              <span>Get in Touch</span>
            </a>
          </div>
        </div>

        {/* Quiet, clean proof metrics row with soft white cards */}
        <div className="mt-12 pt-8 sm:mt-20 sm:pt-10 border-t border-slate-300/70 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="p-3.5 sm:p-4 bg-white/70 backdrop-blur-2xs rounded-xl sm:rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#16254C] transition-colors duration-200">250+</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-tight">Completed Projects</div>
          </div>
          <div className="p-3.5 sm:p-4 bg-white/70 backdrop-blur-2xs rounded-xl sm:rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#16254C] transition-colors duration-200">30+</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-tight">Years UAE Experience</div>
          </div>
          <div className="p-3.5 sm:p-4 bg-white/70 backdrop-blur-2xs rounded-xl sm:rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#16254C] transition-colors duration-200">4.5M+</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-tight">Sq.Ft Designed</div>
          </div>
          <div className="p-3.5 sm:p-4 bg-white/70 backdrop-blur-2xs rounded-xl sm:rounded-lg border border-slate-200/80 shadow-2xs transition-all duration-300 ease-out hover:bg-white hover:shadow-xs hover:-translate-y-0.5">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-[#16254C] transition-colors duration-200">100%</div>
            <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1 leading-tight">Authority Approvals</div>
          </div>
        </div>
      </div>
    </section>
  );
};
