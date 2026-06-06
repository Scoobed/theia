import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { DependencyOptions } from 'types';
import { PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

interface Props extends PanelProps<DependencyOptions> {}

/** Helper to get field values as a plain array (Grafana 10+ compatible) */
function getFieldValues(frame: any, fieldName: string): any[] {
  const field = frame.fields.find((f: any) => f.name === fieldName);
  return field ? Array.from(field.values) : [];
}

export const DependencyPanel: React.FC<Props> = ({ options, data, width, height }) => {
  const theme = useTheme2();
  const containerRef = useRef<HTMLDivElement>(null);
  const frame = data.series[0];

  const sourcePodNamesArr = frame ? getFieldValues(frame, 'sourcePodName') : [];
  const sourcePodLabelsArr = frame ? getFieldValues(frame, 'sourcePodLabels') : [];
  const sourceNodeNamesArr = frame ? getFieldValues(frame, 'sourceNodeName') : [];
  const destinationPodNamesArr = frame ? getFieldValues(frame, 'destinationPodName') : [];
  const destinationPodLabelsArr = frame ? getFieldValues(frame, 'destinationPodLabels') : [];
  const destinationNodeNamesArr = frame ? getFieldValues(frame, 'destinationNodeName') : [];
  const destinationServicePortNamesArr = frame ? getFieldValues(frame, 'destinationServicePortName') : [];
  const octetDeltaCountsArr = frame ? getFieldValues(frame, 'octetDeltaCount') : [];

  const nodeToPodMap = new Map<string, string[]>();
  const srcToDestMap = new Map<string, Map<string, number>>();

  let graphString = 'graph LR;\n';
  let boxColor;
  switch (options.color) {
    case 'red':
      boxColor = theme.colors.error.main;
      break;
    case 'yellow':
      boxColor = theme.colors.warning.main;
      break;
    case 'green':
      boxColor = theme.colors.success.main;
      break;
    case 'blue':
      boxColor = theme.colors.primary.main;
      break;
  }

  const frameLength = frame ? frame.length : 0;
  for (let i = 0; i < frameLength; i++) {
    const sourcePodName = sourcePodNamesArr[i];
    const sourcePodLabel = sourcePodLabelsArr[i];
    const sourceNodeName = sourceNodeNamesArr[i];
    const destinationPodName = destinationPodNamesArr[i];
    const destinationPodLabel = destinationPodLabelsArr[i];
    const destinationNodeName = destinationNodeNamesArr[i];
    const destinationServicePortName = destinationServicePortNamesArr[i];
    const octetDeltaCount = octetDeltaCountsArr[i];

    function getName(groupByLabel: boolean, source: boolean, labelJSON: string) {
      if (!groupByLabel || labelJSON === undefined || options.labelName === undefined) {
        return source ? sourcePodName : destinationPodName;
      }
      try {
        const labels = JSON.parse(labelJSON);
        if (labels[options.labelName] !== undefined) {
          return labels[options.labelName];
        }
      } catch {
        // ignore parse errors
      }
      return sourcePodName;
    }

    const groupByPodLabel = options.groupByPodLabel;
    const srcName = getName(groupByPodLabel, true, sourcePodLabel);
    const dstName = getName(groupByPodLabel, false, destinationPodLabel);

    // determine which nodes contain which pods
    if (nodeToPodMap.has(sourceNodeName) && !nodeToPodMap.get(sourceNodeName)?.includes(srcName)) {
      nodeToPodMap.get(sourceNodeName)?.push(srcName);
    } else if (!nodeToPodMap.has(sourceNodeName)) {
      nodeToPodMap.set(sourceNodeName, [srcName]);
    }
    if (nodeToPodMap.has(destinationNodeName) && !nodeToPodMap.get(destinationNodeName)?.includes(dstName)) {
      nodeToPodMap.get(destinationNodeName)?.push(dstName);
    } else if (!nodeToPodMap.has(destinationNodeName)) {
      nodeToPodMap.set(destinationNodeName, [dstName]);
    }

    // determine how much traffic is being sent
    const pod_src = sourceNodeName + '_pod_' + srcName;
    const pod_dst = destinationNodeName + '_pod_' + dstName;
    const svc_dst = 'svc_' + destinationServicePortName;
    const dests = new Map<string, number>();
    dests.set(pod_dst, octetDeltaCount);
    if (destinationServicePortName !== '') {
      dests.set(svc_dst, octetDeltaCount);
    }
    if (srcToDestMap.has(pod_src)) {
      if (srcToDestMap.get(pod_src)?.has(pod_dst)) {
        srcToDestMap.get(pod_src)?.set(pod_dst, octetDeltaCount + (srcToDestMap.get(pod_src)?.get(pod_dst) ?? 0));
      } else {
        srcToDestMap.get(pod_src)?.set(pod_dst, octetDeltaCount);
      }
      if (destinationServicePortName === '') {
        continue;
      } else if (srcToDestMap.get(pod_src)?.has(svc_dst)) {
        srcToDestMap.get(pod_src)?.set(svc_dst, octetDeltaCount + (srcToDestMap.get(pod_src)?.get(svc_dst) ?? 0));
      } else {
        srcToDestMap.get(pod_src)?.set(svc_dst, octetDeltaCount);
      }
    } else {
      srcToDestMap.set(pod_src, dests);
    }
  }

  // format pods inside node within graph string
  nodeToPodMap.forEach((pods, nodename) => {
    let str = 'subgraph ' + nodename + '\n';
    pods.forEach((pod) => {
      str += nodename + '_pod_' + pod + '(' + pod + ');\n';
    });
    str += 'end;\n';
    graphString += str;
  });

  // format arrows to services and pods within graph string
  const prefixes = ['', 'K', 'M', 'G', 'T'];
  srcToDestMap.forEach((destsToBytes, src) => {
    destsToBytes.forEach((bytes, dest) => {
      let usedpref = Math.floor(Math.log(bytes) / Math.log(1000));
      if (usedpref > 4) {
        usedpref = 4;
      }
      const str = src + ' -- ' + bytes / Math.pow(1000, usedpref) + ' ' + prefixes[usedpref] + 'B --> ' + dest + ';\n';
      graphString += str;
    });
  });

  // Render mermaid diagram using the v11 async API
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: boxColor,
        secondaryColor: theme.colors.background.canvas,
        tertiaryColor: theme.colors.background.canvas,
        primaryTextColor: theme.colors.text.maxContrast,
        lineColor: theme.colors.text.maxContrast,
      },
    });
    const renderDiagram = async () => {
      try {
        const { svg } = await mermaid.render('dependency-graph', graphString);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        console.error('Mermaid render error:', e);
        if (containerRef.current) {
          containerRef.current.innerHTML = '<p>Error rendering dependency graph</p>';
        }
      }
    };
    renderDiagram();
  });

  return <div ref={containerRef} style={{ width, height, overflow: 'auto' }} />;
};
