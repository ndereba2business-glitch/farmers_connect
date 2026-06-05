import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [activeTab, setActiveTab] = useState("list");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [form, setForm] = useState({
    name: "",
    category: "",
    county: "",
    contact: "",
    verified: false
  });

  // -----------------------------
  // FETCH SUPPLIERS
  // -----------------------------
  async function fetchSuppliers() {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setSuppliers(data || []);
  }

  // -----------------------------
  // REALTIME
  // -----------------------------
  useEffect(() => {
    fetchSuppliers();

    const channel = supabase
      .channel("suppliers-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "suppliers"
        },
        () => {
          fetchSuppliers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -----------------------------
  // ADD SUPPLIER
  // -----------------------------
  async function handleAddSupplier() {
    if (
      !form.name ||
      !form.category ||
      !form.county ||
      !form.contact
    ) {
      alert("Please fill all fields");
      return;
    }

    const { error } = await supabase
      .from("suppliers")
      .insert([
        {
          name: form.name,
          category: form.category,
          county: form.county,
          contact: form.contact,
          verified: form.verified
        }
      ]);

    if (error) {
      console.error(error.message);
      return;
    }

    setForm({
      name: "",
      category: "",
      county: "",
      contact: "",
      verified: false
    });

    setActiveTab("list");

    fetchSuppliers();
  }

  // -----------------------------
  // FILTERED SUPPLIERS
  // -----------------------------
  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.county.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === "All"
        ? true
        : s.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ padding: "20px" }}>
      <h1>Suppliers Marketplace</h1>

      {/* TABS */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px"
        }}
      >
        <button onClick={() => setActiveTab("list")}>
          View Suppliers
        </button>

        <button onClick={() => setActiveTab("add")}>
          Add Supplier
        </button>
      </div>

      {/* SUPPLIERS LIST */}
      {activeTab === "list" && (
        <div>
          {/* SEARCH + FILTER */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "20px",
              flexWrap: "wrap"
            }}
          >
            <input
              placeholder="Search supplier or county..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            <select
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value)
              }
            >
              <option>All</option>
              <option>Feeds</option>
              <option>Hatchery</option>
              <option>Medicine</option>
            </select>
          </div>

          {filteredSuppliers.length === 0 ? (
            <p>No suppliers found.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "15px"
              }}
            >
              {filteredSuppliers.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "10px",
                    padding: "15px"
                  }}
                >
                  <h3>
                    {s.name}{" "}
                    {s.verified && (
                      <span style={{ color: "green" }}>
                        ✔ Verified
                      </span>
                    )}
                  </h3>

                  <p>
                    <b>Category:</b> {s.category}
                  </p>

                  <p>
                    <b>County:</b> {s.county}
                  </p>

                  <p>
                    <b>Contact:</b> {s.contact}
                  </p>

                  <button>
                    Contact Supplier
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD SUPPLIER */}
      {activeTab === "add" && (
        <div>
          <h3>Add Supplier</h3>

          <input
            placeholder="Supplier Name"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value
              })
            }
          />

          <br /><br />

          <select
            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value
              })
            }
          >
            <option value="">
              Select Category
            </option>

            <option value="Feeds">
              Feeds
            </option>

            <option value="Hatchery">
              Hatchery
            </option>

            <option value="Medicine">
              Medicine
            </option>
          </select>

          <br /><br />

          <input
            placeholder="County"
            value={form.county}
            onChange={(e) =>
              setForm({
                ...form,
                county: e.target.value
              })
            }
          />

          <br /><br />

          <input
            placeholder="Contact"
            value={form.contact}
            onChange={(e) =>
              setForm({
                ...form,
                contact: e.target.value
              })
            }
          />

          <br /><br />

          <label>
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) =>
                setForm({
                  ...form,
                  verified: e.target.checked
                })
              }
            />

            {" "}Verified Supplier
          </label>

          <br /><br />

          <button onClick={handleAddSupplier}>
            Save Supplier
          </button>
        </div>
      )}
    </div>
  );
}