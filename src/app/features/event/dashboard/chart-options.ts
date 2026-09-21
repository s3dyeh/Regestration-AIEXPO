import type { EChartsCoreOption } from 'echarts/core';
import type { EventStats } from '../domain';
import { EVENT_BRAND } from '../event-brand';

export const CHART_COLORS = [
  EVENT_BRAND.colors.primary,
  EVENT_BRAND.colors.secondary,
  '#ad86ff',
  '#c3b6d3',
  '#1677a5',
  '#cbb6ff',
  '#555566',
];
export function majorChart(stats: EventStats): EChartsCoreOption {
  const rows = [...stats.majors].sort((a, b) => b.count - a.count);
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#21192d',
      borderColor: '#77549c',
      textStyle: { color: '#f3edff' },
      confine: true,
    },
    grid: { left: 0, right: 72, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'value', show: false, minInterval: 1 },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((row) => row.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#c4b8d5', fontSize: 11, width: 160, overflow: 'truncate', interval: 0 },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        showBackground: true,
        backgroundStyle: { color: '#ffffff05', borderRadius: 4 },
        data: rows.map((row, index) => ({
          value: row.count,
          label: {
            formatter: `${row.count}  ·  ${stats.total ? Math.round((row.count / stats.total) * 100) : 0}%`,
          },
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: CHART_COLORS[index % CHART_COLORS.length] },
                { offset: 1, color: index % 2 ? '#80d7f6' : '#b18aff' },
              ],
            },
            borderRadius: [0, 5, 5, 0],
          },
        })),
        label: { show: true, position: 'right', color: '#e5dcf2', fontSize: 11 },
      },
    ],
  };
}
export function genderChart(stats: EventStats): EChartsCoreOption {
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#21192d',
      borderColor: '#77549c',
      textStyle: { color: '#f3edff' },
      confine: true,
    },
    color: CHART_COLORS,
    series: [
      {
        type: 'pie',
        radius: ['66%', '88%'],
        center: ['50%', '50%'],
        label: { show: false },
        emphasis: { scale: false },
        data: stats.genders.map((row) => ({ name: row.name, value: row.count })),
        itemStyle: { borderColor: '#171220', borderWidth: 4, borderRadius: 6 },
      },
    ],
  };
}
export function timelineChart(stats: EventStats): EChartsCoreOption {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const buckets = new Map(stats.timeline.map((row) => [Date.parse(row.time), row.count]));
  const timeline = Array.from({ length: 12 }, (_, index) => {
    const time = end.getTime() - (11 - index) * 3_600_000;
    return { time: new Date(time).toISOString(), count: buckets.get(time) ?? 0 };
  });
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#21192d',
      borderColor: '#77549c',
      textStyle: { color: '#f3edff' },
      confine: true,
    },
    grid: { left: 0, right: 12, top: 20, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: timeline.map((row) =>
        new Date(row.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#a192b3', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#ffffff09', type: 'dashed' } },
      axisLabel: { color: '#a192b3', fontSize: 10 },
    },
    series: [
      {
        type: 'line',
        data: timeline.map((row) => row.count),
        smooth: 0.25,
        symbolSize: 5,
        lineStyle: { color: EVENT_BRAND.colors.secondary, width: 3 },
        itemStyle: { color: '#93deff', borderColor: EVENT_BRAND.colors.secondary, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#2cabe24d' },
              { offset: 1, color: '#7a3cff02' },
            ],
          },
        },
      },
    ],
  };
}
