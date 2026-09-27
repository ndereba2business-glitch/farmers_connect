import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAvailability, validateMinOrder, validatePhone, validatePrice, validatePriceMax, validateStock
} from "../../src/components/supplier/formValidation.js";

test("phone: accepts common Kenyan formats", () => {
  for (const ok of ["0712345678", "0712 345 678", "+254712345678", "254712345678", "0110 870 811"]) {
    assert.equal(validatePhone(ok, { required: true }), "", ok);
  }
});

test("phone: rejects letters, short numbers, and empty when required", () => {
  assert.match(validatePhone("07abc", { required: true }), /digits only/);
  assert.match(validatePhone("0712", { required: true }), /full phone number/);
  assert.match(validatePhone("", { required: true }), /Enter a phone number/);
  assert.equal(validatePhone("", { required: false }), "");
});

test("price: must be a positive amount with at most 2 decimals", () => {
  assert.equal(validatePrice("3200"), "");
  assert.equal(validatePrice("3200.50"), "");
  assert.match(validatePrice(""), /Enter a price/);
  assert.match(validatePrice("0"), /more than 0/);
  assert.match(validatePrice("-5"), /numbers only/);
  assert.match(validatePrice("12.345"), /numbers only/);
  assert.match(validatePrice("99999999"), /too high/);
});

test("price range: optional, but the top must be above the price", () => {
  assert.equal(validatePriceMax("", "3000"), "");
  assert.equal(validatePriceMax("3400", "3000"), "");
  assert.match(validatePriceMax("3000", "3000"), /more than the price/);
  assert.match(validatePriceMax("2000", "3000"), /more than the price/);
  assert.match(validatePriceMax("abc", "3000"), /numbers only/);
});

test("stock and minimum order: whole numbers", () => {
  assert.equal(validateStock(""), "");
  assert.equal(validateStock("40"), "");
  assert.match(validateStock("4.5"), /whole number/);
  assert.equal(validateMinOrder(""), "");
  assert.equal(validateMinOrder("5"), "");
  assert.match(validateMinOrder("0"), /1 or more/);
});

test("availability: blocks contradictions that would mislead farmers", () => {
  assert.equal(validateAvailability({ availability: "in_stock", stock: "", min_order_qty: "" }), "");
  assert.equal(validateAvailability({ availability: "in_stock", stock: "40", min_order_qty: "5" }), "");
  assert.equal(validateAvailability({ availability: "on_order", stock: "0", min_order_qty: "" }), "");
  assert.match(validateAvailability({ availability: "in_stock", stock: "0", min_order_qty: "" }), /0 available/);
  assert.match(validateAvailability({ availability: "out_of_stock", stock: "5", min_order_qty: "" }), /chose Out of stock/);
  assert.match(validateAvailability({ availability: "in_stock", stock: "3", min_order_qty: "5" }), /minimum order/);
});
