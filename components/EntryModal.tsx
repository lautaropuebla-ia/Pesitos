import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Send, Loader2, Check, Edit2, Calendar, Tag, CreditCard, DollarSign, List, AlertCircle } from 'lucide-react';
import { parseTransactionInput } from '../services/geminiService';
import { Transaction, TransactionType, Currency, ParsingResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  activeProjectId: string;
  categories: string[];
  initialTransaction?: Transaction | null;
}

const PAYMENT_METHODS = ['Efectivo', 'Crédito', 'Débito', 'Transferencia', 'Otro'];

const EntryModal: React.FC<EntryModalProps> = ({ isOpen, onClose, onSave, activeProjectId, categories, initialTransaction }) => {
  const [mode, setMode] = useState<'INPUT' | 'PROCESSING' | 'REVIEW'>('INPUT');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // State for the editable form
  const [formData, setFormData] = useState<Partial<Transaction>>({});
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTransaction) {
        // Edit Mode
        setMode('REVIEW');
        setFormData({ ...initialTransaction });
      } else {
        // New Mode
        setMode('INPUT');
        setInputText('');
        setFormData({});
      }
    }
  }, [isOpen, initialTransaction]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("El reconocimiento de voz no es compatible con este navegador. Por favor escribe.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'es-AR'; // Set to Argentine Spanish

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      handleProcess(transcript);
    };

    recognitionRef.current.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleProcess = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    setMode('PROCESSING');
    try {
      const result = await parseTransactionInput(textToProcess);
      
      const isIncome = result.type === 'INCOME';

      // Initialize form data with AI result
      setFormData({
        amount: result.amount,
        currency: (result.currency as Currency) || Currency.ARS,
        type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
        // Force 'Ingreso' category if income. Keep specific as subcategory.
        category: isIncome ? 'Ingreso' : (categories.includes(result.category) ? result.category : categories[0]),
        subcategory: isIncome && result.category !== 'Ingreso' ? result.category : result.subcategory,
        date: result.date || new Date().toISOString(),
        description: result.description,
        paymentMethod: PAYMENT_METHODS.includes(result.paymentMethod) ? result.paymentMethod : 'Efectivo', // Default to Efectivo if unknown
        tags: result.tags || []
      });

      setMode('REVIEW');
    } catch (error) {
      console.error(error);
      setMode('INPUT');
      alert("No se pudo entender. Por favor intenta de nuevo.");
    }
  };

  const isFormValid = () => {
    return (
      formData.amount && 
      formData.date && 
      formData.category && 
      formData.type && 
      formData.paymentMethod && 
      formData.description
    );
  };

  const handleConfirm = () => {
    if (isFormValid()) {
      const transaction: Transaction = {
        id: initialTransaction ? initialTransaction.id : uuidv4(), // Keep ID if editing
        amount: Number(formData.amount),
        currency: formData.currency || Currency.ARS,
        type: formData.type || TransactionType.EXPENSE,
        category: formData.category || 'Otros',
        subcategory: formData.subcategory || '',
        date: formData.date || new Date().toISOString(),
        description: formData.description || '',
        paymentMethod: formData.paymentMethod || 'Efectivo',
        projectId: activeProjectId,
        tags: formData.tags || []
      };
      onSave(transaction);
      onClose();
    } else {
        alert("Por favor completa todos los campos obligatorios.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#1C1C1E] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#1C1C1E]">
          <h2 className="font-semibold text-lg text-white">
            {initialTransaction ? 'Editar Transacción' : (mode === 'REVIEW' ? 'Confirmar' : 'Nueva Transacción')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
          {mode === 'INPUT' && (
            <div className="flex flex-col gap-6">
               <textarea
                className="w-full p-4 text-lg border border-white/10 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-black text-white placeholder-zinc-600 transition-all"
                rows={4}
                placeholder="Ej: Gasté $2500 en almuerzo en Palermo ayer con tarjeta..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              
              <div className="flex justify-center gap-4">
                <button 
                  onClick={isListening ? stopListening : startListening}
                  className={`p-6 rounded-full transition-all duration-300 shadow-lg ${
                    isListening 
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-900' 
                    : 'bg-[#2C2C2E] text-blue-500 border border-white/5 hover:bg-[#3A3A3C]'
                  }`}
                >
                  <Mic size={32} />
                </button>
              </div>
              <p className="text-center text-sm text-zinc-500">
                {isListening ? 'Escuchando...' : 'Toca para hablar o escribe arriba'}
              </p>
            </div>
          )}

          {mode === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 size={48} className="animate-spin text-blue-500" />
              <p className="text-zinc-400 font-medium">Analizando movimiento...</p>
            </div>
          )}

          {mode === 'REVIEW' && (
            <div className="space-y-4">
              {/* Amount and Description */}
              <div className="bg-[#2C2C2E] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-center gap-1 mb-2">
                    <span className="text-2xl text-white font-bold">$</span>
                    <input 
                        type="number" 
                        value={formData.amount} 
                        onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                        className="text-3xl font-bold text-white bg-transparent text-center w-full outline-none border-b border-transparent focus:border-blue-500 placeholder-zinc-600"
                        placeholder="0"
                    />
                </div>
                <input 
                    type="text" 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full text-center text-blue-400 font-medium bg-transparent outline-none border-b border-transparent focus:border-blue-500 placeholder-zinc-500"
                    placeholder="Descripción"
                />
              </div>

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-1 gap-3">
                 
                 {/* Date */}
                 <div className="bg-[#2C2C2E] p-3 rounded-2xl border border-white/5 flex items-center gap-3">
                    <div className="p-2 bg-black rounded-lg text-zinc-400">
                        <Calendar size={18} />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Fecha *</label>
                        <input 
                            type="date" 
                            value={formData.date ? new Date(formData.date).toISOString().split('T')[0] : ''}
                            onChange={(e) => setFormData({...formData, date: new Date(e.target.value).toISOString()})}
                            className="w-full bg-transparent text-white font-medium outline-none text-sm dark-date-input"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                 </div>

                 {/* Category */}
                 <div className="bg-[#2C2C2E] p-3 rounded-2xl border border-white/5 flex items-center gap-3">
                    <div className="p-2 bg-black rounded-lg text-zinc-400">
                        <Tag size={18} />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Categoría *</label>
                        <select 
                            value={formData.category} 
                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                            className="w-full bg-transparent text-white font-medium outline-none text-sm appearance-none"
                        >
                            {categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                     {/* Type */}
                     <div className="bg-[#2C2C2E] p-3 rounded-2xl border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Tipo *</label>
                        <select 
                            value={formData.type} 
                            onChange={(e) => {
                                const newType = e.target.value as TransactionType;
                                setFormData({
                                    ...formData, 
                                    type: newType,
                                    // Auto switch category if Income
                                    category: newType === TransactionType.INCOME ? 'Ingreso' : (categories[0] || 'Otros')
                                });
                            }}
                            className={`w-full bg-transparent font-bold outline-none text-sm ${formData.type === TransactionType.EXPENSE ? 'text-red-400' : 'text-green-400'}`}
                        >
                            <option value={TransactionType.EXPENSE} className="bg-black text-red-500">Gasto</option>
                            <option value={TransactionType.INCOME} className="bg-black text-green-500">Ingreso</option>
                        </select>
                     </div>

                     {/* Method */}
                     <div className="bg-[#2C2C2E] p-3 rounded-2xl border border-white/5">
                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block mb-1">Método *</label>
                        <select 
                            value={formData.paymentMethod} 
                            onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                            className="w-full bg-transparent text-white font-medium outline-none text-sm"
                        >
                            {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-black">{m}</option>)}
                        </select>
                     </div>
                 </div>
              </div>
              
              {!isFormValid() && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      <AlertCircle size={14} />
                      <span>Todos los campos son obligatorios.</span>
                  </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#1C1C1E] border-t border-white/10">
          {mode === 'INPUT' && (
             <button 
                onClick={() => handleProcess(inputText)}
                disabled={!inputText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/50"
             >
               <Send size={18} /> Procesar
             </button>
          )}
          {mode === 'REVIEW' && (
             <div className="flex gap-3">
                <button 
                    onClick={() => setMode('INPUT')}
                    className="flex-1 bg-[#2C2C2E] border border-white/5 hover:bg-[#3A3A3C] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
                >
                    <Edit2 size={18} /> {initialTransaction ? 'Descartar Cambios' : 'Volver'}
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={!isFormValid()}
                    className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:shadow-none text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/50 transition-all"
                >
                    <Check size={18} /> {initialTransaction ? 'Actualizar' : 'Guardar'}
                </button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntryModal;