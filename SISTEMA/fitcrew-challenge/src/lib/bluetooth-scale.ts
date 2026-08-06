/**
 * Web Bluetooth integration for BLE weight scales.
 *
 * Supports:
 *  - Standard GATT Weight Scale Service (0x181D) — any compliant scale
 *  - Standard GATT Body Composition Service (0x181B) — bioimpedance scales
 *  - Xiaomi Mi Body Composition Scale (MIBFS) and Mi Body Composition Scale 2 (XMTZC05HM)
 *
 * Availability:
 *  - Chromium-based browsers on Android/Desktop: yes
 *  - iOS (all browsers, WebKit): no — `navigator.bluetooth` is undefined
 *  - Firefox: no
 *
 * Callers must render nothing if `isBluetoothScaleSupported()` returns false.
 */

// ---- Constants ------------------------------------------------------------

// Standard BLE services
const WEIGHT_SCALE_SERVICE = 0x181d;
const BODY_COMPOSITION_SERVICE = 0x181b;
const BATTERY_SERVICE = 0x180f;

// Standard characteristics (used as a fallback when the scale exposes them)
const WEIGHT_MEASUREMENT_CHAR = 0x2a9d;
const BODY_COMPOSITION_MEASUREMENT_CHAR = 0x2a9c;

// Xiaomi vendor service exposing the same measurement char that Mi Fit uses
const MI_BODY_COMPOSITION_SERVICE = "0000181b-0000-1000-8000-00805f9b34fb";

// ---- Types ----------------------------------------------------------------

export type ScaleReading = {
  weightKg: number;
  isStabilized: boolean;
  takenAt: string; // ISO
  bodyFatPct?: number;
  musclePct?: number;
  waterPct?: number;
  boneMassKg?: number;
  visceralFat?: number;
  metabolicAge?: number;
  bmi?: number;
};

type BluetoothScaleNavigator = Navigator & {
  bluetooth?: {
    getAvailability?: () => Promise<boolean>;
    requestDevice: (options: unknown) => Promise<BluetoothDeviceLike>;
  };
};

