import React from 'react';
import { pct } from '../api.js';

export default function ConfidenceBar({ value, level, testid }) {
  return (
    <div className="conf" data-testid={testid || 'confidence-bar'}>
      <div className="conf-track">
        <div className={`conf-fill lvl-${level}`} style={{ width: pct(value) }} />
      </div>
      <span className="conf-num" data-testid="confidence-value">{pct(value)}</span>
    </div>
  );
}
