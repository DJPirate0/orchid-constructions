import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, Check } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 bg-gradient-to-b from-[#F3F6FA] via-[#EDF2F8] to-[#E5ECF5]/60 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-semibold text-[#9B2C78] uppercase tracking-wider block mb-2">
            Contact
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#16254C] tracking-tight">
            Get in Touch
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Have a project in mind or need engineering consultation? Contact our Dubai office directly.
          </p>
        </div>

        {/* Simple & Decent 2-Column Contact Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Simple Contact Details Card */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
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
                <div>
                  <span className="font-semibold block text-[#16254C]">Address:</span>
                  <span>Building 28, Ahmed Bin Banduq Al Qamzi Street, Al Danah, Abu Dhabi, U.A.E.</span>
                </div>
              </div>


              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#9B2C78] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[#16254C]">Email:</span>
                  <a href="mailto:info@orchidconstructions.ae" className="hover:text-[#9B2C78] transition-colors">
                    info@orchidconstructions.ae
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#9B2C78] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[#16254C]">Office Hours:</span>
                  <span>Monday – Friday: 8:00 AM – 6:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Simple, Decent Contact Form */}
          <div className="lg:col-span-7 bg-white rounded-lg p-6 sm:p-8 border border-slate-200">
            {submitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-[#16254C]">Message Sent</h4>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto">
                  Thank you for reaching out. A representative from Orchid Constructions L.L.C will respond promptly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: '', email: '', phone: '', message: '' });
                  }}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-base font-bold text-[#16254C] mb-2">
                  Send an Inquiry
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Tariq Mansoor"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded transition-all duration-200 ease-out focus:outline-none focus:border-[#16254C] focus:ring-2 focus:ring-[#16254C]/10 hover:border-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@company.com"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded transition-all duration-200 ease-out focus:outline-none focus:border-[#16254C] focus:ring-2 focus:ring-[#16254C]/10 hover:border-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+971 50 123 4567"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded transition-all duration-200 ease-out focus:outline-none focus:border-[#16254C] focus:ring-2 focus:ring-[#16254C]/10 hover:border-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Briefly describe your project or inquiry..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded transition-all duration-200 ease-out focus:outline-none focus:border-[#16254C] focus:ring-2 focus:ring-[#16254C]/10 hover:border-slate-400"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="group inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-[#16254C] hover:bg-[#223970] rounded shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95 cursor-pointer"
                  >
                    <span>Send Message</span>
                    <Send className="w-3.5 h-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
