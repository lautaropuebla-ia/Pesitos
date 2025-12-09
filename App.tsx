import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, LayoutDashboard, PieChart, Target, User, Lightbulb, Trash2, Settings, Banknote, Calendar, Sparkles, Camera, Edit, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { Transaction, TransactionType, Currency, FinancialInsight, RecurringTransaction, UserFinancialProfile, UserSettings } from './types';
import TransactionList from './components/TransactionList';
import Charts from './components/Charts';
import EntryModal from './components/EntryModal';
import RecurringSuggestionModal from './components/RecurringSuggestionModal';
import { generateFinancialInsights, generateFinancialProfile } from './services/geminiService';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CATEGORIES = [
    'Alimentación', 'Transporte', 'Alquiler', 'Servicios', 'Entretenimiento', 'Salud', 'Educación', 'Otros', 'Ingreso'
];

const CATEGORY_EMOJIS: Record<string, string> = {
    'Alimentación': '🍔',
    'Transporte': '🚕',
    'Alquiler': '🏠',
    'Servicios': '💡',
    'Entretenimiento': '🎬',
    'Salud': '🏥',
    'Educación': '📚',
    'Otros': '📦',
    'Supermercado': '🛒',
    'Ropa': '👕',
    'Viajes': '✈️',
    'Regalos': '🎁',
    'Ingreso': '💰',
    'Sueldo': '💵',
    'Inversiones': '📈',
    'Freelance': '💻'
};

const getCategoryEmoji = (category: string) => {
    return CATEGORY_EMOJIS[category] || '💸';
};

