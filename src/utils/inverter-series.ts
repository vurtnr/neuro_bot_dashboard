export type OrderedTimeSeries = {
  points: Array<{
    timeLabel: string;
    sortKey: string;
  }>;
};

export function buildOrderedTimeLabels(
  seriesCollection: OrderedTimeSeries[],
): string[] {
  return Array.from(
    new Map<string, string>(
      seriesCollection
        .flatMap((series) =>
          series.points.map((point) => [point.timeLabel, point.sortKey] as const),
        )
        .sort((left, right) => left[1].localeCompare(right[1])),
    ).keys(),
  );
}
