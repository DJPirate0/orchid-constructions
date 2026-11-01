import React, { useState } from 'react';
import { MapPin, Maximize2, X, ArrowUpRight } from 'lucide-react';
import { PROJECTS, Project } from '../data/portfolioData.ts';

export const ProjectsSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const tabs = [
    { id: 'all', label: 'All Projects' },
    { id: 'commercial', label: 'Commercial' },
    { id: 'industrial', label: 'Industrial' },
    { id: 'residential', label: 'Residential' },
  ];

  const filteredProjects = activeTab === 'all'
    ? PROJECTS
    : PROJECTS.filter(p => p.category === activeTab);

  return (
    <section id="projects" className="py-20 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <span className="text-xs font-semibold text-[#9B2C78] uppercase tracking-wider block mb-2">
              Portfolio
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#16254C] tracking-tight">
              Featured Projects
            </h2>
          </div>

          {/* Simple Clean Tabs */}
          <div className="mt-4 md:mt-0 flex items-center gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded transition-all duration-200 ease-out whitespace-nowrap cursor-pointer hover:-translate-y-0.5 active:translate-y-0 ${
                  activeTab === tab.id
                    ? 'bg-[#16254C] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:text-slate-900 border border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="group bg-[#FAFBFD] rounded-xl border border-slate-200/90 overflow-hidden hover:bg-white hover:shadow-xl hover:border-slate-300 transition-all duration-300 ease-out hover:-translate-y-1.5 cursor-pointer flex flex-col justify-between"
            >
              {/* Graphic Architectural Card Banner */}
              <div className={`h-48 bg-gradient-to-br ${project.image} p-5 relative flex flex-col justify-between text-white overflow-hidden`}>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="uppercase tracking-wider">{project.categoryLabel}</span>
                  <span>{project.year}</span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1.5 text-xs text-slate-200">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{project.area}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white/20 group-hover:bg-[#9B2C78] group-hover:scale-110 flex items-center justify-center transition-all duration-300 ease-out shadow-xs">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#9B2C78]" />
                    <span>{project.location}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#16254C] group-hover:text-[#9B2C78] transition-colors duration-200 mb-1">
                    {project.title}
                  </h3>
                  <span className="text-xs text-slate-400 font-['Tajawal',sans-serif] block mb-2" dir="rtl">
                    {project.arabicTitle}
                  </span>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {project.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Simple Project Preview Modal */}
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in">
            <div className="bg-white rounded-lg max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 transform transition-all duration-300 ease-out animate-in zoom-in-95">
              <div className={`p-6 bg-gradient-to-r ${selectedProject.image} text-white flex items-start justify-between`}>
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-300 block mb-1">
                    {selectedProject.categoryLabel} · {selectedProject.location}
                  </span>
                  <h3 className="text-xl font-bold">{selectedProject.title}</h3>
                  <span className="text-xs text-slate-300 font-['Tajawal',sans-serif] block mt-0.5" dir="rtl">
                    {selectedProject.arabicTitle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                <p>{selectedProject.description}</p>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Area</span>
                    <strong className="text-slate-800">{selectedProject.area}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Year Completed</span>
                    <strong className="text-slate-800">{selectedProject.year}</strong>
                  </div>
                </div>

                <div className="pt-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
