import React from 'react';
 
export const AboutSection: React.FC = () => {
  return (
    <section id="about" className="py-14 sm:py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Heading */}
          <div className="lg:col-span-5">
            <span className="text-xs font-semibold text-[#9B2C78] uppercase tracking-wider block mb-2">
              Who We Are
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#16254C] tracking-tight mb-3 sm:mb-4">
              Civil Engineering Services
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 font-['Tajawal',sans-serif]" dir="rtl">
              أوركيد للإنشاءات ذ.م.م - استشارات هندسية ومعمارية في دولة الإمارات
            </p>
          </div>

          {/* Right Column: Narrative & Values */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-slate-600 text-sm sm:text-base leading-relaxed">
            <p>
              <strong className="text-[#16254C]">Orchid Constructions L.L.C</strong> brings together creative design, structural engineering, and meticulous site supervision to deliver end-to-end consultancy for developers, businesses, and private clients across the UAE.
            </p>
            <p>
              Our multidisciplinary approach ensures that architectural intent, structural integrity, mechanical performance, and authority compliance are resolved harmoniously from day one—avoiding costly revisions and expediting municipal approvals.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 pt-4 sm:pt-6 border-t border-slate-200">
              <div className="p-4 sm:p-4.5 bg-slate-50/80 rounded-xl sm:rounded-lg border border-slate-200/70 shadow-2xs transition-all duration-300 ease-out hover:bg-slate-100/90 hover:shadow-xs hover:-translate-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#16254C] mb-1">
                  Design & Engineering
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Creative architectural concepts underpinned by rigorous structural calculations.
                </p>
              </div>

              <div className="p-4 sm:p-4.5 bg-slate-50/80 rounded-xl sm:rounded-lg border border-slate-200/70 shadow-2xs transition-all duration-300 ease-out hover:bg-slate-100/90 hover:shadow-xs hover:-translate-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#16254C] mb-1">
                  Authority Approvals
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Direct submission and licensing clearance across DM, DCD, Trakhees, and DDA.
                </p>
              </div>

              <div className="p-4 sm:p-4.5 bg-slate-50/80 rounded-xl sm:rounded-lg border border-slate-200/70 shadow-2xs transition-all duration-300 ease-out hover:bg-slate-100/90 hover:shadow-xs hover:-translate-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#16254C] mb-1">
                  Site Supervision
                </h3>
                <p className="text-xs text-slate-500 leading-normal">
                  Independent quality assurance and contractor oversight to project handover.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
