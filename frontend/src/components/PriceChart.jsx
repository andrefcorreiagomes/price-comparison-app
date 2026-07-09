import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

// Custom tooltip renderer for premium design styling
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    // Format date string from YYYY-MM-DD to DD/MM/YYYY
    let formattedDate = label;
    try {
      const dateParts = label.split('-');
      if (dateParts.length === 3) {
        formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
      }
    } catch (e) {}

    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-date">{formattedDate}</p>
        {payload.map((entry) => {
          const isContinente = entry.name === 'Continente';
          const details = entry.payload[entry.name]?.saleDetails;
          return (
            <div
              key={entry.name}
              className={`chart-tooltip-row ${isContinente ? 'c' : 'pd'}`}
            >
              <span>{entry.name}:</span>
              <span>
                €{entry.value.toFixed(2)}
                {details ? ` (${details})` : ''}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function PriceChart({ historyData, productName }) {
  if (!historyData || historyData.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No history data available</p>
      </div>
    );
  }

  // Format Recharts data. The raw endpoint returns:
  // [ { date: "YYYY-MM-DD", Continente: { price, pricePerUnit, isPromo, saleDetails }, 'Pingo Doce': { ... } } ]
  // We want to transform it into:
  // [ { date: "YYYY-MM-DD", Continente: price, 'Pingo Doce': price, rawData: ... } ]
  const formattedData = historyData.map((d) => ({
    date: d.date,
    Continente: d.Continente ? d.Continente.price : null,
    'Pingo Doce': d['Pingo Doce'] ? d['Pingo Doce'].price : null,
    // Store details object for tooltips
    ContinenteObj: d.Continente,
    'Pingo DoceObj': d['Pingo Doce']
  }));

  // Format date ticks for X-Axis (show day/month like "15 Jul")
  const formatXAxis = (tickItem) => {
    try {
      const parts = tickItem.split('-');
      if (parts.length === 3) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const day = parseInt(parts[2], 10);
        const month = months[parseInt(parts[1], 10) - 1];
        return `${day} ${month}`;
      }
    } catch (e) {}
    return tickItem;
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatXAxis}
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
            dy={10}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickFormatter={(v) => `€${v.toFixed(2)}`}
            tickLine={false}
            dx={-5}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>
                {value}
              </span>
            )}
          />
          <Line
            name="Continente"
            type="monotone"
            dataKey="Continente"
            stroke="#ff6b6b"
            strokeWidth={3}
            activeDot={{ r: 6 }}
            dot={{ r: 1 }}
            connectNulls
          />
          <Line
            name="Pingo Doce"
            type="monotone"
            dataKey="Pingo Doce"
            stroke="#51cf66"
            strokeWidth={3}
            activeDot={{ r: 6 }}
            dot={{ r: 1 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
