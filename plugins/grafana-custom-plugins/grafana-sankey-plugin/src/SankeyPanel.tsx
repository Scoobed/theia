import React from 'react';
import { PanelProps } from '@grafana/data';
import { SankeyOptions } from 'types';
import { Chart } from 'react-google-charts';

interface Props extends PanelProps<SankeyOptions> {}

/**
 * Helper to extract field values as a plain array.
 * In Grafana 10+, field.values is already a plain array.
 */
function getFieldValues(series: Props['data']['series'], fieldName: string): any[] | undefined {
  for (const s of series) {
    const field = s.fields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
    if (field) {
      return Array.from(field.values);
    }
  }
  return undefined;
}

export const SankeyPanel: React.FC<Props> = ({ data, width, height }) => {
  let result: any[][] = [
    ['From', 'To', 'Bytes'],
    ['Source N/A', 'Destination N/A', 1],
  ];

  const sources = getFieldValues(data.series, 'source');
  if (sources !== undefined) {
    const destinations = getFieldValues(data.series, 'destination') ?? [];
    const destinationIPs = getFieldValues(data.series, 'destinationip') ?? [];
    const bytes = getFieldValues(data.series, 'bytes') ?? [];

    const rows: any[][] = [];
    for (let i = 0; i < sources.length; i++) {
      if (bytes[i] === 0) {
        continue;
      }
      let source = sources[i] || 'N/A';
      let destination = destinations[i];
      if (!destination) {
        destination = destinationIPs[i] || 'N/A';
      } else {
        // Google Chart will not render if cycle exists. Direct cycle: a->a
        // (e.g. intra-Node traffic in node_to_node_flows dashboard); Indirect
        // cycle: a->b, b->c, c->a. Add an extra space to all the destination
        // names to avoid introducing cycles.
        destination = destination + ' ';
      }
      rows.push([source, destination, bytes[i]]);
    }
    if (rows.length > 0) {
      result = [['From', 'To', 'Bytes'], ...rows];
    }
  }

  return (
    <div>
      <Chart width={width} height={height} chartType="Sankey" loader={<div>Loading Chart</div>} data={result} />
    </div>
  );
};
