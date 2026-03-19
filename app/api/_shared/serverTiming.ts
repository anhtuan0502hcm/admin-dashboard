type TimingMetric = {
  name: string;
  duration: number;
  description?: string;
};

const sanitizeDescription = (value: string) => value.replace(/["\\]/g, "");

export const buildServerTimingHeader = (metrics: TimingMetric[]) =>
  metrics
    .filter((metric) => Number.isFinite(metric.duration) && metric.duration >= 0)
    .map((metric) => {
      const base = `${metric.name};dur=${metric.duration.toFixed(1)}`;
      return metric.description
        ? `${base};desc="${sanitizeDescription(metric.description)}"`
        : base;
    })
    .join(", ");
