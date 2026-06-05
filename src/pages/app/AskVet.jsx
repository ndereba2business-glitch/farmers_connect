import React, { useState } from "react";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import VetDiscovery from "@/components/askvet/VetDiscovery";
import AskQuestion from "@/components/askvet/AskQuestion";
import MyAppointments from "@/components/askvet/MyAppointments";
import SupplierDirectory from "@/components/askvet/SupplierDirectory";
import EmergencyButton from "@/components/askvet/EmergencyButton";

import {
  Stethoscope,
  MessageSquare,
  CalendarDays,
  ShoppingBag,
} from "lucide-react";

export default function AskVet() {
  const [activeTab, setActiveTab] = useState("vets");

  return (
    <div className="pb-6">
      {/* ================= HEADER ================= */}

      <div className="mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          
          {/* LEFT */}
          <div>
            <h1 className="text-[42px] font-bold tracking-tight text-[#1f2937] flex items-center gap-3">
              <Stethoscope className="h-9 w-9 text-[#16a34a]" />
              Ask Vet
            </h1>

            <p className="text-[15px] text-[#6b7280] mt-1">
              Connect with verified poultry vets across Kenya
            </p>
          </div>

          {/* RIGHT */}
          <EmergencyButton />
        </div>
      </div>

      {/* ================= TABS ================= */}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        {/* TAB SWITCHER */}

        <TabsList
          className="
            w-full
            grid
            grid-cols-4
            bg-[#f1f3f1]
            rounded-[22px]
            p-1
            h-[58px]
            mb-5
          "
        >
          {/* VETS */}

          <TabsTrigger
            value="vets"
            className="
              rounded-[18px]
              h-full
              text-[15px]
              font-medium
              gap-2
              transition-all

              data-[state=active]:bg-white
              data-[state=active]:shadow-sm
              data-[state=active]:text-[#1f2937]
            "
          >
            <Stethoscope className="h-4 w-4" />
            Vets
          </TabsTrigger>

          {/* ASK */}

          <TabsTrigger
            value="ask"
            className="
              rounded-[18px]
              h-full
              text-[15px]
              font-medium
              gap-2
              transition-all

              data-[state=active]:bg-white
              data-[state=active]:shadow-sm
              data-[state=active]:text-[#1f2937]
            "
          >
            <MessageSquare className="h-4 w-4" />
            Ask
          </TabsTrigger>

          {/* BOOKINGS */}

          <TabsTrigger
            value="appointments"
            className="
              rounded-[18px]
              h-full
              text-[15px]
              font-medium
              gap-2
              transition-all

              data-[state=active]:bg-white
              data-[state=active]:shadow-sm
              data-[state=active]:text-[#1f2937]
            "
          >
            <CalendarDays className="h-4 w-4" />
            Bookings
          </TabsTrigger>

          {/* SUPPLIERS */}

          <TabsTrigger
            value="suppliers"
            className="
              rounded-[18px]
              h-full
              text-[15px]
              font-medium
              gap-2
              transition-all

              data-[state=active]:bg-white
              data-[state=active]:shadow-sm
              data-[state=active]:text-[#1f2937]
            "
          >
            <ShoppingBag className="h-4 w-4" />
            Suppliers
          </TabsTrigger>
        </TabsList>

        {/* ================= CONTENT ================= */}

        <TabsContent
          value="vets"
          className="mt-0"
        >
          <VetDiscovery />
        </TabsContent>

        <TabsContent
          value="ask"
          className="mt-0"
        >
          <AskQuestion />
        </TabsContent>

        <TabsContent
          value="appointments"
          className="mt-0"
        >
          <MyAppointments />
        </TabsContent>

        <TabsContent
          value="suppliers"
          className="mt-0"
        >
          <SupplierDirectory />
        </TabsContent>
      </Tabs>
    </div>
  );
}