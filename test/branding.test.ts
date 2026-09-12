import assert from "node:assert/strict";
import { test } from "node:test";
import { BrandingSchema, isSafeColor, readBranding } from "../src/config/branding.ts";
import { validate } from "../src/validation/jsonschema.ts";

test("readBranding applies defaults, env overrides and colour validation", () => {
  const d = readBranding({}, { productName: "Doc" });
  assert.equal(d.productName, "Doc");
  assert.equal(d.poweredBy, true);
  assert.equal(d.docsUrl, "/api/v1/docs");
  const b = readBranding({
    BRAND_PRODUCT_NAME: "Acme Docs",
    BRAND_PRIMARY_COLOR: "#ff0000",
    BRAND_ACCENT_COLOR: "javascript:alert(1)",
    BRAND_POWERED_BY: "0",
    BRAND_LOGO_URL: "/branding/logo.svg",
  });
  assert.equal(b.productName, "Acme Docs");
  assert.equal(b.primaryColor, "#ff0000");
  assert.equal(b.accentColor, "", "invalid colour ignored");
  assert.equal(b.poweredBy, false);
  assert.equal(validate(b, BrandingSchema as unknown as Record<string, unknown>).errors.length, 0);
});

test("colour grammar rejects CSS injection and accepts real colours", () => {
  for (const ok of [
    "#abc",
    "#00b563",
    "#00b563ff",
    "rgb(1, 2, 3)",
    "rgba(1 2 3 / 0.5)",
    "hsl(210, 40%, 50%)",
    "rebeccapurple",
  ])
    assert.equal(isSafeColor(ok), true, ok);
  for (const bad of [
    "rgb(1) } body { display:none } :root { --x:(",
    "url(javascript:alert(1))",
    "#zzz",
    "hsl(a,b,c)",
    "red; color: blue",
    "<script>",
    "",
  ])
    assert.equal(isSafeColor(bad), false, bad);
});
