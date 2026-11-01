import React from 'react';

interface BrandLogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  showSubtitle = true
}) => {
  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Standalone Logo Icon */}
      <img
        src="/assets/aistudio/orchid_logo_icon.png"
        alt="Orchid Constructions L.L.C"
        className="h-10 w-10 sm:h-11 sm:w-11 object-contain rounded-md shrink-0 shadow-2xs"
        referrerPolicy="no-referrer"
      />

      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-bold text-[#16254C] tracking-tight uppercase">
            ORCHID CONSTRUCTIONS <span className="text-[#9B2C78]">L.L.C</span>
          </span>
          <span
            dir="rtl"
            className="hidden md:inline-block text-xs font-semibold text-[#16254C]/80 font-['Tajawal',sans-serif]"
          >
            أوركيد للإنشاءات ذ.م.م
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[11px] text-slate-500 font-medium">
            Engineering & Architectural Consultants · Dubai
          </span>
        )}
      </div>
    </div>
  );
};
