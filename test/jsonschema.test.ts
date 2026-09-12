import assert from "node:assert/strict";
import { test } from "node:test";
import { deepEqual, formatErrors, validate } from "../src/validation/jsonschema.ts";

test("validates types, required, enum, bounds, patterns and formats", () => {
  const schema = {
    type: "object",
    required: ["name", "n"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 2, maxLength: 5, pattern: "^[a-z]+$" },
      n: { type: "integer", minimum: 1, maximum: 10 },
      kind: { type: "string", enum: ["a", "b"] },
      id: { type: "string", format: "uuid" },
      tags: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
      when: { type: "string", format: "date-time" },
      nul: { type: "string", nullable: true },
    },
  };
  assert.equal(
    validate(
      {
        name: "abc",
        n: 3,
        kind: "a",
        id: "123e4567-e89b-12d3-a456-426614174000",
        tags: ["x"],
        when: "2026-01-01T00:00:00Z",
        nul: null,
      },
      schema,
    ).errors.length,
    0,
  );
  const bad = validate({ name: "A", n: 11.5, kind: "c", id: "nope", tags: ["x", "x"], extra: 1 }, schema);
  const msgs = formatErrors(bad.errors);
  for (const m of [
    "/name must match",
    "/n expected integer",
    "/kind must be one of",
    "/id must be a valid uuid",
    "/tags items must be unique",
    "/extra is not an allowed property",
  ])
    assert.match(msgs, new RegExp(m.replace(/[/]/g, "\\/")));
  assert.match(formatErrors(validate({}, schema).errors), /\/name is required; \/n is required/);
});

test("coerces query/path strings when asked", () => {
  const r = validate(
    { page: "2", flag: "true", ids: "a,b" },
    {
      type: "object",
      properties: {
        page: { type: "integer" },
        flag: { type: "boolean" },
        ids: { type: "array", items: { type: "string" } },
      },
    },
    { coerce: true },
  );
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.value, { page: 2, flag: true, ids: ["a", "b"] });
});

test("resolves local $ref, allOf/anyOf/oneOf/not", () => {
  const root = {
    components: {
      schemas: { Pet: { type: "object", required: ["name"], properties: { name: { type: "string" } } } },
    },
  };
  const ok = validate({ name: "x" }, { $ref: "#/components/schemas/Pet" }, { root });
  assert.equal(ok.errors.length, 0);
  assert.equal(validate({}, { $ref: "#/components/schemas/Pet" }, { root }).errors.length, 1);
  assert.equal(validate(5, { anyOf: [{ type: "string" }, { type: "number" }] }).errors.length, 0);
  assert.equal(validate(true, { anyOf: [{ type: "string" }, { type: "number" }] }).errors.length, 1);
  assert.equal(validate(5, { oneOf: [{ type: "number" }, { type: "integer" }] }).errors.length, 1);
  assert.equal(validate("s", { not: { type: "number" } }).errors.length, 0);
  assert.equal(validate(1, { allOf: [{ type: "number" }, { minimum: 2 }] }).errors.length, 1);
  assert.throws(() => validate(1, { $ref: "#/nope" }, { root }), /Unresolvable/);
});

test("deepEqual and nested arrays", () => {
  assert.ok(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }));
  assert.ok(!deepEqual({ a: 1 }, { a: 2 }));
  const r = validate(
    { rows: [{ v: "x" }, { v: 2 }] },
    {
      type: "object",
      properties: {
        rows: { type: "array", items: { type: "object", properties: { v: { type: "string" } } } },
      },
    },
  );
  assert.equal(r.errors[0]?.path, "/rows/1/v");
});
