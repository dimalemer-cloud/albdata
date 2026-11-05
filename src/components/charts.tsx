"use client";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DayPoint = { date: string; sent: number; opened: number; replied: number; clicked: number; bounced: number; interested: number };

export function DailyChart({ data, height = 260 }: { data: DayPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--brand))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="rgb(var(--brand))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="sent" name="Sent" stroke="rgb(var(--brand))" fill="url(#gSent)" strokeWidth={2} />
          <Area type="monotone" dataKey="opened" name="Opened" stroke="#f59e0b" fill="transparent" strokeWidth={2} />
          <Area type="monotone" dataKey="replied" name="Replied" stroke="#8b5cf6" fill="transparent" strokeWidth={2} />
          <Area type="monotone" dataKey="interested" name="Interested" stroke="#10b981" fill="transparent" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
