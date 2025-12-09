import React from 'react';
import { Transaction, TransactionType } from '../types';
import { Tag, Edit2, Trash2 } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  getCategoryEmoji: (cat: string) => string;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, getCategoryEmoji, onEdit, onDelete }) => {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p className="text-lg font-medium">Sin movimientos</p>
        <p className="text-sm opacity-70">Toca el + para comenzar</p>
      </div>
    );
  }

  // Group by date (simple implementation)
  const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-3 pb-24">
      {sorted.map((t) => (
        <div key={t.id} className="bg-[#1C1C1E] p-4 rounded-2xl flex items-center justify-between group active:scale-[0.99] transition-all duration-200 border border-white/5 hover:border-white/10">
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center text-xl shadow-inner">
              {getCategoryEmoji(t.category)}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm capitalize truncate pr-2">{t.description}</h3>
              <div className="flex items-center text-xs text-zinc-400 gap-2 mt-0.5">
                <span className="font-medium capitalize flex-shrink-0">{t.category}</span>
                <span className="text-zinc-600">•</span>
                <span className="flex-shrink-0">{new Date(t.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</span>
                {t.tags.includes('recurrente') && (
                    <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">Fijo</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 pl-2">
            <div className="text-right">
              <p className={`font-semibold text-base whitespace-nowrap ${t.type === TransactionType.EXPENSE ? 'text-white' : 'text-green-500'}`}>
                {t.type === TransactionType.EXPENSE ? '-' : '+'}
                ${t.amount.toLocaleString('es-AR')}
              </p>
              <div className="text-[10px] text-zinc-500 capitalize mt-0.5">
                  {t.paymentMethod}
              </div>
            </div>
            {/* Actions: Visible on desktop hover, always present but subtle on mobile */}
            <div className="flex gap-1 ml-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                    className="p-2 text-zinc-500 hover:text-blue-400 bg-zinc-800/50 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                    <Edit2 size={14} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    className="p-2 text-zinc-500 hover:text-red-400 bg-zinc-800/50 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                    <Trash2 size={14} />
                </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionList;