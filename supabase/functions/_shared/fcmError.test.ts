import assert from "node:assert/strict";
import test from "node:test";
import { networkFcmFailure, parseFcmResponse } from "./fcmError.ts";

function firebaseError(status: string, detailErrorCode?: string) {
  return JSON.stringify({
    error: {
      status,
      details: detailErrorCode ? [{ errorCode: detailErrorCode }] : [],
    },
  });
}

test("404 NOT_FOUND with UNREGISTERED is permanently invalid", () => {
  const result = parseFcmResponse(false, 404, firebaseError("NOT_FOUND", "UNREGISTERED"));
  assert.equal(result.firebaseStatus, "NOT_FOUND");
  assert.equal(result.detailErrorCode, "UNREGISTERED");
  assert.equal(result.permanentInvalid, true);
  assert.equal(result.transient, false);
});

test("404 NOT_FOUND without detail is not permanently invalid", () => {
  const result = parseFcmResponse(false, 404, firebaseError("NOT_FOUND"));
  assert.equal(result.permanentInvalid, false);
});

test("400 INVALID_ARGUMENT is not permanently invalid", () => {
  const result = parseFcmResponse(false, 400, firebaseError("INVALID_ARGUMENT", "UNREGISTERED"));
  assert.equal(result.permanentInvalid, false);
});

test("429 RESOURCE_EXHAUSTED is transient", () => {
  const result = parseFcmResponse(false, 429, firebaseError("RESOURCE_EXHAUSTED"));
  assert.equal(result.permanentInvalid, false);
  assert.equal(result.transient, true);
});

test("500 INTERNAL is transient", () => {
  const result = parseFcmResponse(false, 500, firebaseError("INTERNAL"));
  assert.equal(result.permanentInvalid, false);
  assert.equal(result.transient, true);
});

test("503 UNAVAILABLE is transient", () => {
  const result = parseFcmResponse(false, 503, firebaseError("UNAVAILABLE"));
  assert.equal(result.permanentInvalid, false);
  assert.equal(result.transient, true);
});

test("network failure is transient and never permanently invalid", () => {
  const result = networkFcmFailure();
  assert.equal(result.permanentInvalid, false);
  assert.equal(result.transient, true);
});

test("successful response keeps existing success semantics", () => {
  const result = parseFcmResponse(true, 200, JSON.stringify({ name: "projects/example/messages/1" }));
  assert.equal(result.ok, true);
  assert.equal(result.permanentInvalid, false);
  assert.equal(result.transient, false);
});
