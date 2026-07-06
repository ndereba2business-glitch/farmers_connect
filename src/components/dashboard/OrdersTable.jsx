import React from 'react';

export default function OrdersTable({ data }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-900">Recent Shipments</h3>
      </div>

      {/* Desktop Layout - Visible from Tablet Screen Sizes Upward */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase">
              <th className="p-4">Producer</th>
              <th className="p-4">Produce Variant</th>
              <th className="p-4">Volume</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-medium text-slate-900">{row.farmer}</td>
                <td className="p-4">{row.crop}</td>
                <td className="p-4">{row.quantity}</td>
                <td className="p-4">
                  <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Card Layout - Activates on Smaller Viewports */}
      <div className="block md:hidden divide-y divide-slate-100">
        {data.map((row) => (
          <div key={row.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/30">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-900 text-sm">{row.farmer}</span>
              <span className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">{row.status}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Produce: <strong className="text-slate-700 font-normal">{row.crop}</strong></span>
              <span>Volume: <strong className="text-slate-700 font-normal">{row.quantity}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}