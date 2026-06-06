import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SankeyPanel } from './SankeyPanel';
import { LoadingState, PanelProps, TimeRange, toDataFrame } from '@grafana/data';

// Mock @grafana/ui useTheme2
jest.mock('@grafana/ui', () => ({
  useTheme2: () => ({
    colors: {
      text: { primary: '#000' },
      border: { medium: '#ccc' },
    },
  }),
}));

describe('Sankey Diagram test', () => {
  it('Should render SVG with data', () => {
    const props = {
      data: {
        series: [
          toDataFrame({
            refId: 'A',
            fields: [
              { name: 'source', values: ['alpine0'] },
              { name: 'destination', values: ['alpine1'] },
              { name: 'destinationIP', values: ['10.10.1.55'] },
              { name: 'bytes', values: [10000] },
            ],
          }),
        ],
        state: LoadingState.Done,
        timeRange: {} as TimeRange,
      },
      width: 600,
      height: 600,
      options: {},
    } as unknown as PanelProps;

    const { container } = render(React.createElement(SankeyPanel, props));
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('width')).toBe('600');
  });

  it('Should show No data when empty', () => {
    const props = {
      data: {
        series: [],
        state: LoadingState.Done,
        timeRange: {} as TimeRange,
      },
      width: 600,
      height: 600,
      options: {},
    } as unknown as PanelProps;

    const { container } = render(React.createElement(SankeyPanel, props));
    const text = container.querySelector('text');
    expect(text?.textContent).toBe('No data');
  });
});
