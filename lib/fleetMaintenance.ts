export type FleetPartKey = "engine" | "tires" | "transmission" | "brakes";
export type ComponentAction = "none" | "maintenance" | "replace";
export type MechanicSpecialty = "umum" | "ban" | "mesin";

export const FLEET_PART_KEYS: readonly FleetPartKey[] = [
  "engine",
  "tires",
  "transmission",
  "brakes",
] as const;

export const FLEET_PART_LABELS: Record<FleetPartKey, string> = {
  engine: "Mesin",
  tires: "Ban",
  transmission: "Transmisi",
  brakes: "Rem",
};

export const FLEET_PART_SPECIALTY: Record<FleetPartKey, MechanicSpecialty> = {
  engine: "mesin",
  tires: "ban",
  transmission: "mesin",
  brakes: "umum",
};

/** Interval servis rutin standar (kilometer) */
export const FLEET_MAINTENANCE_INTERVALS: Record<FleetPartKey, number> = {
  engine: 45000,
  tires: 20000,
  transmission: 60000,
  brakes: 35000,
};

/** Jarak tempuh hingga komponen mencapai 100% wear (Paket D1) */
export const FLEET_WEAR_FULL_KM: Record<FleetPartKey, number> = {
  engine: 180000,
  tires: 80000,
  transmission: 240000,
  brakes: 105000,
};

/** Biaya servis rutin standar (NC) */
export const FLEET_DEFAULT_MAINT_COSTS: Record<FleetPartKey, number> = {
  engine: 2000,
  tires: 500,
  transmission: 1500,
  brakes: 800,
};

/** Biaya ganti baru (replace) standar untuk Truck & Bus — Paket D1 (total 74.000 NC) */
export const FLEET_DEFAULT_REPLACE_COSTS_TRUCK: Record<FleetPartKey, number> = {
  engine: 22000,
  tires: 10000,
  transmission: 28000,
  brakes: 14000,
};

/** Biaya ganti baru (replace) proporsional untuk Car (~35% — total 26.500 NC) */
export const FLEET_DEFAULT_REPLACE_COSTS_CAR: Record<FleetPartKey, number> = {
  engine: 8000,
  tires: 3500,
  transmission: 10000,
  brakes: 5000,
};

/** Durasi dasar pengerjaan bengkel (hari) sebelum boost mekanik garasi */
export const FLEET_SERVICE_DAYS: Record<"maintenance" | "replace", Record<FleetPartKey, number>> = {
  maintenance: {
    engine: 3,
    tires: 1,
    transmission: 4,
    brakes: 1,
  },
  replace: {
    engine: 9,
    tires: 3,
    transmission: 12,
    brakes: 3,
  },
};

export const FLEET_ADMIN_FEE = 500;

/** Minimum rasio pemakaian interval servis untuk Early Maintenance (50%) */
export const EARLY_MAINTENANCE_MIN_RATIO = 0.5;

/** Minimum persentase wear untuk Early Replace (50%) */
export const EARLY_REPLACE_MIN_WEAR = 50;

export interface GarageMechanicsInput {
  umum?: { boostPercentage?: number | null } | null;
  ban?: { boostPercentage?: number | null } | null;
  mesin?: { boostPercentage?: number | null } | null;
}

export interface EvaluatedFleetPart {
  key: FleetPartKey;
  label: string;
  odometer: number;
  threshold: number;
  baseInterval: number;
  remainingKm: number;
  /** Persentase pemakaian siklus servis berjalan (0-100) */
  cycleUsagePercent: number;
  /** Persentase wear permanen (0-100) */
  wearPercent: number;
  mustReplace: boolean;
  mustMaintain: boolean;
  canEarlyMaintain: boolean;
  canEarlyReplace: boolean;
  /** Apakah komponen boleh dipilih untuk servis rutin */
  allowMaintain: boolean;
  /** Apakah komponen boleh dipilih untuk ganti baru (replace) */
  allowReplace: boolean;
  /** Apakah komponen wajib dikerjakan (tidak boleh 'none') */
  isMandatory: boolean;
  defaultAction: ComponentAction;
  maintCost: number;
  replaceCost: number;
  baseMaintDays: number;
  baseReplaceDays: number;
  maintDays: number;
  replaceDays: number;
}

export interface FleetMaintenanceEvaluation {
  odometer: number;
  vehicleType: string;
  parts: Record<FleetPartKey, EvaluatedFleetPart>;
  hasMandatoryReplace: boolean;
  hasMandatoryMaintenance: boolean;
  hasMandatoryAny: boolean;
  hasAnyEligible: boolean;
  defaultSelections: Record<FleetPartKey, ComponentAction>;
  adminFee: number;
}

