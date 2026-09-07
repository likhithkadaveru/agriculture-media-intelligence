import { describe, expect, it } from "vitest";
import { isPropertyListing } from "@/intelligence/relevance";

/*
 * Titles taken verbatim from live accepted mentions. The two groups matter
 * equally: the listings are noise an officer must never be shown, and the
 * enforcement stories are precisely what the system exists to surface. A
 * filter keyed on the word "sale" would delete both, so both are asserted.
 */
const LISTINGS = [
  "Land for sale in telangana zaheerabad 1 Acer agriculture land for sale",
  "1 Acre Agriculture Land For Sale in Telangana | Near Highway | Zaheerabad",
  "10 Acres Agricultural Land for Sale in Vikarabad, Telangana | ₹15 Lakhs",
  "Near Gajwel ||5 Guntas Agriculture land for sale #youtube #commercial",
  "Open plots in Yadadri Bhuvanagiri venture near ORR",
  "హైదరాబాద్ దగ్గర వెంచర్‌లో ప్లాట్లు గజాల చొప్పున",
];

const REAL_COVERAGE = [
  // Fake fertiliser sellers exposed, seven arrested — "విక్రయ" appears here.
  "నకిలీఎరువుల విక్రయదారుల గుట్టురట్టు ఏడుగురు అరెస్టు, పరారీలో",
  // Cases to be filed if DAP is sold above the notified price.
  "ఎరువుల దందాపై ఉక్కుపాదం. అధిక ధరలకు డీఏపీ విక్రయిస్తే కేసులు",
  "వికారాబాద్‌లో నకిలీ DAP ఎరువుల దందా బట్టబయలు..! 43 బస్తాలు స్వాధీనం",
  "Tenant Farmers Must Be Given Identity Cards : Venkat Reddy",
  "Good News for Farmers : Centre Launches New Fertilizer Booking App",
  "రైతుల భరోసాకు సమగ్ర విత్తన చట్టం: మంత్రి తుమ్మల నాగేశ్వరరావు",
  // Land IS the subject here, but it is policy, not an offer.
  "Land acquisition for irrigation project protested by farmers in Khammam",
  "పంట భూమి సర్వే నంబర్ల నమోదులో జాప్యంపై రైతుల ఆందోళన",
];

describe("property listing filter", () => {
  it.each(LISTINGS)("rejects a listing: %s", (title) => {
    expect(isPropertyListing("", title)).toBe(true);
  });

  it.each(REAL_COVERAGE)("keeps real coverage: %s", (title) => {
    expect(isPropertyListing("", title)).toBe(false);
  });

  it("does not treat the word sale on its own as a listing", () => {
    // Sale without land, and land without an offer, must both survive.
    expect(isPropertyListing("", "Seed sale begins at cooperative societies")).toBe(false);
    expect(isPropertyListing("", "Farmers lose land to floods in Bhadradri")).toBe(false);
  });
});
