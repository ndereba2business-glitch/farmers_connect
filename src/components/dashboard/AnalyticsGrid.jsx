import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function AnalyticsGrid({ chartData, stats }) {
  return (
    <div className="space-y-6">
      {/* Metrics Row - Auto-adjusts structure from 1 to 4 columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</span>
            <span className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Chart Section Container */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">Market Price Analytics</h3>
        
        {/* Aspect ratio control keeps charts stable across screen resolutions */}
        <div className="w-full h-64 sm:h-80 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
              {/* Hide Y-axis on narrow phone viewports to maximize line visibility */}
              <YAxis hide={window.innerWidth < 480} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip />
              <Area type="monotone" dataKey="price" stroke="#059669" fillOpacity={0.1} fill="#10B981" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}