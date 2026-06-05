import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';

const MOCK_SUPPLIERS = [
  {
    id: 1,
    name: "Kenya Feed Supplies Ltd",
    category: "Feed",
    location: "Nairobi",
    verified: true
  },
  {
    id: 2,
    name: "East Africa Hatcheries",
    category: "Chicks",
    location: "Kiambu",
    verified: true
  },
  {
    id: 3,
    name: "Poultry Medics Co",
    category: "Medicine",
    location: "Kisumu",
    verified: false
  }
];

export default function SupplierDirectory() {
  const [category, setCategory] = useState("All");

  const filtered = MOCK_SUPPLIERS.filter(s =>
    category === "All" || s.category === category
  );

  return (
    <div style={{ marginTop: '20px' }}>

      <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShoppingBag size={18} />
        Supplier Directory
      </h2>

      {/* FILTER */}
      <div style={{ marginTop: '10px' }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px' }}
        >
          <option value="All">All</option>
          <option value="Feed">Feed</option>
          <option value="Chicks">Chicks</option>
          <option value="Medicine">Medicine</option>
        </select>
      </div>

      {/* LIST */}
      <div style={{ marginTop: '15px' }}>

        {filtered.map(supplier => (
          <div
            key={supplier.id}
            style={{
              border: '1px solid #ddd',
              padding: '12px',
              marginTop: '10px',
              borderRadius: '8px'
            }}
          >

            <h3>
              {supplier.name}{' '}
              {supplier.verified && (
                <span style={{
                  color: 'green',
                  fontSize: '12px',
                  marginLeft: '5px'
                }}>
                  ✔ Verified
                </span>
              )}
            </h3>

            <p>Category: {supplier.category}</p>
            <p>Location: {supplier.location}</p>

            <button
              style={{
                marginTop: '8px',
                padding: '8px 10px',
                background: 'black',
                color: 'white',
                border: 'none',
                borderRadius: '6px'
              }}
            >
              Contact Supplier
            </button>

          </div>
        ))}

      </div>

    </div>
  );
}