export function getVetTrustLevel(vet) {
  if (vet?.verified === true) return "verified";
  return "unverified";
}

export function getSupplierTrustLevel(supplier) {
  if (supplier?.verified === true) return "verified";
  return "unverified";
}