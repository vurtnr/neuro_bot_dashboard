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
      tagLabel: string;
    };
  }>;
};

export const PINNED_PLANNED_PLANTS: PlannedPlant[] = [
  {
    plantId: "303342051150270464",
    lng: 116.397583,
    lat: 39.907806,
    name: "集中式光伏上网电站",
    country: "中国",
    province: "河北省",
    city: "石家市",
  },
];

const PINNED_PLANNED_PLANT_IDS = new Set(
  PINNED_PLANNED_PLANTS.map((plant) => plant.plantId),
);

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

export function mergePinnedPlannedPlants(plants: PlannedPlant[]) {
  const dynamicPlants = plants.filter(
    (plant) => !PINNED_PLANNED_PLANT_IDS.has(plant.plantId),
  );

  return [...PINNED_PLANNED_PLANTS, ...dynamicPlants];
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
        tagLabel: "规划中",
      },
    })),
  };
}
