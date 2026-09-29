export type FcmErrorClassification = {
  firebaseStatus: string;
  detailErrorCode: string;
  permanentInvalid: boolean;
  transient: boolean;
};

export type ParsedFcmResponse = FcmErrorClassification & {
  ok: boolean;
  status: number;
};

const PERMANENT_TOKEN_ERRORS = new Set([
  "UNREGISTERED",
  "REGISTRATION_TOKEN_NOT_REGISTERED",
  "REGISTRATION-TOKEN-NOT-REGISTERED",
]);

const TRANSIENT_FIREBASE_ERRORS = new Set([
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
  "UNAVAILABLE",
]);

export function classifyFcmError(httpStatus: number, responseBody: string): FcmErrorClassification {
  let firebaseStatus = "";
  let detailErrorCode = "";

  try {
    const payload = JSON.parse(responseBody);
    firebaseStatus = typeof payload?.error?.status === "string" ? payload.error.status : "";

    const details = Array.isArray(payload?.error?.details) ? payload.error.details : [];
    const detail = details.find((item: unknown) => {
      if (!item || typeof item !== "object") return false;
      return typeof (item as { errorCode?: unknown }).errorCode === "string";
    }) as { errorCode?: string } | undefined;
    detailErrorCode = detail?.errorCode || "";
  } catch {
    // An unreadable response must never be treated as a permanent token failure.
  }

  const normalizedDetailCode = detailErrorCode.trim().toUpperCase();
  const normalizedStatus = firebaseStatus.trim().toUpperCase();
  const hasPermanentTokenDetail = PERMANENT_TOKEN_ERRORS.has(normalizedDetailCode);

  return {
    firebaseStatus,
    detailErrorCode,
    permanentInvalid: httpStatus === 404 && normalizedStatus === "NOT_FOUND" && hasPermanentTokenDetail,
    transient: httpStatus === 429 || httpStatus >= 500 ||
      TRANSIENT_FIREBASE_ERRORS.has(normalizedStatus) ||
      TRANSIENT_FIREBASE_ERRORS.has(normalizedDetailCode),
  };
}

export function parseFcmResponse(ok: boolean, status: number, responseBody: string): ParsedFcmResponse {
  if (ok) {
    return {
      ok: true,
      status,
      firebaseStatus: "",
      detailErrorCode: "",
      permanentInvalid: false,
      transient: false,
    };
  }

  return { ok: false, status, ...classifyFcmError(status, responseBody) };
}

export function networkFcmFailure(): ParsedFcmResponse {
  return {
    ok: false,
    status: 0,
    firebaseStatus: "",
    detailErrorCode: "",
    permanentInvalid: false,
    transient: true,
  };
}
