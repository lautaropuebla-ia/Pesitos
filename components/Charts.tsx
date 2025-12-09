import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Transaction, TransactionType } from '../types';

interface ChartsProps {
  transactions: Transaction[];
}

const COLORS = ['#0A84FF', '#FF375F', '#30D158', '#FF9F0A', '#BF5AF2', '#64D2FF'];

const Charts: React.FC<ChartsProps> = ({ transactions }) => {
  const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
  
  // Prepare Category Data
  const categoryData = expenses.reduce((acc, curr) => {
    const found = acc.find(item => item.name === curr.category);
    if (found) {
      found.value += curr.amount;
    } else {
      acc.push({ name: curr.category, value: curr.amount });
    }
    return acc;
  }, [] as { name: string; value: number }[]).sort((a, b) => b.value - a.value).slice(0, 5);

  // Prepare Daily Data (Last 7 days)
  const dailyDataMap = new Map<string, number>();
  const today = new Date();
  for(let i=6; i>=0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const str = d.toLocaleDateString('es-AR', { weekday: 'short' });
      dailyDataMap.set(str, 0);
  }

  expenses.forEach(t => {
      const d = new Date(t.date);
      // Only check if within last 7 days roughly
      if ((today.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 7) {
          const str = d.toLocaleDateString('es-AR', { weekday: 'short' });
          if (dailyDataMap.has(str)) {
              dailyDataMap.set(str, (dailyDataMap.get(str) || 0) + t.amount);
          }
      }
  });

  const dailyData = Array.from(dailyDataMap).map(([name, value]) => ({ name, amount: value }));

  if (transactions.length === 0) {
      return <div className="text-zinc-500 text-center text-sm py-4">No hay datos para mostrar gráficos.</div>
  }

  return (
    <div className="space-y-6">
      
      {/* Category Pie Chart */}
      <div className="bg-[#1C1C1E] p-5 rounded-3xl">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Gastos por Categoría</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 justify-center mt-4">
            {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-md">
                    <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    {entry.name}
                </div>
            ))}
        </div>
      </div>

      {/* Weekly Trend Bar Chart */}
      <div className="bg-[#1C1C1E] p-5 rounded-3xl">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Últimos 7 Días</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} dy={10} />
              <YAxis hide />
              <Tooltip 
                cursor={{fill: 'rgba(255,255,255,0.05)', radius: 4}}
                contentStyle={{ backgroundColor: '#2C2C2E', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.5)', color: '#fff' }} 
                formatter={(value: number) => `$${value.toLocaleString('es-AR')}`}
                labelStyle={{ color: '#a1a1aa' }}
              />
              <Bar dataKey="amount" fill="#0A84FF" radius={[4, 4, 4, 4]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Charts;