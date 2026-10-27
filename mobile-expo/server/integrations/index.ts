export {
  HealthAggregatorClient,
  createAggregatorClient,
  getSupportedProviders,
  EHR_PROVIDER_REGISTRY,
} from "./health-aggregator-client";

export type {
  AggregatorProvider,
  AggregatorConfig,
  AggregatorConnection,
  ConnectedHealthSource,
  EHRProvider,
} from "./health-aggregator-client";

export {
  WearableAggregatorClient,
  createWearableClient,
  getSupportedWearableSources,
} from "./wearable-aggregator-client";

export type {
  WearableProvider,
  WearableConfig,
  WearableConnection,
  ConnectedDevice,
  DeviceType,
  WearableData,
  ActivityData,
  SleepData,
  BodyData,
  DailyData,
  NutritionData,
} from "./wearable-aggregator-client";
