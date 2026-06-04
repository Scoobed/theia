import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SankeyPanel } from './SankeyPanel';
import { LoadingState, PanelProps, TimeRange, toDataFrame } from '@grafana/data';

// Mock react-google-charts to avoid loading Google Charts in tests
jest.mock('react-google-charts', () => ({
  Chart: (props: any) => <div data-testid="google-chart" data-charttype={props.chartType} data-chart-data={JSON.stringify(props.data)} />,
}));

describe('Sankey Diagram test', () => {
  it('Should render Chart with correct data', () => {
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

    render(<SankeyPanel {...props} />);

    const chart = screen.getByTestId('google-chart');
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAttribute('data-charttype', 'Sankey');

    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '[]');
    expect(chartData).toEqual([
      ['From', 'To', 'Bytes'],
      ['alpine0', 'alpine1 ', 10000],
    ]);
  });

  it('Should show fallback when no data', () => {
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

    render(<SankeyPanel {...props} />);

    const chart = screen.getByTestId('google-chart');
    const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '[]');
    expect(chartData).toEqual([
      ['From', 'To', 'Bytes'],
      ['Source N/A', 'Destination N/A', 1],
    ]);
  });
});
