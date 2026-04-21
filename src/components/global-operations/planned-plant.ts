export type PlannedPlantPayload = {
  plantId?: string;
  longitude?: number | string;
  latitude?: number | string;
  plantName?: string;
  country?: string;
  province?: string;
  city?: string;
};

export type PlannedPlant = {
  plantId: string;
  lng: number;
  lat: number;
  name: string;
  country: string;
  province: string;
  city: string;
};

export type PlannedPlantFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
    properties: {
      plantId: string;
      name: string;
    };
  }>;
};

export type PlannedPlantMetric = {
  label: string;
  value: string;
};

function parseCoordinate(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createPlannedPlantFromPayload(
  payload: PlannedPlantPayload,
): PlannedPlant | null {
  if (
    typeof payload.plantId !== "string" ||
    typeof payload.plantName !== "string" ||
    typeof payload.country !== "string" ||
    typeof payload.province !== "string" ||
    typeof payload.city !== "string"
  ) {
    return null;
  }

  const lng = parseCoordinate(payload.longitude);
  const lat = parseCoordinate(payload.latitude);
  if (lng === null || lat === null) {
    return null;
  }

  return {
    plantId: payload.plantId,
    lng,
    lat,
    name: payload.plantName,
    country: payload.country,
    province: payload.province,
    city: payload.city,
  };
}

export function upsertPlannedPlant(
  current: PlannedPlant[],
  incoming: PlannedPlant,
): PlannedPlant[] {
  const next = current.filter((item) => item.plantId !== incoming.plantId);
  return [...next, incoming];
}

export function buildPlannedPlantRedirectUrl(plantId: string) {
  return `http://10.180.40.166/#/workspace/info/home?workflowId=${plantId}&tab=forward`;
}

export function getPlannedPlantRegionLabel(plannedPlant: PlannedPlant) {
  return `${plannedPlant.country}  ${plannedPlant.province} · ${plannedPlant.city}`;
}

export function toPlannedPlantFeatureCollection(
  plants: PlannedPlant[],
): PlannedPlantFeatureCollection {
  return {
    type: "FeatureCollection",
    features: plants.map((plant) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [plant.lng, plant.lat],
      },
      properties: {
        plantId: plant.plantId,
        name: plant.name,
      },
    })),
  };
}

function deriveSeed(plannedPlant: PlannedPlant) {
  return Array.from(plannedPlant.plantId).reduce(
    (sum, char, index) => sum + char.charCodeAt(0) * (index + 1),
    0,
  );
}

export function buildPlannedPlantMetrics(
  plannedPlant: PlannedPlant,
): PlannedPlantMetric[] {
  const seed = deriveSeed(plannedPlant);
  const capacity = 28 + (seed % 15);
  const projectedPower = (capacity * (0.63 + ((seed % 18) / 100))).toFixed(1);
  const temperature = (16 + ((seed % 35) / 10)).toFixed(1);
  const irradiance = 760 + (seed % 120);

  return [
    {
      label: "装机容量",
      value: `${capacity} MW`,
    },
    {
      label: "预计实时功率",
      value: `${projectedPower} MW`,
    },
    {
      label: "环境温度",
      value: `${temperature} °C`,
    },
    {
      label: "辐照强度",
      value: `${irradiance} W/m²`,
    },
  ];
}