// Helper to format month key "YYYY-MM"
const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'REPORTS' | 'BUDGETS' | 'USER'>('DASHBOARD');
  
  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringItems, setRecurringItems] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [userProfile, setUserProfile] = useState<UserFinancialProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({ name: 'Usuario', avatar: null });

  // UI State
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isRecurringSuggestionOpen, setIsRecurringSuggestionOpen] = useState(false);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Filters
  const [reportMonthKey, setReportMonthKey] = useState<string>(getMonthKey(new Date())); 
  
  // Export Filters
  const [exportStartDate, setExportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Inputs State
  const [newRecurringItem, setNewRecurringItem] = useState({ 
      name: '', 
      amount: '', 
      type: TransactionType.EXPENSE,
      category: DEFAULT_CATEGORIES[0] 
  });
  const [newCategory, setNewCategory] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- PERSISTENCE ---
  useEffect(() => {
    const saved = localStorage.getItem('pesitos_transactions');
    if (saved) setTransactions(JSON.parse(saved));

    const savedRecurring = localStorage.getItem('pesitos_fixed_costs'); 
    if (savedRecurring) {
        const parsed = JSON.parse(savedRecurring);
        const migrated = parsed.map((item: any) => ({
            ...item,
            type: item.type || TransactionType.EXPENSE
        }));
        setRecurringItems(migrated);
    }

    const savedCats = localStorage.getItem('pesitos_categories');
    if (savedCats) setCategories(JSON.parse(savedCats));

    const savedProfile = localStorage.getItem('pesitos_user_profile');
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));

    const savedSettings = localStorage.getItem('pesitos_user_settings');
    if (savedSettings) setUserSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => { localStorage.setItem('pesitos_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('pesitos_fixed_costs', JSON.stringify(recurringItems)); }, [recurringItems]);
  useEffect(() => { localStorage.setItem('pesitos_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { if(userProfile) localStorage.setItem('pesitos_user_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('pesitos_user_settings', JSON.stringify(userSettings)); }, [userSettings]);

  // --- RECURRING CHECK LOGIC ---
  useEffect(() => {
      // Check if we need to suggest recurring items for the current month
      const checkRecurring = () => {
          if (recurringItems.length === 0) return;

          const currentMonth = getMonthKey(new Date());
          const lastPrompt = localStorage.getItem('pesitos_last_recurring_prompt');

          // If we already prompted this month, check if we actually added them? 
          // Let's rely on the prompt flag first to avoid annoyance.
          if (lastPrompt === currentMonth) return;

          // Double check: Are there already recurring transactions for this month?
          const hasRecurringGenerated = transactions.some(t => 
              getMonthKey(new Date(t.date)) === currentMonth && t.tags.includes('recurrente')
          );

          if (!hasRecurringGenerated) {
              setIsRecurringSuggestionOpen(true);
          }
      };

      // Run check after initial load
      const timer = setTimeout(checkRecurring, 1000);
      return () => clearTimeout(timer);
  }, [recurringItems, transactions]);

  const confirmRecurringGeneration = () => {
      const currentMonth = getMonthKey(new Date());
      const now = new Date();
      
      const newTransactions: Transaction[] = recurringItems.map(item => ({
          id: uuidv4(),
          amount: item.amount,
          currency: item.currency,
          type: item.type,
          category: item.category,
          subcategory: 'Fijo',
          date: now.toISOString(),
          description: `${item.name} (Mensual)`,
          paymentMethod: 'Automático',
          projectId: 'personal',
          tags: ['recurrente']
      }));

      setTransactions(prev => [...newTransactions, ...prev]);
      localStorage.setItem('pesitos_last_recurring_prompt', currentMonth);
      setIsRecurringSuggestionOpen(false);
  };

  const closeRecurringSuggestion = () => {
      // Mark as prompted so we don't ask again this month even if they said no
      localStorage.setItem('pesitos_last_recurring_prompt', getMonthKey(new Date()));
      setIsRecurringSuggestionOpen(false);
  };

  // --- DATA PROCESSING ---

  // Dashboard always shows CURRENT MONTH
  const currentMonthKey = getMonthKey(new Date());
  
  const currentMonthTransactions = useMemo(() => {
      return transactions.filter(t => getMonthKey(new Date(t.date)) === currentMonthKey);
  }, [transactions, currentMonthKey]);

  // Reports show SELECTED MONTH
  const reportTransactions = useMemo(() => {
      return transactions.filter(t => getMonthKey(new Date(t.date)) === reportMonthKey);
  }, [transactions, reportMonthKey]);

  // Calculations for Dashboard
  const dashboardTotalExpense = useMemo(() => 
    currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0),
  [currentMonthTransactions]);

  const dashboardTotalIncome = useMemo(() => 
    currentMonthTransactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0),
  [currentMonthTransactions]);

  // Budget Calculations
  // Total Fixed (Just for display breakdown, derived from config)
  const totalFixedExpensesConfig = useMemo(() => 
      recurringItems.filter(ri => ri.isEnabled && ri.type === TransactionType.EXPENSE).reduce((sum, ri) => sum + ri.amount, 0), 
  [recurringItems]);

  const totalFixedIncomeConfig = useMemo(() => 
      recurringItems.filter(ri => ri.isEnabled && ri.type === TransactionType.INCOME).reduce((sum, ri) => sum + ri.amount, 0), 
  [recurringItems]);

  // Grand Totals from REAL transactions
  const grandTotalIncome = dashboardTotalIncome;
  const grandTotalExpenses = dashboardTotalExpense;
  const grandTotalBalance = grandTotalIncome - grandTotalExpenses;

  // Analyze Real Data for breakdown
  const realFixedExpenses = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE && t.tags.includes('recurrente'))
    .reduce((sum, t) => sum + t.amount, 0);

  const realVariableExpenses = currentMonthTransactions
    .filter(t => t.type === TransactionType.EXPENSE && !t.tags.includes('recurrente'))
    .reduce((sum, t) => sum + t.amount, 0);

  // --- ACTIONS ---

  const handleSaveTransaction = (transaction: Transaction) => {
    setTransactions(prev => {
        // Check if updating an existing transaction
        const index = prev.findIndex(t => t.id === transaction.id);
        if (index >= 0) {
            const updated = [...prev];
            updated[index] = transaction;
            return updated;
        }
        // Else add new
        return [transaction, ...prev];
    });
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
      setEditingTransaction(transaction);
      setIsEntryModalOpen(true);
  };

  const handleDeleteTransaction = (id: string) => {
      if (confirm("¿Estás seguro de eliminar esta transacción?")) {
          setTransactions(prev => prev.filter(t => t.id !== id));
      }
  };

  const handleModalClose = () => {
      setIsEntryModalOpen(false);
      setEditingTransaction(null);
  };

  const addRecurringItem = () => {
    if (!newRecurringItem.name || !newRecurringItem.amount) return;
    
    // Ensure Income is always category 'Ingreso'
    const finalCategory = newRecurringItem.type === TransactionType.INCOME ? 'Ingreso' : newRecurringItem.category;

    const item: RecurringTransaction = {
        id: uuidv4(),
        name: newRecurringItem.name,
        amount: parseFloat(newRecurringItem.amount),
        currency: Currency.ARS,
        type: newRecurringItem.type,
        category: finalCategory,
        isEnabled: true
    };
    setRecurringItems([...recurringItems, item]);
    setNewRecurringItem({ ...newRecurringItem, name: '', amount: '' });
  };

  const removeRecurringItem = (id: string) => setRecurringItems(recurringItems.filter(ri => ri.id !== id));

  const addCategory = () => {
      if(newCategory && !categories.includes(newCategory)) {
          setCategories([...categories, newCategory]);
          setNewCategory('');
      }
  };
  
  const removeCategory = (cat: string) => {
      if (cat === 'Ingreso') {
          alert("La categoría Ingreso no se puede eliminar.");
          return;
      }
      if (confirm(`¿Eliminar categoría "${cat}"?`)) setCategories(categories.filter(c => c !== cat));
  };

  const generateProfile = async () => {
      setProfileLoading(true);
      const profile = await generateFinancialProfile(transactions);
      if (profile) setUserProfile(profile);
      setProfileLoading(false);
  };

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setUserSettings(prev => ({ ...prev, avatar: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const downloadReport = () => {
    const start = new Date(exportStartDate).getTime();
    const end = new Date(exportEndDate).getTime();

    const filtered = transactions.filter(t => {
        const d = new Date(t.date).getTime();
        return d >= start && d <= end + 86400000; // Include full end day
    });

    if (filtered.length === 0) {
        alert("No hay transacciones registradas en ese rango de fechas.");
        return;
    }

    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Fecha,Tipo,Monto,Moneda,Categoria,Subcategoria,Descripcion,MetodoPago\n";

    filtered.forEach(t => {
        const row = [
            new Date(t.date).toLocaleDateString('es-AR'),
            t.type,
            t.amount,
            t.currency,
            t.category,
            t.subcategory,
            `"${t.description.replace(/"/g, '""')}"`, // Escape quotes
            t.paymentMethod
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pesitos_Reporte_${exportStartDate}_${exportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Reports Insights when tab changes
  useEffect(() => {
    if (activeTab === 'REPORTS' && reportTransactions.length > 0) {
      setInsightsLoading(true);
      generateFinancialInsights(reportTransactions)
        .then(data => setInsights(data))
        .catch(err => console.error(err))
        .finally(() => setInsightsLoading(false));
    }
  }, [activeTab, reportMonthKey]);

  // Available Months for Selector
  const availableMonths = useMemo(() => {
      const months = new Set<string>();
      transactions.forEach(t => months.add(getMonthKey(new Date(t.date))));
      months.add(currentMonthKey); 
      return Array.from(months).sort().reverse();
  }, [transactions, currentMonthKey]);

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Top Navigation / Header */}
      <header className="bg-black/80 backdrop-blur-xl sticky top-0 z-30 border-b border-white/10 px-4 py-4 md:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className="bg-blue-600 text-white p-2 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.5)]">
             <Banknote size={20} />
           </div>
           <h1 className="text-xl font-bold tracking-tight text-white">Pesitos</h1>
        </div>
        
        {/* User Avatar Tiny */}
        <div 
            onClick={() => setActiveTab('USER')}
            className="w-9 h-9 bg-[#1C1C1E] rounded-full flex items-center justify-center text-blue-500 font-bold border border-white/10 overflow-hidden cursor-pointer active:scale-90 transition-transform"
        >
             {userSettings.avatar ? (
                 <img src={userSettings.avatar} alt="User" className="w-full h-full object-cover" />
             ) : (
                 <span className="text-sm">{userSettings.name.charAt(0).toUpperCase()}</span>
             )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 space-y-6 pb-24">
        
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium mb-2 pl-1">
                <Calendar size={16} />
                <span className="uppercase tracking-wide text-xs">Resumen {new Date().toLocaleString('es-AR', { month: 'long' })}</span>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1C1C1E] p-5 rounded-3xl text-white border border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Target size={40} />
                 </div>
                <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Gastos</p>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">$ {dashboardTotalExpense.toLocaleString('es-AR')}</h2>
              </div>
              <div className="bg-[#1C1C1E] p-5 rounded-3xl text-white border border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                     <Banknote size={40} />
                 </div>
                 <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Ingresos</p>
                 <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-green-500">+$ {dashboardTotalIncome.toLocaleString('es-AR')}</h2>
              </div>
            </div>

            {/* Quick Balance */}
             <div className="bg-[#1C1C1E] p-5 rounded-3xl border border-white/5 flex justify-between items-center">
                <span className="text-zinc-300 font-medium">Balance Neto</span>
                <span className={`text-xl font-bold ${(dashboardTotalIncome - dashboardTotalExpense) >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                    $ {(dashboardTotalIncome - dashboardTotalExpense).toLocaleString('es-AR')}
                </span>
             </div>

            {/* Recent Transactions Header */}
            <div className="flex justify-between items-center mt-6 mb-2 pl-1">
              <h3 className="font-bold text-lg text-white">Movimientos Recientes</h3>
            </div>

            <TransactionList 
                transactions={currentMonthTransactions} 
                getCategoryEmoji={getCategoryEmoji} 
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
            />
          </div>
        )}

        {activeTab === 'REPORTS' && (
           <div className="space-y-6 animate-fade-in">
              
              {/* Month Selector */}
              <div className="flex justify-between items-center bg-[#1C1C1E] p-4 rounded-3xl border border-white/5">
                  <span className="text-zinc-400 font-medium ml-2">Mes:</span>
                  <select 
                    value={reportMonthKey} 
                    onChange={(e) => setReportMonthKey(e.target.value)}
                    className="bg-black text-white border border-white/10 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none font-bold min-w-[150px]"
                  >
                      {availableMonths.map(m => (
                          <option key={m} value={m}>
                              {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()}
                          </option>
                      ))}
                  </select>
              </div>

              {/* Monthly Summary Strip */}
               <div className="grid grid-cols-3 gap-2 text-center">
                   <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/5">
                       <div className="text-[10px] text-green-500 font-bold uppercase mb-1">Ingresos</div>
                       <div className="font-bold text-white text-sm">
                           $ {reportTransactions.filter(t => t.type === 'INCOME').reduce((s,t)=>s+t.amount,0).toLocaleString('es-AR')}
                       </div>
                   </div>
                   <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/5">
                       <div className="text-[10px] text-red-500 font-bold uppercase mb-1">Gastos</div>
                       <div className="font-bold text-white text-sm">
                           $ {reportTransactions.filter(t => t.type === 'EXPENSE').reduce((s,t)=>s+t.amount,0).toLocaleString('es-AR')}
                       </div>
                   </div>
                   <div className="bg-[#1C1C1E] p-3 rounded-2xl border border-white/5">
                       <div className="text-[10px] text-blue-500 font-bold uppercase mb-1">Balance</div>
                       <div className="font-bold text-white text-sm">
                           $ {(reportTransactions.filter(t => t.type === 'INCOME').reduce((s,t)=>s+t.amount,0) - reportTransactions.filter(t => t.type === 'EXPENSE').reduce((s,t)=>s+t.amount,0)).toLocaleString('es-AR')}
                       </div>
                   </div>
               </div>
              
              {/* Excel Export Section */}
              <div className="bg-[#1C1C1E] rounded-3xl p-5 border border-white/5">
                  <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <Download size={16} /> Exportar Reporte
                  </h3>
                  <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                          <div className="flex-1">
                              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Desde</label>
                              <input 
                                  type="date" 
                                  value={exportStartDate}
                                  onChange={e => setExportStartDate(e.target.value)}
                                  className="w-full bg-black text-white p-2 rounded-xl text-sm border border-white/10 outline-none focus:border-blue-500"
                                  style={{colorScheme: 'dark'}}
                              />
                          </div>
                          <div className="flex-1">
                              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Hasta</label>
                              <input 
                                  type="date" 
                                  value={exportEndDate}
                                  onChange={e => setExportEndDate(e.target.value)}
                                  className="w-full bg-black text-white p-2 rounded-xl text-sm border border-white/10 outline-none focus:border-blue-500"
                                  style={{colorScheme: 'dark'}}
                              />
                          </div>
                      </div>
                      <button 
                          onClick={downloadReport}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors border border-white/5"
                      >
                          <Download size={16} /> Descargar Excel (.csv)
                      </button>
                      <p className="text-[10px] text-zinc-600 text-center mt-1">Exporta las transacciones actuales.</p>
                  </div>
              </div>

              {/* AI Insights */}
              <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden border border-white/10">
                 <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>
                 <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="text-yellow-400" size={20} />
                      <h3 className="font-bold text-lg">Insights IA</h3>
                   </div>
                   {insightsLoading ? (
                     <p className="text-blue-200 animate-pulse text-sm">Analizando gastos...</p>
                   ) : (
                     <div className="space-y-4">
                        {insights.length > 0 ? insights.map((insight, idx) => (
                           <div key={idx} className="bg-black/20 backdrop-blur-md p-3 rounded-xl border border-white/10">
                              <h4 className="font-semibold text-yellow-400 text-sm mb-1">{insight.title}</h4>
                              <p className="text-xs text-blue-100 leading-relaxed opacity-90">{insight.description}</p>
                           </div>
                        )) : <p className="text-blue-200 text-sm">No hay suficientes datos este mes.</p>}
                     </div>
                   )}
                 </div>
              </div>
              
              <Charts transactions={reportTransactions} />
           </div>
        )}

        {activeTab === 'BUDGETS' && (
            <div className="space-y-8 animate-fade-in">
               
               {/* Budget Summary Logic */}
               <div className="bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <Target size={20} className="text-blue-500"/>
                      Presupuesto Total (Mes Actual)
                  </h3>
                  
                  <div className="space-y-4">
                      {/* Total Income Block */}
                      <div className="bg-green-500/10 rounded-xl border border-green-500/20 p-4">
                           <div className="flex justify-between items-center mb-2">
                               <span className="text-green-400 font-bold flex items-center gap-2">
                                   <ArrowUpCircle size={18} /> INGRESOS TOTALES
                               </span>
                               <span className="text-green-400 font-bold text-xl">$ {grandTotalIncome.toLocaleString('es-AR')}</span>
                           </div>
                           <div className="flex justify-between text-xs text-zinc-400 px-1">
                               <span>Fijos (Estimado): $ {totalFixedIncomeConfig.toLocaleString('es-AR')}</span>
                           </div>
                      </div>

                       <div className="flex justify-center items-center text-zinc-600">
                            <span className="text-2xl">-</span>
                       </div>

                      {/* Total Expenses Block */}
                      <div className="bg-red-500/10 rounded-xl border border-red-500/20 p-4">
                           <div className="flex justify-between items-center mb-2">
                               <span className="text-red-400 font-bold flex items-center gap-2">
                                   <ArrowDownCircle size={18} /> GASTOS TOTALES
                               </span>
                               <span className="text-red-400 font-bold text-xl">$ {grandTotalExpenses.toLocaleString('es-AR')}</span>
                           </div>
                           <div className="flex justify-between text-xs text-zinc-400 px-1">
                               <span>Fijos (Estimado): $ {totalFixedExpensesConfig.toLocaleString('es-AR')}</span>
                               <span>Fijos (Pagados): $ {realFixedExpenses.toLocaleString('es-AR')}</span>
                               <span>Variables: $ {realVariableExpenses.toLocaleString('es-AR')}</span>
                           </div>
                      </div>

                       <div className="flex justify-center items-center text-zinc-600">
                            <span className="text-2xl">=</span>
                       </div>

                       {/* Result Block */}
                      <div className="flex justify-between items-center p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                          <div className="flex flex-col">
                              <span className="font-bold text-lg">Resultado Final</span>
                              <span className="text-xs text-blue-300/70">Ahorro / Disponible</span>
                          </div>
                          <span className={`font-bold text-2xl ${grandTotalBalance >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                              $ {grandTotalBalance.toLocaleString('es-AR')}
                          </span>
                      </div>
                  </div>
               </div>
               
               {/* Recurring Items Manager */}
               <div className="bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4">Movimientos Recurrentes Mensuales</h3>
                  <p className="text-xs text-zinc-500 mb-4">Estos ítems se te sugerirán para añadir al inicio de cada mes.</p>
                  
                  <div className="flex flex-col gap-3 mb-4">
                      <div className="flex gap-2 bg-black/50 p-1 rounded-xl">
                          <button 
                            onClick={() => setNewRecurringItem({...newRecurringItem, type: TransactionType.INCOME, category: 'Ingreso'})}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${newRecurringItem.type === TransactionType.INCOME ? 'bg-green-600 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
                          >
                              Ingreso Fijo
                          </button>
                          <button 
                            onClick={() => setNewRecurringItem({...newRecurringItem, type: TransactionType.EXPENSE, category: DEFAULT_CATEGORIES[0]})}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${newRecurringItem.type === TransactionType.EXPENSE ? 'bg-red-600 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}
                          >
                              Gasto Fijo
                          </button>
                      </div>
                      <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Nombre (ej. Sueldo, Alquiler)" 
                            className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500 text-white"
                            value={newRecurringItem.name}
                            onChange={e => setNewRecurringItem({...newRecurringItem, name: e.target.value})}
                        />
                        <input 
                            type="number" 
                            placeholder="Monto" 
                            className="w-24 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500 text-white"
                            value={newRecurringItem.amount}
                            onChange={e => setNewRecurringItem({...newRecurringItem, amount: e.target.value})}
                        />
                        <button onClick={addRecurringItem} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-colors">
                            <Plus size={20} />
                        </button>
                      </div>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                      {recurringItems.map(ri => (
                          <div key={ri.id} className="flex justify-between items-center p-3 bg-[#2C2C2E] rounded-xl border border-white/5">
                              <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${ri.type === TransactionType.INCOME ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <div>
                                    <div className="font-medium text-white">{ri.name}</div>
                                    <div className="text-xs text-zinc-500">{ri.category}</div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <span className={`font-bold ${ri.type === TransactionType.INCOME ? 'text-green-400' : 'text-white'}`}>
                                      {ri.type === TransactionType.INCOME ? '+' : '-'} $ {ri.amount.toLocaleString('es-AR')}
                                  </span>
                                  <button onClick={() => removeRecurringItem(ri.id)} className="text-zinc-500 hover:text-red-500 transition-colors">
                                      <Trash2 size={16} />
                                  </button>
                              </div>
                          </div>
                      ))}
                      {recurringItems.length === 0 && <p className="text-sm text-zinc-600 text-center italic py-2">No hay movimientos recurrentes.</p>}
                  </div>
               </div>
            </div>
        )}

        {activeTab === 'USER' && (
            <div className="space-y-6 animate-fade-in pb-24">
                <div className="text-center py-6">
                    <div className="relative w-32 h-32 mx-auto mb-4 group">
                        <div 
                            onClick={handleAvatarClick}
                            className="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center text-blue-500 font-bold text-4xl border-4 border-[#1C1C1E] shadow-2xl overflow-hidden cursor-pointer"
                        >
                            {userSettings.avatar ? (
                                <img src={userSettings.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span>{userSettings.name.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div 
                            onClick={handleAvatarClick} 
                            className="absolute bottom-1 right-1 bg-blue-600 p-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-500 transition-colors"
                        >
                            <Camera size={18} className="text-white" />
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleAvatarChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>
                    
                    <div className="flex items-center justify-center gap-2">
                        <input 
                            type="text" 
                            value={userSettings.name}
                            onChange={(e) => setUserSettings(prev => ({ ...prev, name: e.target.value }))}
                            className="text-2xl font-bold text-white text-center bg-transparent border-b border-transparent focus:border-blue-500 outline-none w-auto max-w-[200px]"
                        />
                        <Edit size={16} className="text-zinc-500" />
                    </div>
                    <p className="text-zinc-500 mt-1">Usuario Personal</p>
                </div>

                {/* Category Manager */}
               <div className="bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Settings size={20} className="text-zinc-500"/>
                      Gestionar Categorías
                  </h3>
                  <div className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder="Nueva Categoría..." 
                        className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-3 text-sm outline-none focus:border-blue-500 text-white"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                      />
                      <button onClick={addCategory} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 transition-colors">
                          <Plus size={20} />
                      </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                          <span key={cat} className="inline-flex items-center gap-1 bg-zinc-800 px-3 py-1.5 rounded-full text-sm text-zinc-300 border border-white/5">
                              <span className="mr-1">{getCategoryEmoji(cat)}</span>
                              {cat}
                              <button onClick={() => removeCategory(cat)} className="ml-1 text-zinc-500 hover:text-red-400">
                                  <Trash2 size={12} className="w-3 h-3" />
                              </button>
                          </span>
                      ))}
                  </div>
               </div>

                {/* AI Profile Section */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                             <Sparkles className="text-yellow-300" />
                             <h3 className="font-bold text-xl">Perfil Financiero</h3>
                        </div>
                        <button 
                            onClick={generateProfile}
                            disabled={profileLoading}
                            className="bg-black/20 hover:bg-black/30 text-white text-xs px-3 py-1.5 rounded-full transition-colors font-medium border border-white/30 backdrop-blur-sm"
                        >
                            {profileLoading ? 'Generando...' : 'Actualizar'}
                        </button>
                    </div>

                    {!userProfile ? (
                        <div className="text-center py-6 text-indigo-100">
                            <p>Aún no tienes un perfil generado.</p>
                            <p className="text-sm mt-2 opacity-75">Necesitamos al menos 5 transacciones para analizar tu estilo.</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            <h4 className="text-2xl font-bold text-yellow-300 mb-2">{userProfile.personaTitle}</h4>
                            <p className="text-indigo-100 leading-relaxed mb-4 italic">"{userProfile.description}"</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                    <h5 className="font-semibold text-green-300 text-sm mb-2">Puntos Fuertes</h5>
                                    <ul className="list-disc list-inside text-xs text-indigo-50 space-y-1">
                                        {userProfile.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                                    <h5 className="font-semibold text-red-300 text-sm mb-2">A Mejorar</h5>
                                    <ul className="list-disc list-inside text-xs text-indigo-50 space-y-1">
                                        {userProfile.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-[#1C1C1E] rounded-3xl p-6 shadow-sm border border-white/5">
                    <h3 className="font-bold text-white mb-4">Datos Generales</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between py-3 border-b border-white/5">
                            <span className="text-zinc-400">Total Transacciones</span>
                            <span className="font-medium text-white">{transactions.length}</span>
                        </div>
                        <div className="flex justify-between py-3 border-b border-white/5">
                            <span className="text-zinc-400">Fecha Primer Movimiento</span>
                            <span className="font-medium text-white">
                                {transactions.length > 0 
                                ? new Date(Math.min(...transactions.map(t=>new Date(t.date).getTime()))).toLocaleDateString('es-AR')
                                : '-'}
                            </span>
                        </div>
                        <div className="flex justify-between py-3">
                            <span className="text-zinc-400">Moneda Principal</span>
                            <span className="font-medium text-white">Pesos Argentinos (ARS)</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => {
                        if(confirm("¿Estás seguro de borrar todos los datos? Esta acción no se puede deshacer.")) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="w-full py-4 text-red-500 font-medium bg-red-500/10 rounded-2xl hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                    Borrar Todos los Datos
                </button>
            </div>
        )}

      </main>

      {/* FAB (Floating Action Button) */}
      <button 
        onClick={() => setIsEntryModalOpen(true)}
        className="fixed bottom-24 right-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full p-4 shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-transform hover:scale-110 z-40 active:scale-95 border border-white/20"
      >
        <Plus size={32} />
      </button>

      {/* Bottom Navigation (Persistent on all devices) */}
      <nav className="fixed bottom-0 left-0 w-full bg-[#1C1C1E]/90 backdrop-blur-xl border-t border-white/10 z-30 pb-safe">
        <div className="max-w-4xl mx-auto flex justify-between items-center px-6 py-2">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'DASHBOARD' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-medium">Panel</span>
          </button>
          <button 
            onClick={() => setActiveTab('REPORTS')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'REPORTS' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <PieChart size={24} />
            <span className="text-[10px] font-medium">Reportes</span>
          </button>
          <button 
            onClick={() => setActiveTab('BUDGETS')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'BUDGETS' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Target size={24} />
            <span className="text-[10px] font-medium">Presupuesto</span>
          </button>
          <button 
              onClick={() => setActiveTab('USER')}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${activeTab === 'USER' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <User size={24} />
            <span className="text-[10px] font-medium">Usuario</span>
          </button>
        </div>
      </nav>

      <EntryModal 
        isOpen={isEntryModalOpen} 
        onClose={handleModalClose}
        onSave={handleSaveTransaction}
        activeProjectId={'personal'}
        categories={categories}
        initialTransaction={editingTransaction}
      />

      <RecurringSuggestionModal 
        isOpen={isRecurringSuggestionOpen}
        onClose={closeRecurringSuggestion}
        onConfirm={confirmRecurringGeneration}
        items={recurringItems}
        monthName={new Date().toLocaleString('es-AR', { month: 'long' })}
      />
    </div>
  );
}

export default App;