import React, { useRef, useEffect } from 'react';
import { PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { SankeyOptions } from 'types';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { select } from 'd3-selection';
import { scaleOrdinal } from 'd3-scale';

interface Props extends PanelProps<SankeyOptions> {}

interface NodeDatum {
  name: string;
}

interface LinkDatum {
  source: number;
  target: number;
  value: number;
}

const COLORS = [
  '#3366CC', '#DC3912', '#FF9900', '#109618', '#990099',
  '#3B3EAC', '#0099C6', '#DD4477', '#66AA00', '#B82E2E',
];

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
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme2();

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const sources = getFieldValues(data.series, 'source');
    if (!sources || sources.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.colors.text.primary)
        .text('No data');
      return;
    }

    const destinations = getFieldValues(data.series, 'destination') ?? [];
    const destinationIPs = getFieldValues(data.series, 'destinationip') ?? [];
    const bytes = getFieldValues(data.series, 'bytes') ?? [];

    // Build unique node list and links
    const nodeIndex = new Map<string, number>();
    const nodeNames: string[] = [];
    const links: LinkDatum[] = [];

    function getOrCreateNode(name: string, isSrc: boolean): number {
      const key = isSrc ? 'src:' + name : 'dst:' + name;
      if (nodeIndex.has(key)) {
        return nodeIndex.get(key)!;
      }
      const idx = nodeNames.length;
      nodeNames.push(name);
      nodeIndex.set(key, idx);
      return idx;
    }

    for (let i = 0; i < sources.length; i++) {
      if (bytes[i] === 0) {
        continue;
      }
      const source = sources[i] || 'N/A';
      const destination = destinations[i] || destinationIPs[i] || 'N/A';
      const srcIdx = getOrCreateNode(source, true);
      const dstIdx = getOrCreateNode(destination, false);
      links.push({ source: srcIdx, target: dstIdx, value: bytes[i] });
    }

    if (links.length === 0) {
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', theme.colors.text.primary)
        .text('No flow data');
      return;
    }

    const nodes: NodeDatum[] = nodeNames.map((name) => ({ name }));
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const sankeyGen = sankey<NodeDatum, LinkDatum>()
      .nodeId(function (d: any) { return d.index; })
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    const graph = sankeyGen({
      nodes: nodes.map(function (d) { return Object.assign({}, d); }),
      links: links.map(function (d) { return Object.assign({}, d); }),
    });

    const color = scaleOrdinal(COLORS);
    const g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Draw links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.4)
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', function (d: any) { return color(d.source.name); })
      .attr('stroke-width', function (d: any) { return Math.max(1, d.width); })
      .append('title')
      .text(function (d: any) { return d.source.name + ' \u2192 ' + d.target.name + '\n' + d.value.toLocaleString() + ' bytes'; });

    // Draw nodes
    g.append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', function (d: any) { return d.x0; })
      .attr('y', function (d: any) { return d.y0; })
      .attr('height', function (d: any) { return Math.max(1, d.y1 - d.y0); })
      .attr('width', function (d: any) { return d.x1 - d.x0; })
      .attr('fill', function (d: any) { return color(d.name); })
      .attr('stroke', theme.colors.border.medium)
      .append('title')
      .text(function (d: any) { return d.name + '\n' + (d.value || 0).toLocaleString() + ' bytes'; });

    // Draw labels
    g.append('g')
      .style('font-size', '11px')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', function (d: any) { return d.x0 < innerWidth / 2 ? d.x1 + 6 : d.x0 - 6; })
      .attr('y', function (d: any) { return (d.y1 + d.y0) / 2; })
      .attr('dy', '0.35em')
      .attr('text-anchor', function (d: any) { return d.x0 < innerWidth / 2 ? 'start' : 'end'; })
      .attr('fill', theme.colors.text.primary)
      .text(function (d: any) { return d.name; });
  }, [data, width, height, theme]);

  return React.createElement('svg', { ref: svgRef, width: width, height: height });
};
