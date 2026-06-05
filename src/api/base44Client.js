// TEMP CLIENT WRAPPER
// Replace with real Base44 SDK connection when available

export const base44 = {
  entities: {
    Veterinarian: {
      async filter() {
        return [];
      }
    },
    Supplier: {
      async list() {
        return [];
      }
    },
    Appointment: {
      async filter() {
        return [];
      },
      async create(data) {
        return data;
      }
    }
  }
};