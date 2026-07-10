// Patient vitals — wire types mirrored from the backend vital-reading
// module (READ-ONLY reference: src/modules/vital-reading/**).
//
//   GET  /api/v1/patients/{id}/vitals  → { vitals: { readings, totalCount } }
//        (mirrors listPatientVitalsResponseSchema / VitalReadingView)
//   POST /api/v1/patients/{id}/vitals  → { reading: { vitalReadingId, … } }
//        (body mirrors recordVitalReadingSchema)
//
// Enums mirror vital-reading.schemas.ts exactly. Read-side fields that the
// server could evolve are widened/optional defensively; label helpers fall
// back to the raw value rather than fabricating anything.

/** Mirrors vitalTypeSchema. */
export type VitalType =
  | 'BLOOD_PRESSURE'
  | 'HEART_RATE'
  | 'TEMPERATURE'
  | 'BLOOD_GLUCOSE'
  | 'WEIGHT'
  | 'HEIGHT'
  | 'OXYGEN_SATURATION'
  | 'RESPIRATORY_RATE'
  | 'PAIN_SCORE'
  | 'GCS'
  | 'MUAC'
  | 'BMI';

/** Mirrors vitalUnitSchema. */
export type VitalUnit =
  | 'mmHg'
  | 'bpm'
  | 'celsius'
  | 'fahrenheit'
  | 'mg/dL'
  | 'mmol/L'
  | 'kg'
  | 'lb'
  | 'cm'
  | 'in'
  | '%'
  | 'breaths/min'
  | 'score'
  | 'kg/m2';

/** Mirrors vitalSourceSchema. */
export type VitalSource = 'PATIENT' | 'CLINICAL_STAFF' | 'DEVICE';

/** Mirrors vitalStatusSchema. */
export type VitalStatus = 'RECORDED' | 'AMENDED' | 'OBSERVED_OUT_OF_RANGE';

/** One reading on the wire — mirrors VitalReadingView (the route's output
 *  schema guarantees the core fields; the rest are optional defensively). */
export interface VitalReadingView {
  vitalReadingId: string;
  patientId?: string;
  /** VitalType on the wire; widened so an unknown future type still renders. */
  vitalType: string;
  valueQuantity: number;
  /** BP diastolic limb; null for every other vital type. */
  valueSecondary?: number | null;
  /** VitalUnit on the wire; widened defensively. */
  unit: string;
  source?: string;
  status?: string;
  /** ISO timestamp — the moment the measurement was taken. */
  effectiveAt: string;
  /** ISO timestamp — the moment the row was saved. */
  recordedAt?: string;
  notes?: string | null;
}

/** GET payload after the client unwraps the { data: … } envelope. */
export interface VitalsListPayload {
  vitals?: {
    readings?: VitalReadingView[];
    /** Total matching rows BEFORE limit/offset. */
    totalCount?: number;
  };
}

/** POST body — mirrors recordVitalReadingSchema. The app always records as
 *  the signed-in patient, so `source` is pinned to 'PATIENT' (the backend
 *  rejects anything else for the PATIENT role). */
export interface RecordVitalBody {
  vitalType: VitalType;
  valueQuantity: number;
  /** Required (and only allowed) for BLOOD_PRESSURE. */
  valueSecondary?: number;
  unit: VitalUnit;
  source: VitalSource;
  /** ISO timestamp; the route coerces to Date. */
  effectiveAt: string;
  notes?: string;
}

/** POST payload after envelope unwrap — mirrors
 *  { reading: RecordVitalReadingResult } (fields defensive). */
export interface RecordVitalResponse {
  reading?: {
    vitalReadingId?: string;
  };
}
