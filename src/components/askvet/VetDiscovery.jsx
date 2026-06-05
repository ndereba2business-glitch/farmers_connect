import React, { useEffect, useState } from "react";

import {
  SlidersHorizontal,
  Search,
  ChevronDown,
} from "lucide-react";

import { DataService } from "../../api/dataService";

import BookAppointment from "./BookAppointment";

const KENYA_COUNTIES = [
  "All Counties",
  "Nairobi",
  "Kiambu",
  "Nakuru",
  "Kisumu",
  "Mombasa",
  "Uasin Gishu",
  "Meru",
  "Machakos",
];

const SPECIALIZATIONS = [
  "All Specializations",
  "Disease Diagnosis",
  "Vaccination",
  "Nutrition",
  "Egg Production",
  "Chick Mortality",
  "Broiler Growth",
];

export default function VetDiscovery() {
  const [vets, setVets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [county, setCounty] =
    useState("All Counties");

  const [specialization, setSpecialization] =
    useState("All Specializations");

  const [selectedVet, setSelectedVet] =
    useState(null);

  // LOAD VETS
  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await DataService.getVets();

        setVets(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // FILTERS
  const filtered = vets.filter((vet) => {
    const matchesSearch =
      vet.full_name
        ?.toLowerCase()
        .includes(search.toLowerCase());

    const matchesCounty =
      county === "All Counties" ||
      vet.county === county;

    const matchesSpecialization =
      specialization ===
        "All Specializations" ||
      vet.specializations?.includes(
        specialization
      );

    return (
      matchesSearch &&
      matchesCounty &&
      matchesSpecialization
    );
  });

  if (loading) {
    return (
      <div className="text-[#64748b] p-5">
        Loading vets...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      
      {/* SEARCH */}
      <div className="flex gap-3">
        
        <div className="flex-1 relative">
          <Search
            className="
              absolute
              left-5
              top-1/2
              -translate-y-1/2
              w-5
              h-5
              text-[#64748b]
            "
          />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search vets by name..."
            className="
              w-full
              h-[56px]
              rounded-[18px]
              border
              border-[#e5e7eb]
              bg-white
              pl-14
              pr-4
              text-[15px]
              outline-none
            "
          />
        </div>

        <button
          className="
            w-[56px]
            h-[56px]
            rounded-[18px]
            bg-[#1f8b4c]
            text-white
            flex
            items-center
            justify-center
          "
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        
        <div className="relative">
          <select
            value={county}
            onChange={(e) =>
              setCounty(e.target.value)
            }
            className="
              w-full
              h-[56px]
              rounded-[18px]
              border
              border-[#e5e7eb]
              bg-white
              px-5
              appearance-none
              outline-none
            "
          >
            {KENYA_COUNTIES.map((c) => (
              <option
                key={c}
                value={c}
              >
                {c}
              </option>
            ))}
          </select>

          <ChevronDown
            className="
              absolute
              right-4
              top-1/2
              -translate-y-1/2
              w-5
              h-5
              text-[#9ca3af]
            "
          />
        </div>

        <div className="relative">
          <select
            value={specialization}
            onChange={(e) =>
              setSpecialization(
                e.target.value
              )
            }
            className="
              w-full
              h-[56px]
              rounded-[18px]
              border
              border-[#e5e7eb]
              bg-white
              px-5
              appearance-none
              outline-none
            "
          >
            {SPECIALIZATIONS.map((s) => (
              <option
                key={s}
                value={s}
              >
                {s}
              </option>
            ))}
          </select>

          <ChevronDown
            className="
              absolute
              right-4
              top-1/2
              -translate-y-1/2
              w-5
              h-5
              text-[#9ca3af]
            "
          />
        </div>
      </div>

      {/* RESULTS */}
      {filtered.length === 0 ? (
        <div
          className="
            bg-white
            border
            border-[#e5e7eb]
            rounded-[24px]
            p-10
            text-center
          "
        >
          <h3 className="text-[18px] font-semibold text-[#64748b]">
            No verified vets found
          </h3>

          <p className="text-[#94a3b8] mt-2">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((vet) => (
            <div
              key={vet.id}
              className="
                bg-white
                border
                border-[#e5e7eb]
                rounded-[22px]
                p-5
              "
            >
              <div className="flex items-start justify-between">
                
                <div>
                  <h3 className="font-semibold text-[18px] text-[#1f2937]">
                    {vet.full_name}
                  </h3>

                  <p className="text-[#64748b] text-sm mt-1">
                    {vet.county}
                  </p>

                  <p className="text-[#94a3b8] text-sm mt-2">
                    {(vet.specializations || []).join(
                      ", "
                    )}
                  </p>
                </div>

                {vet.verified && (
                  <div
                    className="
                      px-3 py-1 rounded-full
                      bg-green-100
                      text-green-700
                      text-xs
                      font-medium
                    "
                  >
                    Verified
                  </div>
                )}
              </div>

              <button
                onClick={() =>
                  setSelectedVet(vet)
                }
                className="
                  mt-5
                  h-[46px]
                  px-5
                  rounded-[14px]
                  bg-[#1f8b4c]
                  text-white
                  font-medium
                "
              >
                Book Appointment
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {selectedVet && (
        <div className="mt-5">
          <BookAppointment
            vet={selectedVet}
            onClose={() =>
              setSelectedVet(null)
            }
          />
        </div>
      )}
    </div>
  );
}