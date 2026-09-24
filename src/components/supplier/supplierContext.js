import { createContext, useContext } from "react";

export const SupplierContext = createContext(null);

const NOOP = () => {};

// Safe outside the supplier shell: pages render an empty state instead of
// crashing if the provider is missing.
export function useSupplier() {
  return (
    useContext(SupplierContext) || {
      profile: null,
      profileLoading: false,
      profileError: "",
      pendingCount: 0,
      refreshProfile: NOOP,
      retryProfile: NOOP
    }
  );
}