export interface PricedMaintenanceSelection {
  valid: boolean;
  error?: string;
  orderType: "maintenance" | "replace";
  selections: Record<FleetPartKey, ComponentAction>;
  components: Record<FleetPartKey, boolean>;
  replaceComponents: Record<FleetPartKey, boolean>;
  totalComponentCost: number;
  serviceDuration: number;
  adminFee: number;
  items: {
    key: FleetPartKey;
    label: string;
    action: "maintenance" | "replace";
    cost: number;
    days: number;
    isEarly: boolean;
  }[];
}

export function getDefaultReplaceCostsByType(vehicleType?: string | null): Record<FleetPartKey, number> {
  if (String(vehicleType || "").trim().toLowerCase() === "car") {
    return { ...FLEET_DEFAULT_REPLACE_COSTS_CAR };
  }
  return { ...FLEET_DEFAULT_REPLACE_COSTS_TRUCK };
}

export function getBoostedServiceDuration(
  baseDuration: number,
  specialty: MechanicSpecialty,
  mechanics?: GarageMechanicsInput | null,
): number {
  const boost = Number(mechanics?.[specialty]?.boostPercentage || 0);
  if (boost > 0) {
    const boosted = baseDuration * (1 - boost / 100);
    return Math.max(0.5, Number(boosted.toFixed(2)));
  }
  return baseDuration;
}

export function evaluateFleetMaintenance(
  fleet: any,
  mechanics?: GarageMechanicsInput | null,
): FleetMaintenanceEvaluation {
  const odometer = Number(fleet?.odometer || 0);
  const modelDoc = fleet?.modelInfo || (fleet?.model && typeof fleet.model === "object" ? fleet.model : null);
  const vehicleType = String(modelDoc?.type || "truck").trim().toLowerCase();

  const defaultReplace = getDefaultReplaceCostsByType(vehicleType);
  const rawMaintCost = modelDoc?.component_cost_maintenance || {};
  const rawReplaceCost = modelDoc?.component_cost_unfix_wear || {};
  const rawThresholds = fleet?.maintenance || {};
  const rawWear = fleet?.wear || {};

  const parts = {} as Record<FleetPartKey, EvaluatedFleetPart>;
  const defaultSelections = {} as Record<FleetPartKey, ComponentAction>;

  for (const key of FLEET_PART_KEYS) {
    const baseInterval = FLEET_MAINTENANCE_INTERVALS[key];
    const threshold = Number(rawThresholds[key] || baseInterval);
    const remainingKm = Math.max(0, threshold - odometer);
    const cycleUsageRatio =
      baseInterval > 0
        ? Math.max(0, Math.min(1, 1 - remainingKm / baseInterval))
        : 0;
    const cycleUsagePercent = Math.round(cycleUsageRatio * 100);

    const wearKey = `unfix_${key}` as const;
    const wearPercent = Math.max(0, Math.min(100, Number(rawWear[wearKey] || 0)));

    const mustReplace = wearPercent >= 100;
    const mustMaintain = !mustReplace && odometer >= threshold;
    const canEarlyMaintain =
      !mustReplace &&
      !mustMaintain &&
      remainingKm <= baseInterval * (1 - EARLY_MAINTENANCE_MIN_RATIO);
    const canEarlyReplace = !mustReplace && wearPercent >= EARLY_REPLACE_MIN_WEAR;

    const allowReplace = mustReplace || canEarlyReplace;
    const allowMaintain = !mustReplace && (mustMaintain || canEarlyMaintain);
    const isMandatory = mustReplace || mustMaintain;

    const defaultAction: ComponentAction = mustReplace
      ? "replace"
      : mustMaintain
        ? "maintenance"
        : "none";

    const maintCost = Number(rawMaintCost[key] ?? FLEET_DEFAULT_MAINT_COSTS[key]);
    const replaceCost = Number(rawReplaceCost[key] ?? defaultReplace[key]);
    const specialty = FLEET_PART_SPECIALTY[key];
    const baseMaintDays = FLEET_SERVICE_DAYS.maintenance[key];
    const baseReplaceDays = FLEET_SERVICE_DAYS.replace[key];

    parts[key] = {
      key,
      label: FLEET_PART_LABELS[key],
      odometer,
      threshold,
      baseInterval,
      remainingKm,
      cycleUsagePercent,
      wearPercent: Number(wearPercent.toFixed(1)),
      mustReplace,
      mustMaintain,
      canEarlyMaintain,
      canEarlyReplace,
      allowMaintain,
      allowReplace,
      isMandatory,
      defaultAction,
      maintCost,
      replaceCost,
      baseMaintDays,
      baseReplaceDays,
      maintDays: getBoostedServiceDuration(baseMaintDays, specialty, mechanics),
      replaceDays: getBoostedServiceDuration(baseReplaceDays, specialty, mechanics),
    };

    defaultSelections[key] = defaultAction;
  }

  const partList = FLEET_PART_KEYS.map((k) => parts[k]);
  const hasMandatoryReplace = partList.some((p) => p.mustReplace);
  const hasMandatoryMaintenance = partList.some((p) => p.mustMaintain);
  const hasMandatoryAny = hasMandatoryReplace || hasMandatoryMaintenance;
  const hasAnyEligible = partList.some((p) => p.allowMaintain || p.allowReplace);

  return {
    odometer,
    vehicleType,
    parts,
    hasMandatoryReplace,
    hasMandatoryMaintenance,
    hasMandatoryAny,
    hasAnyEligible,
    defaultSelections,
    adminFee: FLEET_ADMIN_FEE,
  };
}

