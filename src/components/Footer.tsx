import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#101B37] text-slate-300 border-t border-slate-800/80 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 sm:gap-8 text-center md:text-left">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/orchid_logo_icon.png"
              alt="Orchid Constructions L.L.C"
              className="h-10 w-10 object-contain rounded-md shrink-0 shadow-sm"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-tight block">
                ORCHID CONSTRUCTIONS L.L.C
              </span>
              <span className="text-[11px] font-semibold text-[#e091cb] font-['Tajawal',sans-serif]" dir="rtl">
                أوركيد للإنشاءات ذ.م.م
              </span>
            </div>
          </div>

          {/* Clean Navigation Links */}
          <div className="flex items-center justify-center gap-y-3 gap-x-6 flex-wrap text-xs font-medium text-slate-400">
            <a href="#about" className="py-1 px-1 hover:text-white transition-all duration-200 ease-out hover:-translate-y-0.5">About</a>
            <a href="#services" className="py-1 px-1 hover:text-white transition-all duration-200 ease-out hover:-translate-y-0.5">Services</a>
            <a href="#projects" className="py-1 px-1 hover:text-white transition-all duration-200 ease-out hover:-translate-y-0.5">Projects</a>
            <a href="#contact" className="py-1 px-1 hover:text-white transition-all duration-200 ease-out hover:-translate-y-0.5">Contact</a>
          </div>

          {/* Copyright */}
          <div className="text-xs text-slate-500">
            © 2015 Orchid Constructions L.L.C. Abu Dhabi, U.A.E.
          </div>
        </div>
      </div>
    </footer>
  );
};
