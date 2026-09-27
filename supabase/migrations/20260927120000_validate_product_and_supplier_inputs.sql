-- Phase 7: validate inputs in the database, not only in the forms.
--
-- The supplier forms already validate everything, but the Supabase API is
-- public: anyone signed in can send requests without using the forms (and
-- the older farmer listing form checks very little). These constraints
-- mirror the forms' rules so bad data is rejected wherever it comes from.
-- All existing rows were checked against them before this migration.

alter table public.products
  add constraint products_price_valid
    check (price > 0 and price <= 10000000),
  add constraint products_stock_valid
    check (stock is null or stock between 0 and 10000000),
  add constraint products_name_valid
    check (char_length(trim(product_name)) between 1 and 120),
  add constraint products_description_len
    check (description is null or char_length(description) <= 2000),
  add constraint products_category_valid
    check (category in ('chickens', 'eggs', 'feeds', 'equipment', 'medicine', 'other')),
  add constraint products_unit_valid
    check (unit is null or unit in ('per_bird', 'per_tray', 'per_kg', 'per_bag', 'per_piece', 'per_lot')),
  add constraint products_place_len
    check ((county is null or char_length(county) <= 60)
       and (location_details is null or char_length(location_details) <= 120)),
  add constraint products_seller_phone_len
    check (seller_phone is null or char_length(seller_phone) <= 20);

alter table public.supplier_profiles
  add constraint supplier_profiles_business_name_valid
    check (business_name is null or char_length(trim(business_name)) between 1 and 100),
  add constraint supplier_profiles_description_len
    check (description is null or char_length(description) <= 1000),
  add constraint supplier_profiles_contact_len
    check ((phone is null or char_length(phone) <= 20)
       and (whatsapp_number is null or char_length(whatsapp_number) <= 20)
       and (county is null or char_length(county) <= 60));
