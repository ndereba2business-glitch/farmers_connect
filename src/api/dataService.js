import { base44 } from "./base44Client";

/**
 * CENTRAL DATA LAYER
 * All app data flows through here
 */

export const DataService = {

  // VETS
  async getVets() {
    return await base44.entities.Veterinarian.filter({
      status: "verified"
    });
  },

  // SUPPLIERS
  async getSuppliers() {
    return await base44.entities.Supplier?.list?.() || [];
  },

  // APPOINTMENTS (MVP placeholder)
  async getAppointments(userId) {
    return await base44.entities.Appointment?.filter?.({
      user_id: userId
    }) || [];
  },

  // CREATE APPOINTMENT (future backend hook)
  async createAppointment(data) {
    return await base44.entities.Appointment?.create?.(data);
  }
};