import { describe, it, expect } from "vitest";
import { buildZipServicesUrl } from "./serviceGuide";

describe("buildZipServicesUrl", () => {
  it("appends /services?zip= to a bare base URL", () => {
    expect(buildZipServicesUrl("https://guide.example.org", "78702")).toBe(
      "https://guide.example.org/services?zip=78702",
    );
  });

  it("does not double the slash when the base ends with one or more", () => {
    expect(buildZipServicesUrl("https://guide.example.org/", "78702")).toBe(
      "https://guide.example.org/services?zip=78702",
    );
    expect(buildZipServicesUrl("https://guide.example.org///", "78702")).toBe(
      "https://guide.example.org/services?zip=78702",
    );
  });

  it("keeps a path prefix on the base URL", () => {
    expect(buildZipServicesUrl("https://example.org/guide/", "78702")).toBe(
      "https://example.org/guide/services?zip=78702",
    );
  });

  it("encodes the ZIP value", () => {
    expect(buildZipServicesUrl("https://guide.example.org", "78 7&2")).toBe(
      "https://guide.example.org/services?zip=78%207%262",
    );
  });
});
