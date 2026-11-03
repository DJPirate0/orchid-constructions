export interface Service {
  id: string;
  title: string;
  arabicTitle: string;
  description: string;
  iconName: string;
}

export interface Project {
  id: string;
  title: string;
  arabicTitle: string;
  category: 'commercial' | 'industrial' | 'residential';
  categoryLabel: string;
  location: string;
  year: string;
  area: string;
  description: string;
  image: string;
}

export const SERVICES: Service[] = [
  {
    id: 'architecture',
    title: 'Architectural Design',
    arabicTitle: 'التصميم المعماري',
    description: 'Contemporary architectural design and spatial planning harmonizing aesthetics, function, and sustainable building guidelines.',
    iconName: 'Compass'
  },
  {
    id: 'structural',
    title: 'Structural Engineering',
    arabicTitle: 'الهندسة الإنشائية',
    description: 'Comprehensive structural analysis, concrete framing, post-tensioned slabs, and foundation designs strictly adhering to Dubai Building Codes.',
    iconName: 'Building2'
  },
  {
    id: 'mep',
    title: 'MEP Engineering',
    arabicTitle: 'الهندسة الكهروميكانيكية',
    description: 'Integrated mechanical, electrical, plumbing, and fire safety systems engineered for energy efficiency and DEWA compliance.',
    iconName: 'Cpu'
  },
  {
    id: 'project-management',
    title: 'Project Management & Supervision',
    arabicTitle: 'إدارة المشاريع والإشراف',
    description: 'Diligent site supervision, quality control, contractor coordination, and schedule management throughout the construction lifecycle.',
    iconName: 'ClipboardCheck'
  },
  {
    id: 'authority-approvals',
    title: 'Authority Approvals & Permitting',
    arabicTitle: 'اعتمادات الدوائر والبلدية',
    description: 'Seamless statutory permit acquisition across Dubai Municipality, Dubai Civil Defence, DEWA, Trakhees, and DDA.',
    iconName: 'ShieldCheck'
  },
  {
    id: 'interior-design',
    title: 'Interior Design & Fit-Out',
    arabicTitle: 'التصميم الداخلي والديكور',
    description: 'Modern commercial, retail, and luxury residential interior design optimizing volume, lighting, and premium material palettes.',
    iconName: 'Layers'
  }
];

export const PROJECTS: Project[] = [
  {
    id: 'industrial-hub',
    title: 'Industrial Logistics & Storage Hub',
    arabicTitle: 'مجمع صناعي ولوجستي للتخزين',
    category: 'industrial',
    categoryLabel: 'Industrial',
    location: 'Dubai South (DWC), Dubai',
    year: '2025',
    area: '185,000 Sq.Ft',
    description: 'Complete architectural and structural engineering for a high-capacity logistics warehouse facility featuring 42m clear spans and heavy-duty slabs.',
    image: 'from-slate-900 via-slate-800 to-[#16254C]'
  },
  {
    id: 'business-tower',
    title: 'Commercial Corporate Tower',
    arabicTitle: 'برج تجاري وإداري',
    category: 'commercial',
    categoryLabel: 'Commercial',
    location: 'Business Bay, Dubai',
    year: '2024',
    area: '320,000 Sq.Ft',
    description: 'Multi-storey commercial development engineered with column-free post-tensioned plates and high-performance energy-saving glazed facades.',
    image: 'from-[#16254C] via-[#1a2d5e] to-slate-900'
  },
  {
    id: 'luxury-villa',
    title: 'Contemporary Luxury Villa',
    arabicTitle: 'فيلا سكنية فاخرة',
    category: 'residential',
    categoryLabel: 'Residential',
    location: 'Jumeirah, Dubai',
    year: '2025',
    area: '24,500 Sq.Ft',
    description: 'Bespoke modern residence showcasing striking fair-faced architectural concrete, cantilevered volumes, and expansive floor-to-ceiling glass.',
    image: 'from-slate-900 via-[#23356e] to-[#121c38]'
  },
  {
    id: 'cold-chain-facility',
    title: 'Al Qusais Logistic & Distribution Depot',
    arabicTitle: 'مستودع القصيص للخدمات اللوجستية والتوزيع',
    category: 'industrial',
    categoryLabel: 'Industrial',
    location: 'Al Qusais, Dubai',
    year: '2024',
    area: '94,000 Sq.Ft',
    description: 'Specialized temperature-controlled engineering facility designed for efficient logistics distribution and rapid municipal authority clearance.',
    image: 'from-[#0e172a] via-[#16254C] to-slate-800'
  },
  {
    id: 'commercial-plaza',
    title: 'Al Barsha Commercial Centre',
    arabicTitle: 'مجمع البرشاء التجاري',
    category: 'commercial',
    categoryLabel: 'Commercial',
    location: 'Al Barsha, Dubai',
    year: '2024',
    area: '168,000 Sq.Ft',
    description: 'Modern two-storey retail and corporate center engineered with wide waffle slabs, rooftop open dining, and basement parking.',
    image: 'from-slate-950 via-[#182852] to-[#11192e]'
  },
  {
    id: 'specialized-facility',
    title: 'Specialized Equipment Complex',
    arabicTitle: 'مجمع المعدات المتخصصة',
    category: 'industrial',
    categoryLabel: 'Industrial',
    location: 'Dubai Industrial City, Dubai',
    year: '2023',
    area: '142,000 Sq.Ft',
    description: 'Heavy structural steel industrial plant designed with 20-ton overhead crane runways and specialized equipment foundation pads.',
    image: 'from-[#121c38] via-slate-900 to-[#16254C]'
  }
];
