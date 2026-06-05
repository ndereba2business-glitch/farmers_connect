import React, { useEffect, useState } from "react";

const KENYA_COUNTIES = [
  "Nairobi",
  "Kiambu",
  "Nakuru",
  "Kisumu",
  "Mombasa",
  "Uasin Gishu",
  "Machakos",
  "Nyeri",
  "Murang'a",
  "Meru",
  "Embu",
  "Kericho",
  "Kajiado",
  "Bungoma",
  "Kakamega",
  "Busia",
];

export default function Profile() {

  const [profile, setProfile] = useState({
    fullName: "",
    county: "",
    poultryType: "",
    farmSize: "",
    phone: "",
  });

  const [saved, setSaved] = useState(false);

  // LOAD PROFILE
  useEffect(() => {
    const stored =
      localStorage.getItem("fc_profile");

    if (stored) {
      setProfile(JSON.parse(stored));
    }
  }, []);

  // HANDLE CHANGE
  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  // SAVE PROFILE
  const handleSave = (e) => {
    e.preventDefault();

    localStorage.setItem(
      "fc_profile",
      JSON.stringify(profile)
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-3xl p-8 text-white">

        <h1 className="text-4xl font-bold">
          Farmer Profile
        </h1>

        <p className="mt-3 text-green-50">
          Manage your farm information and account settings
        </p>

      </div>

      {/* PROFILE FORM */}
      <div className="bg-white rounded-3xl border shadow-sm p-8">

        <form
          onSubmit={handleSave}
          className="space-y-6"
        >

          {/* FULL NAME */}
          <div>

            <label className="block text-sm font-medium mb-2">
              Full Name
            </label>

            <input
              type="text"
              name="fullName"
              value={profile.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full border rounded-xl p-3"
            />

          </div>

          {/* PHONE */}
          <div>

            <label className="block text-sm font-medium mb-2">
              Phone Number
            </label>

            <input
              type="text"
              name="phone"
              value={profile.phone}
              onChange={handleChange}
              placeholder="+254..."
              className="w-full border rounded-xl p-3"
            />

          </div>

          {/* COUNTY */}
          <div>

            <label className="block text-sm font-medium mb-2">
              County
            </label>

            <select
              name="county"
              value={profile.county}
              onChange={handleChange}
              className="w-full border rounded-xl p-3"
            >

              <option value="">
                Select County
              </option>

              {KENYA_COUNTIES.map((county) => (
                <option
                  key={county}
                  value={county}
                >
                  {county}
                </option>
              ))}

            </select>

          </div>

          {/* POULTRY TYPE */}
          <div>

            <label className="block text-sm font-medium mb-2">
              Poultry Type
            </label>

            <select
              name="poultryType"
              value={profile.poultryType}
              onChange={handleChange}
              className="w-full border rounded-xl p-3"
            >

              <option value="">
                Select Poultry Type
              </option>

              <option value="Layers">
                Layers
              </option>

              <option value="Broilers">
                Broilers
              </option>

              <option value="Kienyeji">
                Kienyeji
              </option>

              <option value="Mixed">
                Mixed Farming
              </option>

            </select>

          </div>

          {/* FARM SIZE */}
          <div>

            <label className="block text-sm font-medium mb-2">
              Farm Size
            </label>

            <input
              type="text"
              name="farmSize"
              value={profile.farmSize}
              onChange={handleChange}
              placeholder="e.g 500 birds"
              className="w-full border rounded-xl p-3"
            />

          </div>

          {/* SAVE BUTTON */}
          <div className="flex items-center gap-4">

            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 transition"
            >
              Save Profile
            </button>

            {saved && (
              <p className="text-green-600 text-sm">
                Profile saved successfully
              </p>
            )}

          </div>

        </form>

      </div>

    </div>
  );
}