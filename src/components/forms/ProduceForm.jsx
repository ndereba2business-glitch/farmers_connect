import React from 'react';

export default function ProduceForm({ onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
      <h3 className="text-base font-bold text-slate-900">List New Produce</h3>
      
      {/* Form Fields - Single column on mobile, switches to two columns on tablet up */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="cropName" className="text-xs font-semibold text-slate-600">Crop Category</label>
          <input 
            id="cropName"
            type="text" 
            placeholder="e.g. Organic Tomatoes" 
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label htmlFor="pricePoint" className="text-xs font-semibold text-slate-600">Price Metric per Unit ($)</label>
          <input 
            id="pricePoint"
            type="number" 
            placeholder="0.00" 
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          />
        </div>
      </div>

      <button 
        type="submit" 
        className="w-full sm:w-auto sm:float-right px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors min-h-[44px] flex items-center justify-center"
      >
        Publish Crop Listing
      </button>
    </form>
  );
}import React from 'react';

export default function ProduceForm({ onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
      <h3 className="text-base font-bold text-slate-900">List New Produce</h3>
      
      {/* Form Fields - Single column on mobile, switches to two columns on tablet up */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="cropName" className="text-xs font-semibold text-slate-600">Crop Category</label>
          <input 
            id="cropName"
            type="text" 
            placeholder="e.g. Organic Tomatoes" 
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          />
        </div>

        <div className="flex flex-col space-y-1.5">
          <label htmlFor="pricePoint" className="text-xs font-semibold text-slate-600">Price Metric per Unit ($)</label>
          <input 
            id="pricePoint"
            type="number" 
            placeholder="0.00" 
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          />
        </div>
      </div>

      <button 
        type="submit" 
        className="w-full sm:w-auto sm:float-right px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-colors min-h-[44px] flex items-center justify-center"
      >
        Publish Crop Listing
      </button>
    </form>
  );
}