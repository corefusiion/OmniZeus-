"use client";

import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export type MetricDef = {
  key: string;
  label: string;
  value: number | string;
  icon: React.ElementType | React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
};

export type KPIStripProps = {
  metrics: MetricDef[];
  onMetricClick?: (metricKey: string) => void;
};

export function KPIStrip({ metrics, onMetricClick }: KPIStripProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            onClick={() => onMetricClick?.(metric.key)}
            className={`flex items-center justify-between py-2.5 px-3.5 bg-white border border-[#E2E8F0] rounded-lg transition-all duration-150 ${
              onMetricClick ? 'cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/20 active:scale-[0.99]' : ''
            }`}
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate mb-0.5">
                {metric.label}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-[#0F172A] tracking-tight">{metric.value}</span>
                {metric.trend && (
                  <span className={`text-[10px] font-medium flex items-center ${
                    metric.trend === 'up' ? 'text-emerald-600' : 
                    metric.trend === 'down' ? 'text-rose-600' : 'text-slate-400'
                  }`}>
                    {metric.trend === 'up' && <ArrowUpRight size={12} className="mr-0.5 stroke-[1.5]" />}
                    {metric.trend === 'down' && <ArrowDownRight size={12} className="mr-0.5 stroke-[1.5]" />}
                  </span>
                )}
              </div>
            </div>

            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              {React.isValidElement(metric.icon) ? (
                metric.icon
              ) : metric.icon ? (
                React.createElement(metric.icon as any, { size: 14, strokeWidth: 1.5 })
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