export function validateAndPriceMaintenanceSelection(
  evaluation: FleetMaintenanceEvaluation,
  rawSelections?: Partial<Record<FleetPartKey, ComponentAction>> | null,
): PricedMaintenanceSelection {
  const selections: Record<FleetPartKey, ComponentAction> = {
    engine: rawSelections?.engine ?? evaluation.defaultSelections.engine,
    tires: rawSelections?.tires ?? evaluation.defaultSelections.tires,
    transmission: rawSelections?.transmission ?? evaluation.defaultSelections.transmission,
    brakes: rawSelections?.brakes ?? evaluation.defaultSelections.brakes,
  };

  const components: Record<FleetPartKey, boolean> = {
    engine: false,
    tires: false,
    transmission: false,
    brakes: false,
  };
  const replaceComponents: Record<FleetPartKey, boolean> = {
    engine: false,
    tires: false,
    transmission: false,
    brakes: false,
  };

  let totalComponentCost = 0;
  let serviceDuration = 0;
  const items: PricedMaintenanceSelection["items"] = [];

  for (const key of FLEET_PART_KEYS) {
    const part = evaluation.parts[key];
    const action = selections[key];

    if (action !== "none" && action !== "maintenance" && action !== "replace") {
      return {
        valid: false,
        error: `Aksi tidak valid untuk komponen ${part.label}.`,
        orderType: "maintenance",
        selections,
        components,
        replaceComponents,
        totalComponentCost: 0,
        serviceDuration: 0,
        adminFee: evaluation.adminFee,
        items: [],
      };
    }

    if (part.mustReplace && action !== "replace") {
      return {
        valid: false,
        error: `Komponen ${part.label} sudah mencapai wear 100% dan wajib diganti baru (Replace).`,
        orderType: "replace",
        selections,
        components,
        replaceComponents,
        totalComponentCost: 0,
        serviceDuration: 0,
        adminFee: evaluation.adminFee,
        items: [],
      };
    }

    if (part.mustMaintain && action === "none") {
      return {
        valid: false,
        error: `Komponen ${part.label} sudah melewati batas servis dan wajib diservis.`,
        orderType: "maintenance",
        selections,
        components,
        replaceComponents,
        totalComponentCost: 0,
        serviceDuration: 0,
        adminFee: evaluation.adminFee,
        items: [],
      };
    }

    if (action === "maintenance" && !part.allowMaintain) {
      return {
        valid: false,
        error: `Komponen ${part.label} belum mencapai 50% interval servis (masih prima).`,
        orderType: "maintenance",
        selections,
        components,
        replaceComponents,
        totalComponentCost: 0,
        serviceDuration: 0,
        adminFee: evaluation.adminFee,
        items: [],
      };
    }

    if (action === "replace" && !part.allowReplace) {
      return {
        valid: false,
        error: `Komponen ${part.label} belum mencapai wear 50% untuk penggantian dini.`,
        orderType: "replace",
        selections,
        components,
        replaceComponents,
        totalComponentCost: 0,
        serviceDuration: 0,
        adminFee: evaluation.adminFee,
        items: [],
      };
    }

    if (action !== "none") {
      components[key] = true;
      if (action === "replace") {
        replaceComponents[key] = true;
        totalComponentCost += part.replaceCost;
        serviceDuration += part.replaceDays;
        items.push({
          key,
          label: part.label,
          action: "replace",
          cost: part.replaceCost,
          days: part.replaceDays,
          isEarly: !part.mustReplace,
        });
      } else {
        totalComponentCost += part.maintCost;
        serviceDuration += part.maintDays;
        items.push({
          key,
          label: part.label,
          action: "maintenance",
          cost: part.maintCost,
          days: part.maintDays,
          isEarly: !part.mustMaintain,
        });
      }
    }
  }

  if (items.length === 0) {
    return {
      valid: false,
      error: "Pilih minimal satu komponen yang ingin diservis atau diganti.",
      orderType: "maintenance",
      selections,
      components,
      replaceComponents,
      totalComponentCost: 0,
      serviceDuration: 0,
      adminFee: evaluation.adminFee,
      items: [],
    };
  }

  const hasReplace = items.some((i) => i.action === "replace");

  return {
    valid: true,
    orderType: hasReplace ? "replace" : "maintenance",
    selections,
    components,
    replaceComponents,
    totalComponentCost,
    serviceDuration: Number(serviceDuration.toFixed(2)),
    adminFee: evaluation.adminFee,
    items,
  };
}
