import SupplierDirectory from "../components/SupplierDirectory";

export default function Suppliers() {
  return (
    <div style={{ maxWidth: "1100px" }}>
      <h1 className="fc-page-title">Suppliers</h1>
      <p className="fc-page-sub" style={{ marginBottom: "20px" }}>
        Verified suppliers of feed, chicks, medicine and equipment, and what they list today.
      </p>
      <SupplierDirectory />
    </div>
  );
}
