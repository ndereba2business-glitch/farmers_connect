// In-app ordering (cart -> order request -> supplier confirms) is hidden for
// the MVP: farmers contact suppliers by phone/WhatsApp and negotiate. The
// database side (orders, place_order) is kept, so switching this back on
// only brings the UI back.
export const IN_APP_ORDERING = false;
