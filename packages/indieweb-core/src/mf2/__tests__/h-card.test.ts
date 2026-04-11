import { describe, it, expect } from "vitest";
import { buildHCard } from "../h-card.js";

describe("buildHCard", () => {
  it("returns h-card as rootClassName", () => {
    const result = buildHCard({});
    expect(result.rootClassName).toBe("h-card");
  });

  it("maps name to p-name", () => {
    const result = buildHCard({ name: "Courtney Robertson" });
    expect(result.properties.name).toEqual({
      className: "p-name",
      value: "Courtney Robertson",
    });
  });

  it("maps givenName to p-given-name", () => {
    const result = buildHCard({ givenName: "Courtney" });
    expect(result.properties.givenName).toEqual({
      className: "p-given-name",
      value: "Courtney",
    });
  });

  it("maps familyName to p-family-name", () => {
    const result = buildHCard({ familyName: "Robertson" });
    expect(result.properties.familyName).toEqual({
      className: "p-family-name",
      value: "Robertson",
    });
  });

  it("maps honorificPrefix and honorificSuffix", () => {
    const result = buildHCard({
      honorificPrefix: "Dr.",
      honorificSuffix: "Ph.D",
    });
    expect(result.properties.honorificPrefix?.className).toBe(
      "p-honorific-prefix",
    );
    expect(result.properties.honorificSuffix?.className).toBe(
      "p-honorific-suffix",
    );
  });

  it("maps nickname to p-nickname", () => {
    const result = buildHCard({ nickname: "courtneyr_dev" });
    expect(result.properties.nickname).toEqual({
      className: "p-nickname",
      value: "courtneyr_dev",
    });
  });

  it("maps url to u-url with href attribute", () => {
    const result = buildHCard({ url: "https://courtneyr.dev" });
    expect(result.properties.url).toEqual({
      className: "u-url",
      value: "https://courtneyr.dev",
      attributes: { href: "https://courtneyr.dev" },
    });
  });

  it("maps photo to u-photo with src attribute", () => {
    const result = buildHCard({ photo: "https://courtneyr.dev/photo.jpg" });
    expect(result.properties.photo).toEqual({
      className: "u-photo",
      value: "https://courtneyr.dev/photo.jpg",
      attributes: { src: "https://courtneyr.dev/photo.jpg" },
    });
  });

  it("maps logo to u-logo with src attribute", () => {
    const result = buildHCard({ logo: "https://example.com/logo.svg" });
    expect(result.properties.logo).toEqual({
      className: "u-logo",
      value: "https://example.com/logo.svg",
      attributes: { src: "https://example.com/logo.svg" },
    });
  });

  it("maps email to u-email with mailto href", () => {
    const result = buildHCard({ email: "hello@example.com" });
    expect(result.properties.email).toEqual({
      className: "u-email",
      value: "hello@example.com",
      attributes: { href: "mailto:hello@example.com" },
    });
  });

  it("preserves existing mailto: prefix on email", () => {
    const result = buildHCard({ email: "mailto:hello@example.com" });
    expect(result.properties.email?.attributes?.href).toBe(
      "mailto:hello@example.com",
    );
  });

  it("maps note to p-note", () => {
    const result = buildHCard({ note: "IndieWeb enthusiast" });
    expect(result.properties.note).toEqual({
      className: "p-note",
      value: "IndieWeb enthusiast",
    });
  });

  it("maps org to p-org", () => {
    const result = buildHCard({ org: "Open Source Together" });
    expect(result.properties.org).toEqual({
      className: "p-org",
      value: "Open Source Together",
    });
  });

  it("maps jobTitle to p-job-title", () => {
    const result = buildHCard({ jobTitle: "Developer Advocate" });
    expect(result.properties.jobTitle).toEqual({
      className: "p-job-title",
      value: "Developer Advocate",
    });
  });

  it("maps address fields to their mf2 classes", () => {
    const result = buildHCard({
      locality: "Portland",
      region: "OR",
      postalCode: "97201",
      countryName: "US",
      streetAddress: "123 Main St",
    });
    expect(result.properties.locality).toEqual({
      className: "p-locality",
      value: "Portland",
    });
    expect(result.properties.region).toEqual({
      className: "p-region",
      value: "OR",
    });
    expect(result.properties.postalCode).toEqual({
      className: "p-postal-code",
      value: "97201",
    });
    expect(result.properties.countryName).toEqual({
      className: "p-country-name",
      value: "US",
    });
    expect(result.properties.streetAddress).toEqual({
      className: "p-street-address",
      value: "123 Main St",
    });
  });

  it("maps tel to p-tel", () => {
    const result = buildHCard({ tel: "+1-503-555-0100" });
    expect(result.properties.tel).toEqual({
      className: "p-tel",
      value: "+1-503-555-0100",
    });
  });

  it("maps geo coordinates to p-latitude and p-longitude", () => {
    const result = buildHCard({
      latitude: "45.5152",
      longitude: "-122.6784",
    });
    expect(result.properties.latitude).toEqual({
      className: "p-latitude",
      value: "45.5152",
    });
    expect(result.properties.longitude).toEqual({
      className: "p-longitude",
      value: "-122.6784",
    });
  });

  it("maps categories to p-category array", () => {
    const result = buildHCard({ category: ["indieweb", "wordpress"] });
    expect(result.properties.category).toEqual([
      { className: "p-category", value: "indieweb" },
      { className: "p-category", value: "wordpress" },
    ]);
  });

  it("omits category when array is empty", () => {
    const result = buildHCard({ category: [] });
    expect(result.properties.category).toBeUndefined();
  });

  it("omits undefined properties from output", () => {
    const result = buildHCard({ name: "Only Name" });
    expect(result.properties.url).toBeUndefined();
    expect(result.properties.photo).toBeUndefined();
    expect(result.properties.email).toBeUndefined();
    expect(result.properties.org).toBeUndefined();
    expect(result.properties.locality).toBeUndefined();
  });

  it("handles a complete h-card with all fields", () => {
    const result = buildHCard({
      name: "Courtney Robertson",
      givenName: "Courtney",
      familyName: "Robertson",
      nickname: "courtneyr_dev",
      url: "https://courtneyr.dev",
      photo: "https://courtneyr.dev/photo.jpg",
      email: "hello@courtneyr.dev",
      note: "IndieWeb builder",
      org: "Open Source Together",
      jobTitle: "Developer Advocate",
      locality: "Portland",
      region: "OR",
      countryName: "US",
      category: ["indieweb"],
    });

    expect(result.rootClassName).toBe("h-card");
    expect(Object.keys(result.properties)).toHaveLength(14);
  });
});
