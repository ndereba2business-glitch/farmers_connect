-- Found via live end-to-end testing: vet_farmer_messages was never added
-- to the supabase_realtime publication, so its Realtime subscription
-- (VetMessagesModal.jsx / FarmerMessagesPanel.jsx) silently fails —
-- confirmed via the websocket handshake response: "Unable to subscribe to
-- changes... table: vet_farmer_messages". Messages still save correctly;
-- they just never push live to an already-open thread, only on reload.
alter publication supabase_realtime add table public.vet_farmer_messages;

-- Same root cause, pre-existing and unrelated to today's work: notifications
-- (src/components/NotificationsBell.jsx, used app-wide including this
-- session's Phase 5 notification features) has the identical missing-
-- publication problem — confirmed via the same websocket handshake
-- failure. Notifications save and appear on next load/refresh; they just
-- never push live to an already-open session.
alter publication supabase_realtime add table public.notifications;
