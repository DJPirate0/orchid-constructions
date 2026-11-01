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
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Standalone Logo Icon */}
      <img
        src="/assets/aistudio/orchid_logo_icon.png"
        alt="Orchid Constructions L.L.C"
        className="h-9 w-9 sm:h-11 sm:w-11 object-contain rounded-md shrink-0 shadow-2xs"
        referrerPolicy="no-referrer"
      />

      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span className="text-xs sm:text-base font-bold text-[#16254C] tracking-tight uppercase whitespace-nowrap">
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
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
            Engineering & Architectural Consultants · UAE
          </span>
        )}
      </div>
    </div>
  );
};
