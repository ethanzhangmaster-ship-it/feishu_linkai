import React from 'react';

interface LoadingSkeletonProps {
  viewMode: string;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ viewMode }) => {
  return (
    <div className="space-y-6 animate-pulse w-full">
      
      {/* Header Area Skeleton Hint */}
      <div className="hidden xl:flex gap-4 justify-between items-end border-b border-slate-200 pb-4 mb-6 opacity-50">
         <div className="bg-slate-200 h-10 w-1/3 rounded-xl"></div>
         <div className="flex gap-2 w-auto">
             <div className="bg-slate-200 h-8 w-32 rounded-lg"></div>
             <div className="bg-slate-200 h-8 w-48 rounded-lg"></div>
         </div>
      </div>

      {/* Fix: logic updated to include 'comparison' which is used in App.tsx instead of 'spend' */}
      {(viewMode === 'rankings' || viewMode === 'comparison') ? (
        <>
          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             {[...Array(5)].map((_, i) => (
               <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 h-24 flex flex-col justify-center space-y-2">
                  <div className="flex justify-between">
                     <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                     <div className="h-4 w-4 bg-slate-100 rounded-full"></div>
                  </div>
                  <div className="h-6 bg-slate-200 rounded w-3/4"></div>
               </div>
             ))}
          </div>
          
          {/* Chart Skeleton */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 h-[400px] flex flex-col space-y-4">
              <div className="flex justify-between items-center mb-2">
                 <div className="h-6 bg-slate-200 rounded w-1/4"></div>
                 <div className="flex gap-2">
                    <div className="h-8 bg-slate-100 rounded w-8"></div>
                    <div className="h-8 bg-slate-100 rounded w-8"></div>
                 </div>
              </div>
              <div className="flex-1 bg-slate-50/50 rounded-lg relative overflow-hidden flex items-end px-4 gap-4 pb-0">
                 {/* Fake Bars */}
                 {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className="bg-slate-200 rounded-t w-full"
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    ></div>
                 ))}
              </div>
          </div>

          {/* Leaderboard/Table Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {[...Array(2)].map((_, i) => (
               <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 h-[300px] space-y-4">
                   <div className="h-5 bg-slate-200 rounded w-1/3 mb-4"></div>
                   <div className="space-y-3">
                      {[...Array(5)].map((_, j) => (
                         <div key={j} className="flex gap-3 items-center">
                            <div className="h-5 w-5 bg-slate-200 rounded-full shrink-0"></div>
                            <div className="h-4 flex-1 bg-slate-100 rounded"></div>
                            <div className="h-4 w-16 bg-slate-200 rounded"></div>
                         </div>
                      ))}
                   </div>
               </div>
             ))}
          </div>
        </>
      ) : (
        <>
          {/* Dashboard Table Skeleton */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             {/* Table Header */}
             <div className="bg-slate-50 border-b border-slate-200 h-10 w-full flex items-center px-4 gap-6">
                 {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-3 bg-slate-300 rounded w-16"></div>
                 ))}
             </div>
             {/* Table Body */}
             <div className="divide-y divide-slate-100">
               {[...Array(12)].map((_, i) => (
                 <div key={i} className="flex items-center px-4 py-3 gap-6">
                    <div className="h-4 bg-slate-200 rounded w-24 shrink-0"></div> {/* Date */}
                    <div className="h-4 bg-blue-50 rounded w-32 shrink-0"></div> {/* App */}
                    <div className="h-4 bg-slate-100 rounded w-16"></div>
                    <div className="h-4 bg-slate-100 rounded w-16"></div>
                    <div className="h-4 bg-slate-100 rounded w-16"></div>
                    <div className="h-4 bg-slate-100 rounded w-16"></div>
                    <div className="flex-1"></div>
                 </div>
               ))}
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoadingSkeleton;