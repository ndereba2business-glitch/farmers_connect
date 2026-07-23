import {
  LayoutDashboard, CalendarClock, Siren, Users, FileText,
  Pill, Syringe, Bug, MessageSquare, CalendarDays,
  Wallet, BarChart3, UserCog, Settings
} from "lucide-react";

// Single source of truth for vet sidebar nav.
// Add a route here + a page in src/vet/pages/ and it shows up automatically.
export const VET_NAV = [
  { name: "Dashboard", path: "/vet/dashboard", icon: LayoutDashboard },
  { name: "Appointments", path: "/vet/appointments", icon: CalendarClock },
  { name: "Emergency Requests", path: "/vet/emergency", icon: Siren },
  { name: "My Farmers", path: "/vet/farmers", icon: Users },
  { name: "Medical Records", path: "/vet/records", icon: FileText },
  { name: "Prescriptions", path: "/vet/prescriptions", icon: Pill },
  { name: "Vaccination Programs", path: "/vet/vaccinations", icon: Syringe },
  { name: "Disease Reports", path: "/vet/disease-reports", icon: Bug },
  { name: "Messages", path: "/vet/messages", icon: MessageSquare },
  { name: "Calendar", path: "/vet/calendar", icon: CalendarDays },
  { name: "Payments & Earnings", path: "/vet/payments", icon: Wallet },
  { name: "Analytics", path: "/vet/analytics", icon: BarChart3 },
  { name: "Profile & Availability", path: "/vet/profile", icon: UserCog },
  { name: "Settings", path: "/vet/settings", icon: Settings },
];