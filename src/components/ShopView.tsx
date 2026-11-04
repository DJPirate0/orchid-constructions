import React, { useState, useMemo } from 'react';
import { 
  Store, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Calendar, 
  Coffee, 
  HardHat, 
  Zap, 
  Building, 
  Truck, 
  Wrench, 
  BookOpen, 
  Fuel, 
  Tag, 
  Printer, 
  X, 
  Check, 
  Filter,
  DollarSign,
  TrendingDown,
  FileSpreadsheet
} from 'lucide-react';
import { ShopExpense, ShopExpenseCategory } from '../types/feed';
import { api } from '../services/api';

interface ShopViewProps {
  expenses: ShopExpense[];
  onRefresh: () => Promise<void>;
  userBalance?: number;
}

export const CATEGORY_CONFIG: Record<
  ShopExpenseCategory, 
  { label: string; urdu: string; icon: any; color: string; badge: string }
> = {
  'Chai & Refreshment': {
    label: 'Chai & Refreshment',
    urdu: 'چائے / کھانا',
    icon: Coffee,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
  },
  'Staff & Labor (Mazdoori)': {
    label: 'Staff & Labor (Mazdoori)',
    urdu: 'مزدوری / لوڈنگ',
    icon: HardHat,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
  },
  'Electricity & Utilities': {
    label: 'Electricity & Utilities',
    urdu: 'بجلی کا بل',
    icon: Zap,
    color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
  },
  'Shop Rent': {
    label: 'Shop Rent',
    urdu: 'دکان کا کرایہ',
    icon: Building,
    color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
  },
  'Transport & Carriage': {
    label: 'Transport & Carriage',
    urdu: 'گاڑی / رکشہ کرایہ',
    icon: Truck,
    color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300'
  },
  'Maintenance & Repairs': {
    label: 'Maintenance & Repairs',
    urdu: 'مرمت / دکان کا کام',
    icon: Wrench,
    color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
  },
  'Stationery & Packing': {
    label: 'Stationery & Packing',
    urdu: 'کھاتہ بک / تھیلے',
    icon: BookOpen,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
  },
  'Generator & Fuel': {
    label: 'Generator & Fuel',
    urdu: 'پیٹرول / ڈیزل',
    icon: Fuel,
    color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
  },
  'General & Misc': {
    label: 'General & Misc',
    urdu: 'متفرق اخراجات',
    icon: Tag,
    color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    badge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
  }
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as ShopExpenseCategory[];

export const ShopView: React.FC<ShopViewProps> = ({
  expenses = [],
  onRefresh
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'ALL' | 'CUSTOM'>('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ShopExpense | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dailySheetOpen, setDailySheetOpen] = useState(false);
  const [voucherExpense, setVoucherExpense] = useState<ShopExpense | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    date: string;
    title: string;
    category: ShopExpenseCategory;
    amount: string;
    paymentMethod: 'CASH' | 'ONLINE_BANK' | 'USER_BALANCE';
    paidTo: string;
    deductFromUserBalance: boolean;
    notes: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'Chai & Refreshment',
    amount: '',
    paymentMethod: 'CASH',
    paidTo: '',
    deductFromUserBalance: false,
    notes: ''
  });

  const [saving, setSaving] = useState(false);

  const formatPKR = (num: number = 0) => {
    return 'Rs. ' + Math.round(num).toLocaleString('en-US');
  };

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Key Totals
  const todayTotal = useMemo(() => {
    return expenses
      .filter(e => e.date === todayStr)
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses, todayStr]);

  const todayCount = useMemo(() => {
    return expenses.filter(e => e.date === todayStr).length;
  }, [expenses, todayStr]);

  const monthTotal = useMemo(() => {
    return expenses
      .filter(e => e.date && e.date.startsWith(currentMonthStr))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses, currentMonthStr]);

  const allTimeTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // Filtered expenses based on search, category and date
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // 1. Category
      if (selectedCategory !== 'ALL' && exp.category !== selectedCategory) {
        return false;
      }

      // 2. Date Filter
      if (dateFilter === 'TODAY') {
        if (exp.date !== todayStr) return false;
      } else if (dateFilter === 'YESTERDAY') {
        if (exp.date !== yesterdayStr) return false;
      } else if (dateFilter === 'THIS_WEEK') {
        const d = new Date(exp.date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - d.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return false;
      } else if (dateFilter === 'THIS_MONTH') {
        if (!exp.date.startsWith(currentMonthStr)) return false;
      } else if (dateFilter === 'CUSTOM') {
        if (customStartDate && exp.date < customStartDate) return false;
        if (customEndDate && exp.date > customEndDate) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = exp.title?.toLowerCase().includes(q);
        const matchPaidTo = exp.paidTo?.toLowerCase().includes(q);
        const matchCategory = exp.category?.toLowerCase().includes(q);
        const matchNotes = exp.notes?.toLowerCase().includes(q);
        const matchAmount = exp.amount?.toString().includes(q);
        if (!matchTitle && !matchPaidTo && !matchCategory && !matchNotes && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [expenses, selectedCategory, dateFilter, customStartDate, customEndDate, searchQuery, todayStr, yesterdayStr, currentMonthStr]);

  const filteredTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // Category breakdown for summary
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'General & Misc';
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += Number(exp.amount) || 0;
      map[cat].count += 1;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [filteredExpenses]);

  // Open Create Modal
  const handleOpenAddModal = (defaultCategory?: ShopExpenseCategory) => {
    setEditingExpense(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      title: '',
      category: defaultCategory || 'Chai & Refreshment',
      amount: '',
      paymentMethod: 'CASH',
      paidTo: '',
      deductFromUserBalance: false,
      notes: ''
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exp: ShopExpense) => {
    setEditingExpense(exp);
    setFormData({
      date: exp.date || new Date().toISOString().split('T')[0],
      title: exp.title || '',
      category: (exp.category as ShopExpenseCategory) || 'General & Misc',
      amount: exp.amount ? String(exp.amount) : '',
      paymentMethod: exp.paymentMethod || 'CASH',
      paidTo: exp.paidTo || '',
      deductFromUserBalance: !!exp.deductFromUserBalance,
      notes: exp.notes || ''
    });
    setModalOpen(true);
  };

  // Submit Expense Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid expense amount');
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter an expense title / description');
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        await api.updateShopExpense(editingExpense.id, {
          date: formData.date,
          title: formData.title.trim(),
          category: formData.category,
          amount: amt,
          paymentMethod: formData.paymentMethod,
          paidTo: formData.paidTo.trim(),
          deductFromUserBalance: formData.deductFromUserBalance,
          notes: formData.notes.trim()
        });
      } else {
        await api.createShopExpense({
          date: formData.date,
          title: formData.title.trim(),
          category: formData.category,
          amount: amt,
          paymentMethod: formData.paymentMethod,
          paidTo: formData.paidTo.trim(),
          deductFromUserBalance: formData.deductFromUserBalance,
          notes: formData.notes.trim()
        });
      }
      await onRefresh();
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save shop expense:', err);
      alert('Failed to save shop expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete
  const handleDeleteExpense = async (id: string) => {
    try {
      await api.deleteShopExpense(id);
      await onRefresh();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete shop expense:', err);
      alert('Failed to delete expense.');
    }
  };

  // Quick Amount Helper
  const handleAddAmount = (addVal: number) => {
    const current = parseFloat(formData.amount) || 0;
    setFormData({ ...formData, amount: String(current + addVal) });
  };

  const handleSetAmount = (val: number) => {
    setFormData({ ...formData, amount: String(val) });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Store className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Daily Shop Expenses
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
                دکان کے اخراجات
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Record and track daily shop expenditures (Chai, labor wages, bills, shop rent, transport, supplies)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Add Shop Expense</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
        
        {/* Today's Expenses */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Expenses
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
            {formatPKR(todayTotal)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>{todayCount} {todayCount === 1 ? 'entry' : 'entries'} recorded today</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{todayStr}</span>
          </div>
        </div>

        {/* This Month's Expenses */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              This Month ({new Date().toLocaleString('default', { month: 'short', year: 'numeric' })})
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {formatPKR(monthTotal)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total general shop spending this month
          </div>
        </div>

      </div>

      {/* Category Quick Chips & Breakdown */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Filter by Expense Category:</span>
          </span>

          {selectedCategory !== 'ALL' && (
            <button
              onClick={() => setSelectedCategory('ALL')}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
            >
              Reset to All Categories
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs font-bold'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Categories ({expenses.length})
          </button>

          {CATEGORIES.map(cat => {
            const cfg = CATEGORY_CONFIG[cat];
            const count = expenses.filter(e => e.category === cat).length;
            const Icon = cfg.icon;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? `${cfg.color} border-current shadow-xs font-bold ring-2 ring-amber-500/30`
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cfg.label}</span>
                <span className="text-[10px] opacity-75 font-normal">({cfg.urdu})</span>
                {count > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Filters & Search Controls */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">Time:</span>
          {(['TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'ALL', 'CUSTOM'] as const).map(df => (
            <button
              key={df}
              onClick={() => setDateFilter(df)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                dateFilter === df
                  ? 'bg-amber-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {df === 'TODAY' && "Today"}
              {df === 'YESTERDAY' && "Yesterday"}
              {df === 'THIS_WEEK' && "Last 7 Days"}
              {df === 'THIS_MONTH' && "This Month"}
              {df === 'ALL' && "All Time"}
              {df === 'CUSTOM' && "Custom Dates"}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {/* Search Input */}
        <div className="relative min-w-[240px] md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search description, paid to, notes..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-slate-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Main Expenses List / Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {/* Table Title Bar */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Expense Records ({filteredExpenses.length})
            </h2>
            {selectedCategory !== 'ALL' && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {selectedCategory}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total for current selection: <span className="text-rose-600 dark:text-rose-400 font-bold ml-1">{formatPKR(filteredTotal)}</span>
          </div>
        </div>

        {/* Empty State */}
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 border border-amber-200 dark:border-amber-800/80">
              <Store className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No shop expenses found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || selectedCategory !== 'ALL' || dateFilter !== 'ALL'
                ? 'No expenses matched your filter criteria. Try clearing search or filters.'
                : 'You have not added any shop expenses yet. Start tracking your daily shop expenditures now.'}
            </p>
            <button
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Shop Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description / Item</th>
                  <th className="py-3 px-4">Paid To</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredExpenses.map((exp) => {
                  const catCfg = CATEGORY_CONFIG[exp.category as ShopExpenseCategory] || CATEGORY_CONFIG['General & Misc'];
                  const Icon = catCfg.icon;

                  return (
                    <tr 
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Date */}
                      <td className="py-3 px-4 sm:px-6 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {exp.date}
                        </div>
                        {exp.receiptNumber && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {exp.receiptNumber}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${catCfg.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{catCfg.label}</span>
                        </div>
                      </td>

                      {/* Description & Notes */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {exp.title}
                        </div>
                        {exp.notes && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 italic">
                            {exp.notes}
                          </div>
                        )}
                      </td>

                      {/* Paid To */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {exp.paidTo ? (
                          <span>{exp.paidTo}</span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {exp.paymentMethod === 'CASH' && 'Cash in Hand (نقد)'}
                          {exp.paymentMethod === 'ONLINE_BANK' && 'Bank / Online'}
                          {exp.paymentMethod === 'USER_BALANCE' && 'User Balance'}
                        </span>
                        {exp.deductFromUserBalance && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            • Cut from user balance
                          </div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                          {formatPKR(exp.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 sm:px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setVoucherExpense(exp)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Print Voucher"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Edit Expense"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Add / Edit Expense Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto text-slate-900 dark:text-slate-100">
            
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {editingExpense ? 'Edit Shop Expense' : 'Add Daily Shop Expense'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  دکان کے روزمرہ اخراجات کا اندراج
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              
              {/* Date & Category Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date (تاریخ) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Category Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category (قسم) *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ShopExpenseCategory })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat} ({CATEGORY_CONFIG[cat].urdu})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Expense Description (تفصیل / آئٹم) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chai & biscuits for customer, Loading 200 bags, Shop Bill, Rickshaw fare"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Amount with Quick Chips */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Amount (رقم - روپے) *
                  </label>
                  <span className="text-[11px] text-slate-400">PKR</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-extrabold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="text-[10px] text-slate-400 font-semibold mr-1">Quick:</span>
                  {[100, 200, 500, 1000, 2000, 5000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSetAmount(amt)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddAmount(100)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddAmount(500)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                  >
                    +500
                  </button>
                </div>
              </div>

              {/* Paid To & Payment Method Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Paid To */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Paid To / Recipient (کس کو ادائیگی کی)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chai Wala, Ali Loader, WAPDA"
                    value={formData.paidTo}
                    onChange={(e) => setFormData({ ...formData, paidTo: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Mode (طریقہ ادائیگی)
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CASH">Cash in Hand (نقد دکان)</option>
                    <option value="ONLINE_BANK">Online / Bank / EasyPaisa</option>
                    <option value="USER_BALANCE">User Balance (ذاتی اکاؤنٹ)</option>
                  </select>
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Notes (اضافی تفصیل)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details, voucher memo, or vehicle number..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingExpense ? 'Save Changes' : 'Record Expense'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-xl text-center">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete this shop expense?</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
              This action cannot be undone. The expense record will be permanently deleted from the cloud database.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                No, Keep It
              </button>
              <button
                onClick={() => handleDeleteExpense(deleteConfirmId)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Expense Sheet / Report Modal */}
      {dailySheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none">
            
            <button
              onClick={() => setDailySheetOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg no-print cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Print Header */}
            <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-4 text-center">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                KB FACTORY
              </h2>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                DAILY SHOP EXPENSE STATEMENT
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Filter: <span className="font-semibold">{dateFilter}</span> | Generated: {new Date().toLocaleString()}
              </div>
            </div>

            {/* Category Breakdown Table */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Category Breakdown:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categoryBreakdown.map(([cat, data]) => (
                  <div key={cat} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold truncate">
                      {cat}
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatPKR(data.total)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {data.count} {data.count === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Itemized Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Paid To</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredExpenses.map((e, idx) => (
                    <tr key={e.id || idx}>
                      <td className="py-2 px-3 whitespace-nowrap">{e.date}</td>
                      <td className="py-2 px-3 whitespace-nowrap font-medium">{e.category}</td>
                      <td className="py-2 px-3">{e.title}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{e.paidTo || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                        {formatPKR(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 font-black border-t-2 border-slate-300 dark:border-slate-700">
                    <td colSpan={4} className="py-3 px-3 text-right uppercase text-xs">
                      Grand Total Expenses:
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-rose-600 dark:text-rose-400">
                      {formatPKR(filteredTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer / Print Actions */}
            <div className="flex items-center justify-between pt-2 no-print">
              <span className="text-xs text-slate-400">
                Printed from KB Factory ERP
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDailySheetOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Single Expense Voucher Slip */}
      {voucherExpense && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl relative text-slate-900 dark:text-slate-100">
            <button
              onClick={() => setVoucherExpense(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg no-print cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 mb-3">
              <div className="text-base font-extrabold">KB FACTORY</div>
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-500">
                SHOP EXPENSE VOUCHER
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {voucherExpense.receiptNumber || voucherExpense.id}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold">{voucherExpense.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold">{voucherExpense.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Item:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{voucherExpense.title}</span>
              </div>
              {voucherExpense.paidTo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid To:</span>
                  <span className="font-semibold">{voucherExpense.paidTo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Mode:</span>
                <span className="font-semibold">{voucherExpense.paymentMethod}</span>
              </div>
              {voucherExpense.notes && (
                <div className="pt-1 text-[11px] text-slate-500 italic">
                  Note: {voucherExpense.notes}
                </div>
              )}

              <div className="pt-2 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between items-center text-sm">
                <span className="font-bold">Total Paid:</span>
                <span className="font-black text-rose-600 dark:text-rose-400 text-base">
                  {formatPKR(voucherExpense.amount)}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 no-print">
              <button
                onClick={() => setVoucherExpense(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
