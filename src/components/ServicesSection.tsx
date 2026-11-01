import React from 'react';
import { 
  Compass, 
  Building2, 
  Cpu, 
  ClipboardCheck, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';
import { SERVICES } from '../data/portfolioData.ts';

export const ServicesSection: React.FC = () => {
  const getIcon = (name: string) => {
    switch (name) {
      case 'Compass': return <Compass className="w-5 h-5 text-[#9B2C78]" />;
      case 'Building2': return <Building2 className="w-5 h-5 text-[#9B2C78]" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-[#9B2C78]" />;
      case 'ClipboardCheck': return <ClipboardCheck className="w-5 h-5 text-[#9B2C78]" />;
      case 'ShieldCheck': return <ShieldCheck className="w-5 h-5 text-[#9B2C78]" />;
      case 'Layers': return <Layers className="w-5 h-5 text-[#9B2C78]" />;
      default: return <Building2 className="w-5 h-5 text-[#9B2C78]" />;
    }
  };

  return (
    <section id="services" className="py-20 bg-[#EDF2F8] border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold text-[#9B2C78] uppercase tracking-wider block mb-2">
            Our Services
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#16254C] tracking-tight">
            Comprehensive Consultancy Solutions
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            From preliminary feasibility and concept design to structural calculations, authority permits, and on-site supervision.
          </p>
        </div>

        {/* Clean, Decent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((service) => (
            <div
              key={service.id}
              className="group p-6 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-[#16254C]/30 hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center mb-5 shadow-2xs group-hover:scale-105 group-hover:border-[#9B2C78]/30 group-hover:bg-white transition-all duration-300 ease-out">
                  {getIcon(service.iconName)}
                </div>

                <h3 className="text-base font-bold text-[#16254C] mb-1 group-hover:text-[#9B2C78] transition-colors duration-200">
                  {service.title}
                </h3>
                <span className="text-xs text-slate-400 font-['Tajawal',sans-serif] block mb-3" dir="rtl">
                  {service.arabicTitle}
                </span>

                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {service.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
