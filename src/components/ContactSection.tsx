import React from 'react';
import { Mail, MapPin, Clock } from 'lucide-react';

export const ContactSection: React.FC = () => {
  return (
    <section id="contact" className="py-14 sm:py-20 bg-gradient-to-b from-[#F3F6FA] via-[#EDF2F8] to-[#E5ECF5]/60 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-8 sm:mb-12">
          <span className="text-xs font-semibold text-[#9B2C78] uppercase tracking-wider block mb-2">
            Contact
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#16254C] tracking-tight">
            Get in Touch
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
            Have a project in mind or need engineering consultation? Contact our office directly.
          </p>
        </div>

        {/* Contact Details Card */}
        <div className="max-w-2xl bg-white rounded-xl p-5 sm:p-8 border border-slate-200/90 shadow-xs space-y-5 sm:space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#16254C]">
              Orchid Constructions L.L.C
            </h3>
            <span className="text-xs text-slate-500 font-['Tajawal',sans-serif] block mt-0.5" dir="rtl">
              أوركيد للإنشاءات ذ.م.م
            </span>
            <p className="text-xs text-slate-500 mt-2">
              Engineering & Architectural Consultants
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200 text-xs sm:text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#9B2C78] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-semibold block text-[#16254C] mb-0.5">Address:</span>
                <span className="text-slate-600">Building 28, Ahmed Bin Banduq Al Qamzi Street, Al Danah, Abu Dhabi, U.A.E.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#9B2C78] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-semibold block text-[#16254C] mb-0.5">Email:</span>
                <a
                  href="https://mail.google.com/mail/?view=cm&fs=1&to=info@orchidconstructions.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 hover:text-[#9B2C78] transition-colors py-0.5 inline-block"
                >
                  info@orchidconstructions.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-[#9B2C78] shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-semibold block text-[#16254C] mb-0.5">Office Hours:</span>
                <span className="text-slate-600">Monday – Friday: 8:00 AM – 6:00 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
