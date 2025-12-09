import React from 'react';
import { X, Check, Calendar, ArrowRight } from 'lucide-react';
import { RecurringTransaction, TransactionType } from '../types';

interface RecurringSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: RecurringTransaction[];
  monthName: string;
}

const RecurringSuggestionModal: React.FC<RecurringSuggestionModalProps> = ({ isOpen, onClose, onConfirm, items, monthName }) => {
  if (!isOpen) return null;

  const totalIncome = items.filter(i => i.type === TransactionType.INCOME).reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = items.filter(i => i.type === TransactionType.EXPENSE).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1C1C1E] w-full max-w-sm rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
        
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
             <Calendar size={24} />
             <span className="text-xs font-bold uppercase tracking-widest">Nuevo Mes Detectado</span>
          </div>
          <h2 className="text-xl font-bold text-white leading-tight mb-2">
            ¿Preparar presupuesto de {monthName}?
          </h2>
          <p className="text-zinc-400 text-sm">
            Tienes {items.length} movimientos recurrentes listos para añadirse a este mes.
          </p>
        </div>

        <div className="max-h-[30vh] overflow-y-auto px-6 space-y-2 no-scrollbar">
            {items.map(item => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${item.type === TransactionType.INCOME ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-zinc-300">{item.name}</span>
                    </div>
                    <span className={`text-sm font-medium ${item.type === TransactionType.INCOME ? 'text-green-400' : 'text-white'}`}>
                        ${item.amount.toLocaleString('es-AR')}
                    </span>
                </div>
            ))}
        </div>

        <div className="px-6 py-4 bg-[#2C2C2E]/50 mt-2">
            <div className="flex justify-between text-xs text-zinc-500 mb-4">
                <span>Resumen:</span>
                <div className="flex gap-3">
                    <span className="text-green-500">+{totalIncome}</span>
                    <span className="text-red-400">-{totalExpense}</span>
                </div>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl text-zinc-400 font-medium text-sm hover:bg-white/5 transition-colors"
                >
                    Saltar
                </button>
                <button 
                    onClick={onConfirm}
                    className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                >
                    <Check size={16} />
                    Añadir al Mes
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RecurringSuggestionModal;