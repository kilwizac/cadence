import type { AreaKind } from "../../shared/types";

export interface KindModels {
  hero: string;
  props: string[];
}

export const KIND_MODELS: Record<AreaKind, KindModels> = {
  shipping: {
    hero: "industrial/building-i",
    props: ["vehicles/delivery", "factory/box-large", "vehicles/truck-flat", "industrial/shipping-container-a", "factory/box-wide"],
  },
  inventory: {
    hero: "industrial/building-j",
    props: ["factory/box-large", "factory/box-long", "industrial/shipping-container-b", "vehicles/tractor-shovel", "factory/box-wide"],
  },
  purchasing: {
    hero: "commercial/building-a",
    props: ["vehicles/van", "factory/box-small", "factory/screen-panel-wide", "factory/box-wide", "vehicles/delivery-flat"],
  },
  sales: {
    hero: "commercial/building-b",
    props: ["vehicles/sedan", "factory/screen-wide", "vehicles/van", "factory/box-small", "factory/screen-panel-wide"],
  },
  engineering: {
    hero: "commercial/building-c",
    props: ["factory/screen-wide", "factory/robot-arm-b", "factory/screen-panel-wide", "factory/crane-magnet", "factory/cog-a"],
  },
  production: {
    hero: "industrial/building-m",
    props: ["factory/machine", "factory/robot-arm-a", "factory/machine-fortified", "factory/conveyor-long", "factory/machine-window"],
  },
  quality: {
    hero: "industrial/building-p",
    props: ["factory/scanner-high", "factory/scanner-low", "factory/screen-wide", "factory/machine-window", "factory/box-small"],
  },
  maintenance: {
    hero: "industrial/building-n",
    props: ["factory/crane", "factory/cog-a", "factory/piston-square", "factory/warning-traffic", "industrial/detail-tank"],
  },
  office: {
    hero: "industrial/building-a",
    props: ["vehicles/sedan", "industrial/detail-tank", "factory/cone", "industrial/water-tower", "industrial/chimney-medium"],
  },
};

export const modelUrl = (id: string) => `./models/${id}.glb`;

export const ALL_MODELS = [...new Set(Object.values(KIND_MODELS).flatMap((kind) => [kind.hero, ...kind.props]))];