type BluetoothDeviceLike = {
  name?: string | null;
  gatt?: {
    connected: boolean;
    connect: () => Promise<BluetoothRemoteGATTServer>;
    disconnect: () => void;
  };
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type BluetoothRemoteGATTServer = {
  getPrimaryServices: () => Promise<BluetoothRemoteGATTService[]>;
  getPrimaryService: (uuid: number | string) => Promise<BluetoothRemoteGATTService>;
};

type BluetoothRemoteGATTService = {
  uuid: string;
  getCharacteristics: () => Promise<BluetoothRemoteGATTCharacteristic[]>;
};

type BluetoothRemoteGATTCharacteristic = {
  uuid: string;
  properties: { notify: boolean; indicate: boolean; read: boolean };
  startNotifications: () => Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications: () => Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener: (type: "characteristicvaluechanged", cb: (ev: Event) => void) => void;
  removeEventListener: (type: "characteristicvaluechanged", cb: (ev: Event) => void) => void;
  value?: DataView;
};

// ---- Support probing -------------------------------------------------------

export async function isBluetoothScaleSupported(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const bt = (navigator as BluetoothScaleNavigator).bluetooth;
  if (!bt) return false;
  try {
    if (bt.getAvailability) {
      return await bt.getAvailability();
    }
    return true;
  } catch {
    return false;
  }
}

// ---- Connection ------------------------------------------------------------

export async function connectScale(): Promise<BluetoothDeviceLike> {
  const bt = (navigator as BluetoothScaleNavigator).bluetooth;
  if (!bt) throw new Error("Web Bluetooth não disponível neste navegador.");

  const device = await bt.requestDevice({
    filters: [
      { services: [WEIGHT_SCALE_SERVICE] },
      { services: [BODY_COMPOSITION_SERVICE] },
      { namePrefix: "MI SCALE" },
      { namePrefix: "MI_SCALE" },
      { namePrefix: "MIBFS" },
      { namePrefix: "MIBCS" },
    ],
    optionalServices: [
      WEIGHT_SCALE_SERVICE,
      BODY_COMPOSITION_SERVICE,
      BATTERY_SERVICE,
      MI_BODY_COMPOSITION_SERVICE,
    ],
  });

  if (!device.gatt) throw new Error("Dispositivo sem GATT.");
  return device;
}

/**
 * Subscribe to weight/composition notifications from the scale.
 * Returns an unsubscribe function; call it to stop notifications and disconnect.
 */
export async function subscribeToWeight(
  device: BluetoothDeviceLike,
  onReading: (reading: ScaleReading) => void,
  opts?: { heightCm?: number | null; sex?: "male" | "female" | null; ageYears?: number | null },
): Promise<() => void> {
  if (!device.gatt) throw new Error("GATT indisponível.");
  const server = await device.gatt.connect();

  const services = await server.getPrimaryServices();
  const chars: BluetoothRemoteGATTCharacteristic[] = [];
  for (const svc of services) {
    try {
      const svcChars = await svc.getCharacteristics();
      for (const c of svcChars) {
        if (c.properties.notify || c.properties.indicate) chars.push(c);
      }
    } catch {
      // some services throw on getCharacteristics; ignore
    }
  }
  if (chars.length === 0) throw new Error("Balança não expõe leituras compatíveis.");

  const listener = (ev: Event) => {
    const target = ev.target as unknown as BluetoothRemoteGATTCharacteristic;
    const value = target?.value;
    if (!value) return;
    const reading = parseMeasurement(target.uuid, value, opts);
    if (reading) onReading(reading);
  };


  const started: BluetoothRemoteGATTCharacteristic[] = [];
  for (const c of chars) {
    try {
      await c.startNotifications();
      c.addEventListener("characteristicvaluechanged", listener);
      started.push(c);
    } catch {
      // characteristic may reject notifications; skip
    }
  }

  if (started.length === 0) throw new Error("Não foi possível iniciar as notificações da balança.");

  return () => {
    for (const c of started) {
      try {
        c.removeEventListener("characteristicvaluechanged", listener);
        void c.stopNotifications();
      } catch {
        // ignore
      }
    }
    try {
      device.gatt?.disconnect();
    } catch {
      // ignore
    }
  };
}

// ---- Parsers ---------------------------------------------------------------

function parseMeasurement(
  uuid: string,
  value: DataView,
  opts?: { heightCm?: number | null; sex?: "male" | "female" | null; ageYears?: number | null },
): ScaleReading | null {
  const shortUuid = uuid.toLowerCase();

  // GATT Weight Measurement (0x2A9D)
  if (shortUuid.includes("2a9d")) return parseGattWeight(value);
  // GATT Body Composition Measurement (0x2A9C)
  if (shortUuid.includes("2a9c")) return parseGattBodyComposition(value);
  // Xiaomi Mi Body Composition custom characteristic (2a2f in some FW, else vendor)
  return parseXiaomi(value, opts);
}

/**
 * BLE Weight Measurement (org.bluetooth.characteristic.weight_measurement).
 * Byte 0: flags. bit0: 0=SI (kg, 0.005 res), 1=imperial (lb, 0.01 res).
 *                bit1: timestamp present. bit2: user id. bit3: BMI+height.
 * Bytes 1-2: uint16 LE weight raw.
 */
function parseGattWeight(v: DataView): ScaleReading | null {
  if (v.byteLength < 3) return null;
  const flags = v.getUint8(0);
  const si = (flags & 0x01) === 0;
  const raw = v.getUint16(1, true);
  const weightKg = si ? raw * 0.005 : raw * 0.01 * 0.45359237;
  const bmiPresent = (flags & 0x08) !== 0;
  let bmi: number | undefined;
  if (bmiPresent && v.byteLength >= 5) {
    const off = 3 + ((flags & 0x02) !== 0 ? 7 : 0) + ((flags & 0x04) !== 0 ? 1 : 0);
    if (v.byteLength >= off + 2) bmi = v.getUint16(off, true) * 0.1;
  }
  return {
    weightKg: +weightKg.toFixed(2),
    isStabilized: true,
    takenAt: new Date().toISOString(),
    bmi,
  };
}

/**
 * BLE Body Composition Measurement (0x2A9C). Complex payload with flag bits
 * indicating which fields follow. We extract the common ones.
 */
function parseGattBodyComposition(v: DataView): ScaleReading | null {
  if (v.byteLength < 4) return null;
  const flags = v.getUint16(0, true);
  const si = (flags & 0x0001) === 0;
  const bfRaw = v.getUint16(2, true);
  const bodyFatPct = bfRaw === 0xffff ? undefined : bfRaw * 0.1;
  let off = 4;
  if (flags & 0x0002) off += 7; // timestamp
  if (flags & 0x0004) off += 1; // user id
  // basal metabolism (0x0008), muscle % (0x0010), muscle mass (0x0020),
  // fat free mass (0x0040), soft lean mass (0x0080), body water mass (0x0100),
  // impedance (0x0200), weight (0x0400), height (0x0800)
  if (flags & 0x0008) off += 2;
  let musclePct: number | undefined;
  if (flags & 0x0010 && v.byteLength >= off + 2) {
    musclePct = v.getUint16(off, true) * 0.1;
    off += 2;
  }
  if (flags & 0x0020) off += 2;
  if (flags & 0x0040) off += 2;
  if (flags & 0x0080) off += 2;
  let waterPct: number | undefined;
  if (flags & 0x0100 && v.byteLength >= off + 2) {
    waterPct = v.getUint16(off, true) * 0.1;
    off += 2;
  }
  if (flags & 0x0200) off += 2;
  let weightKg: number | undefined;
  if (flags & 0x0400 && v.byteLength >= off + 2) {
    const raw = v.getUint16(off, true);
    weightKg = si ? raw * 0.005 : raw * 0.01 * 0.45359237;
    off += 2;
  }
  if (weightKg == null) return null;
  return {
    weightKg: +weightKg.toFixed(2),
    isStabilized: true,
    takenAt: new Date().toISOString(),
    bodyFatPct: bodyFatPct != null ? +bodyFatPct.toFixed(1) : undefined,
    musclePct: musclePct != null ? +musclePct.toFixed(1) : undefined,
    waterPct: waterPct != null ? +waterPct.toFixed(1) : undefined,
  };
}

/**
 * Xiaomi Mi Body Composition Scale (v1 and v2) proprietary packet.
 * 13 bytes little-endian:
 *   [0]     control byte (bit0=stabilized, bit1=impedance measured, bit2=weight removed, bit5=unit-kg for v1)
 *   [1]     control byte 2 (v2: bit1=stabilized, bit2=impedance measured)
 *   [2..8]  timestamp (year LE, month, day, h, m, s)
 *   [9-10]  impedance (uint16 LE, ohm) — 0 if not measured
 *   [11-12] weight raw (uint16 LE, unit depends on control byte)
 *
 * Weight formula (v2): kg = raw / 200
 * v1 kg unit: kg = raw / 200; lb unit: lb = raw / 100.
 *
 * Bioimpedance metrics are derived from impedance+weight+height+sex+age using
 * Xiaomi's proprietary formulas. We use published community-reverse-engineered
 * approximations that yield values close to the official Mi Fit app.
 */
function parseXiaomi(
  v: DataView,
  opts?: { heightCm?: number | null; sex?: "male" | "female" | null; ageYears?: number | null },
): ScaleReading | null {
  if (v.byteLength < 13) return null;
  const ctrl1 = v.getUint8(0);
  const ctrl2 = v.getUint8(1);
  const weightRemoved = (ctrl1 & 0x80) !== 0;
  const stabilized = (ctrl1 & 0x20) !== 0 || (ctrl2 & 0x02) !== 0;
  const impedanceMeasured = (ctrl1 & 0x02) !== 0 || (ctrl2 & 0x04) !== 0;
  const isKg = (ctrl1 & 0x01) === 0;

  const impedance = v.getUint16(9, true);
  const rawWeight = v.getUint16(11, true);
  if (weightRemoved) return null;

  const weightKg = isKg ? rawWeight / 200 : (rawWeight / 100) * 0.45359237;
  const reading: ScaleReading = {
    weightKg: +weightKg.toFixed(2),
    isStabilized: stabilized,
    takenAt: new Date().toISOString(),
  };

  const height = opts?.heightCm ?? null;
  if (height && height > 0) reading.bmi = +(weightKg / Math.pow(height / 100, 2)).toFixed(1);

  if (stabilized && impedanceMeasured && impedance > 0 && impedance < 3000 && height && opts?.sex && opts?.ageYears) {
    const derived = deriveXiaomiComposition(weightKg, height, opts.ageYears, opts.sex, impedance);
    Object.assign(reading, derived);
  }

  return reading;
}

/**
 * Approximate the Xiaomi Mi Fit formulas for body composition given
 * weight, height, age, sex and impedance. Sources: community reverse
 * engineering (Xiaomi Body Composition Scale — Mi Fit app).
 */
function deriveXiaomiComposition(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: "male" | "female",
  impedance: number,
): Partial<ScaleReading> {
  const isMale = sex === "male";
  // Lean Body Mass (LBM) — Kim/Xiaomi variant
  const lbm =
    (heightCm * 9.058) / 100 +
    12 +
    weightKg * 0.32 +
    -0.0068 * heightCm * heightCm -
    0.0542 * impedance -
    (isMale ? 0 : 0.9);
  const bodyFatKg = Math.max(weightKg - lbm, 0);
  const bodyFatPct = Math.min(Math.max((bodyFatKg / weightKg) * 100, 3), 60);
  const muscleKg = lbm * 0.83; // muscle ≈ 83% of LBM (Xiaomi approximation)
  const musclePct = (muscleKg / weightKg) * 100;
  const boneKg = isMale
    ? weightKg > 60
      ? lbm * 0.036
      : lbm * 0.037
    : weightKg > 45
      ? lbm * 0.036
      : lbm * 0.041;
  const waterPct = (100 - bodyFatPct) * 0.72;
  const visceralFatRaw = isMale
    ? weightKg * 0.6 - heightCm * 0.15 + age * 0.15 - 5
    : weightKg * 0.4 - heightCm * 0.08 + age * 0.07;
  const visceralFat = Math.min(Math.max(Math.round(visceralFatRaw), 1), 30);
  const metabolicAge = Math.min(Math.max(Math.round(age + (bodyFatPct - (isMale ? 15 : 22)) * 0.6), 15), 80);

  return {
    bodyFatPct: +bodyFatPct.toFixed(1),
    musclePct: +musclePct.toFixed(1),
    waterPct: +waterPct.toFixed(1),
    boneMassKg: +boneKg.toFixed(2),
    visceralFat,
    metabolicAge,
  };
}
