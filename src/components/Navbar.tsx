import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo.tsx';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Services', href: '#services' },
    { label: 'Projects', href: '#projects' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4 sm:gap-8">
        {/* Brand */}
        <a href="#" className="flex items-center shrink-0 min-w-0">
          <BrandLogo />
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative py-1 hover:text-[#16254C] transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#9B2C78] hover:after:w-full after:transition-all after:duration-300"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="px-5 py-2 text-xs font-semibold text-white bg-[#16254C] hover:bg-[#20366b] rounded shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
          >
            Contact Us
          </a>
        </nav>

        {/* Mobile Menu Button - Accessible 44px touch target */}
        <div className="md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-lg text-slate-700 hover:text-[#16254C] hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 px-3 text-base font-medium text-slate-800 hover:text-[#16254C] hover:bg-slate-50 rounded-lg transition-colors"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2">
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center w-full min-h-[44px] py-3 px-4 text-sm font-semibold text-white bg-[#16254C] hover:bg-[#20366b] rounded-lg transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
