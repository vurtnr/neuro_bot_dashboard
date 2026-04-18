"use client";

const SIMULATION_EVENT_NAME = "robot-dashboard:inspection-simulation";
const SIMULATION_STORAGE_KEY = "robot-dashboard:inspection-simulation-state";
const ANOMALY_DELAY_MS = 3200;
const DEFAULT_ANOMALY_NODE_ID = "ncu-5";
const DEFAULT_ANOMALY_NODE_LABEL = "N5";

type InspectionSimulationState = {
  siteId: string;
  siteName: string;
  startedAt: number;
  anomalyAt: number;
  anomalyPublished: boolean;
};

export type InspectionSimulationEvent =
  | {
      stage: "dispatching";
      siteId: string;
      siteName: string;
      timestamp: number;
      message: string;
    }
  | {
      stage: "anomaly";
      siteId: string;
      siteName: string;
      timestamp: number;
      nodeId: string;
      nodeLabel: string;
      message: string;
    };

let anomalyTimerId: number | null = null;

function canUseWindow() {
  return typeof window !== "undefined";
}

function readSimulationState(): InspectionSimulationState | null {
  if (!canUseWindow()) {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(SIMULATION_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<InspectionSimulationState>;
    if (
      typeof parsed.siteId !== "string" ||
      typeof parsed.siteName !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.anomalyAt !== "number" ||
      typeof parsed.anomalyPublished !== "boolean"
    ) {
      return null;
    }

    return parsed as InspectionSimulationState;
  } catch {
    return null;
  }
}

function writeSimulationState(state: InspectionSimulationState | null) {
  if (!canUseWindow()) {
    return;
  }

  if (!state) {
    window.sessionStorage.removeItem(SIMULATION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(state));
}

function dispatchSimulationEvent(event: InspectionSimulationEvent) {
  if (!canUseWindow()) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<InspectionSimulationEvent>(SIMULATION_EVENT_NAME, {
      detail: event,
    }),
  );
}

function buildDispatchingEvent(
  state: InspectionSimulationState,
): InspectionSimulationEvent {
  return {
    stage: "dispatching",
    siteId: state.siteId,
    siteName: state.siteName,
    timestamp: state.startedAt,
    message: `机器人消息：已接收巡检任务，当前进入${state.siteName}巡检模式`,
  };
}

function buildAnomalyEvent(
  state: InspectionSimulationState,
): InspectionSimulationEvent {
  return {
    stage: "anomaly",
    siteId: state.siteId,
    siteName: state.siteName,
    timestamp: state.anomalyAt,
    nodeId: DEFAULT_ANOMALY_NODE_ID,
    nodeLabel: DEFAULT_ANOMALY_NODE_LABEL,
    message:
      "发生巡检事件：检测到青海场站支架NCU N5 参数异常，已同步至场站监控，点击查看详细信息。",
  };
}

function clearAnomalyTimer() {
  if (anomalyTimerId !== null && canUseWindow()) {
    window.clearTimeout(anomalyTimerId);
  }
  anomalyTimerId = null;
}

function publishAnomaly(state: InspectionSimulationState) {
  const nextState = {
    ...state,
    anomalyPublished: true,
  };

  writeSimulationState(nextState);
  dispatchSimulationEvent(buildAnomalyEvent(nextState));
}

function scheduleAnomaly(state: InspectionSimulationState) {
  clearAnomalyTimer();

  if (state.anomalyPublished || !canUseWindow()) {
    return;
  }

  const delayMs = Math.max(0, state.anomalyAt - Date.now());
  anomalyTimerId = window.setTimeout(() => {
    const currentState = readSimulationState();
    if (!currentState || currentState.siteId !== state.siteId) {
      return;
    }

    publishAnomaly(currentState);
  }, delayMs);
}

export function startInspectionSimulation(input: {
  siteId: string;
  siteName: string;
}) {
  const now = Date.now();
  const state: InspectionSimulationState = {
    siteId: input.siteId,
    siteName: input.siteName,
    startedAt: now,
    anomalyAt: now + ANOMALY_DELAY_MS,
    anomalyPublished: false,
  };

  writeSimulationState(state);
  dispatchSimulationEvent(buildDispatchingEvent(state));
  scheduleAnomaly(state);
}

export function syncInspectionSimulation(): InspectionSimulationEvent | null {
  const state = readSimulationState();
  if (!state) {
    clearAnomalyTimer();
    return null;
  }

  if (state.anomalyPublished) {
    return buildAnomalyEvent(state);
  }

  if (Date.now() >= state.anomalyAt) {
    publishAnomaly(state);
    return buildAnomalyEvent({
      ...state,
      anomalyPublished: true,
    });
  }

  scheduleAnomaly(state);
  return buildDispatchingEvent(state);
}

export function subscribeInspectionSimulation(
  listener: (event: InspectionSimulationEvent) => void,
) {
  if (!canUseWindow()) {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<InspectionSimulationEvent>;
    listener(customEvent.detail);
  };

  window.addEventListener(SIMULATION_EVENT_NAME, handleEvent as EventListener);

  return () => {
    window.removeEventListener(
      SIMULATION_EVENT_NAME,
      handleEvent as EventListener,
    );
  };
}
