import React, { useState } from 'react';
import { Siren } from 'lucide-react';

export default function EmergencyButton() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleEmergency = () => {
    setLoading(true);

    // simulate urgent request creation
    const emergencyRequest = {
      type: "EMERGENCY",
      timestamp: new Date().toISOString(),
      status: "pending_dispatch",
      priority: "high"
    };

    console.log("Emergency triggered:", emergencyRequest);

    setTimeout(() => {
      setLoading(false);
      setSent(true);

      setTimeout(() => setSent(false), 3000);
    }, 1200);
  };

  return (
    <div>
      <button
        onClick={handleEmergency}
        disabled={loading}
        style={{
          background: sent ? 'green' : 'red',
          color: 'white',
          padding: '10px 14px',
          border: 'none',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer'
        }}
      >
        <Siren size={16} />
        {loading ? "Sending..." : sent ? "Sent!" : "Emergency"}
      </button>

      {sent && (
        <p style={{ color: 'green', marginTop: '8px', fontSize: '12px' }}>
          Emergency request submitted. A vet will be notified.
        </p>
      )}
    </div>
  );
}