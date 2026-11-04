import React, { useState, useEffect } from 'react';
import { 
  Company, 
  Party, 
  Customer, 
  Purchase,
  Sale,
  ThirdPartyPayment, 
  Payment,
  BranchAccount,
  CompanyPayment,
  ShopExpense 
} from '../types/feed';
import { api } from '../services/api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Building2, 
  Search, 
  HelpCircle,
  Coins,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  Trash2,
  X,
  Plus,
  Check
} from 'lucide-react';

interface PaymentsAutoBalancingViewProps {
  companies: Company[];
  parties: Party[];
  customers: Customer[];
  purchases?: Purchase[];
  sales?: Sale[];
  thirdPartyPayments: ThirdPartyPayment[];
  directPayments: Payment[];
  expenses?: ShopExpense[];
  onRefresh: () => void;
}

export const PaymentsAutoBalancingView: React.FC<PaymentsAutoBalancingViewProps> = ({
  companies,
  parties,
  customers,
  purchases = [],
  sales = [],
  thirdPartyPayments,
  directPayments = [],
  expenses = [],
  onRefresh
}) => {
  const [branchAccount, setBranchAccount] = useState<BranchAccount>({
    userName: 'Farooq Gujjar KB',
    branchName: 'Farooq Gujjar KB (Branch Account)',
    userBalance: 500000,
    companyBalance: 1250000,
    primaryCompanyId: companies[0]?.id || 'comp-1',
    primaryCompanyName: companies[0]?.name || 'Supreme Feeds Ltd'
  });
  const [companyPayments, setCompanyPayments] = useState<CompanyPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CR' | 'DR'>('ALL');

  // Modal: Set User Balance
  const [isSetUserBalanceModalOpen, setIsSetUserBalanceModalOpen] = useState(false);
  const [initialBalanceInput, setInitialBalanceInput] = useState<number | string>(0);
  const [savingInitialBalance, setSavingInitialBalance] = useState(false);
  const [balanceStatusMessage, setBalanceStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal: Record CR/DR Transaction
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'CR' | 'DR'>('CR');
  const [amount, setAmount] = useState<number>(50000);
  const [description, setDescription] = useState<string>('Cash Deposit / Money Received');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load branch data
  const loadBranchData = async () => {
    setLoading(true);
    try {
      const res = await api.getBranchAccount();
      if (res.branchAccount) {
        setBranchAccount(res.branchAccount);
      }
      if (res.companyPayments) {
        setCompanyPayments(res.companyPayments);
      }
    } catch (err) {
      console.error('Error fetching branch account:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: async () => {},
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCompanyPayment = (p: CompanyPayment) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Delete CR/DR Transaction Record',
      description: `Are you sure you want to delete ${p.entryType === 'CR' ? 'Credit' : 'Debit'} transaction of Rs. ${Number(p.amount).toLocaleString()} (${p.description})? Associated balances will be reverted.`,
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await api.deleteCompanyPayment(p.id);
          await loadBranchData();
          onRefresh();
        } catch (err: any) {
          console.error('Failed to delete transaction record', err);
          setStatusMessage({ type: 'error', text: err.message || 'Failed to delete transaction record' });
        } finally {
          setIsDeleting(false);
          setDeleteConfirmation(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  useEffect(() => {
    loadBranchData();
  }, [purchases, sales, directPayments, thirdPartyPayments]);

  // Submit CR/DR transaction
  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Please enter a valid amount greater than 0.');
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await api.recordCompanyPayment({
        entryType,
        amount: Number(amount),
        description: description || (entryType === 'CR' ? 'Credit Received' : 'Debit Paid'),
        referenceNumber: referenceNumber || `CRDR-${Math.floor(10000 + Math.random() * 90000)}`,
        date: paymentDate,
        notes
      });

      setStatusMessage({ type: 'success', text: res.message });
      if (res.branchAccount) {
        setBranchAccount(res.branchAccount);
      }

      await loadBranchData();
      onRefresh();

      setTimeout(() => {
        setIsModalOpen(false);
        setStatusMessage(null);
        setAmount(50000);
        setDescription('Cash Deposit / Money Received');
        setReferenceNumber('');
        setNotes('');
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculations
  const totalPayables = companies.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  const totalWholesaleReceivables = parties.reduce((sum, p) => sum + (p.currentBalance || 0), 0);
  const totalRetailReceivables = customers.reduce((sum, c) => sum + (c.currentBalance || 0), 0);
  const totalDebt = totalPayables + totalWholesaleReceivables + totalRetailReceivables;

  // Filter transactions
  const filteredPayments = companyPayments.filter(p => {
    if (filterType !== 'ALL' && p.entryType !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchRef = (p.referenceNumber || '').toLowerCase().includes(q);
      const matchNotes = (p.notes || '').toLowerCase().includes(q);
      return matchDesc || matchRef || matchNotes;
    }
    return true;
  });

  const totalCredits = companyPayments.filter(p => p.entryType === 'CR').reduce((sum, p) => sum + p.amount, 0);
  const totalDebits = companyPayments.filter(p => p.entryType === 'DR').reduce((sum, p) => sum + p.amount, 0);

  // Active advance pools held
  const totalFactoryAdvancePool = companies.reduce((sum, c) => sum + (c.advanceBalance || 0), 0);
  const totalWholesaleAdvancePool = parties.reduce((sum, p) => sum + (p.advanceBalance || 0), 0);
  const totalRetailAdvancePool = customers.reduce((sum, c) => sum + (c.advanceBalance || 0), 0);

  // 1. FACTORY BUY MONEY FLOWS:
  // Spot payments given to factory (Cash cuts from user balance, adds to factory balance)
  const factorySpotPurchases = purchases
    .filter(p => !p.isUdhaarReceive)
    .reduce((sum, p) => {
      const adv = Number(p.advancePayment) || 0;
      const totalPaid = Number(p.paidNow) || Number(p.givenOnSpot) || 0;
      const pureSpot = p.givenOnSpot !== undefined && p.givenOnSpot !== p.paidNow ? Number(p.givenOnSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Advance payments given to factory (Cash cuts from user balance, adds to factory balance)
  const factoryAdvancePurchases = purchases
    .filter(p => !p.isUdhaarReceive)
    .reduce((sum, p) => sum + (Number(p.advancePayment) || 0), 0);

  // Factory Buy Udhaar willingly paid to factory (Cash cuts from user balance, adds to factory balance)
  const factoryUdhaarReceive = purchases
    .filter(p => p.isUdhaarReceive || Number(p.udhaarReceiveAmount) > 0)
    .reduce((sum, p) => sum + (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0), 0);

  // Direct cash payments made to company/factory (Cash cuts from user balance, adds to factory balance)
  const factoryDirectPayments = directPayments
    .filter(p => p.type === 'PAYMENT_TO_COMPANY')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Total cash paid to factory across all methods:
  const totalPaidToFactory = factorySpotPurchases + factoryAdvancePurchases + factoryUdhaarReceive + factoryDirectPayments;

  // Factory Dana (debt borrowed from factory)
  const factoryDanaUdhaar = purchases
    .filter(p => !p.isUdhaarReceive)
    .reduce((sum, p) => sum + (Number(p.borrowedAmount) || 0), 0);

  // Active remaining factory dana debt (dana borrowed minus debt repayments made)
  const activeFactoryDana = Math.max(
    0,
    factoryDanaUdhaar - factoryDirectPayments - factoryUdhaarReceive
  );

  // 2. RETAIL KHATA MONEY FLOWS:
  // Spot cash received from farmers at retail counter (adds to user balance)
  const retailSpotCash = sales
    .filter(s => s.saleType === 'RETAIL')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Advance payments received from farmers (adds to user balance)
  const retailAdvanceCash = sales
    .filter(s => s.saleType === 'RETAIL')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  const retailCustomerIds = new Set(customers.map(c => c.id));
  const wholesalePartyIds = new Set(parties.map(p => p.id));

  const isRetailPayment = (p: Payment) => {
    if (p.partyType === 'RETAIL_CUSTOMER') return true;
    if (p.partyType === 'WHOLESALE_DEALER') return false;
    if (p.partyId && retailCustomerIds.has(p.partyId)) return true;
    if (p.partyId && wholesalePartyIds.has(p.partyId)) return false;
    if (p.notes && /retail|counter|farmer/i.test(p.notes)) return true;
    return false;
  };

  const customerPayments = directPayments.filter(
    p => p.type === 'PAYMENT_FROM_CUSTOMER' && !(p as any).isLinkedToFactoryBuy
  );

  // Customer debt repayments collected (adds to user balance)
  const retailCustomerPayments = customerPayments
    .filter(isRetailPayment)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Total Retail Khata cash inflow:
  const retailKhataMoney = retailSpotCash + retailAdvanceCash + retailCustomerPayments;

  // 3. WHOLESALE MONEY FLOWS:
  // Wholesale dealer spot cash routed to Factory (default)
  const wholesaleFactorySpotCash = sales
    .filter(s => s.saleType === 'WHOLESALE' && s.destinationAccount !== 'USER')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Wholesale dealer advance payments routed to Factory (default)
  const wholesaleFactoryAdvanceCash = sales
    .filter(s => s.saleType === 'WHOLESALE' && s.destinationAccount !== 'USER')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  // Wholesale dealer spot cash routed to User
  const wholesaleUserSpotCash = sales
    .filter(s => s.saleType === 'WHOLESALE' && s.destinationAccount === 'USER')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Wholesale dealer advance payments routed to User
  const wholesaleUserAdvanceCash = sales
    .filter(s => s.saleType === 'WHOLESALE' && s.destinationAccount === 'USER')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  // Wholesale dealer debt repayments (adds to factory balance)
  const wholesaleCustomerPayments = customerPayments
    .filter(p => !isRetailPayment(p))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const wholesaleFactoryCashCollected = wholesaleFactorySpotCash + wholesaleFactoryAdvanceCash + wholesaleCustomerPayments;
  const wholesaleUserCashCollected = wholesaleUserSpotCash + wholesaleUserAdvanceCash;

  // 4. DAILY SHOP EXPENSES:
  const shopExpensesTotal = (expenses || []).reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  // 5. TREASURY AUDIT CR / DR:
  const netCrDrTreasury = totalCredits - totalDebits;

  // 6. LOGICAL BALANCES:
  const initialUserBalance = Number(branchAccount.initialUserBalance) || 0;
  // Live User Balance: Opening balance set by user + Retail funds collected + Wholesale routed to User MINUS factory purchases & shop expenses
  const liveUserBalance = initialUserBalance + retailKhataMoney + wholesaleUserCashCollected - totalPaidToFactory - shopExpensesTotal;

  // Live Factory Balance: All payments received by factory PLUS wholesale cash routed to Factory PLUS net treasury audit
  const liveFactoryBalance = Math.max(
    0,
    totalPaidToFactory + wholesaleFactoryCashCollected + netCrDrTreasury
  );

  const remainingFactoryDana = activeFactoryDana;
  const totalCustomerUdhaarExcluded = sales.reduce((sum, s) => sum + (Number(s.borrowedLana) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Live Real-Time Treasury
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Account: <strong className="text-slate-800 dark:text-slate-200">{branchAccount.userName} (Unified Account)</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            Current Balance
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setInitialBalanceInput(branchAccount.initialUserBalance ?? 0);
              setBalanceStatusMessage(null);
              setIsSetUserBalanceModalOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            title="Set user balance on first time or update opening cash-in-hand"
          >
            <Coins className="w-4 h-4 stroke-[2.5]" />
            <span>Set User Balance</span>
          </button>
        </div>
      </div>

      {/* 2. Core Balances Cards (Factory Balance & User Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Factory Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 shadow-xs transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Factory Balance
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Wholesale &amp; Factory Cash
            </span>
          </div>

          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums tracking-tight">
              Rs. {Math.round(liveFactoryBalance).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live total cash in Factory Balance (factory purchases received, wholesale cash &amp; treasury)
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {factorySpotPurchases > 0 && (
              <div className="flex items-center justify-between">
                <span>Spot Purchases from User (Factory Buy):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {factorySpotPurchases.toLocaleString()}
                </span>
              </div>
            )}
            {factoryAdvancePurchases > 0 && (
              <div className="flex items-center justify-between">
                <span>Advance Payments from User:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {factoryAdvancePurchases.toLocaleString()}
                </span>
              </div>
            )}
            {factoryUdhaarReceive > 0 && (
              <div className="flex items-center justify-between">
                <span>Factory Udhaar Payback from User:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {factoryUdhaarReceive.toLocaleString()}
                </span>
              </div>
            )}
            {factoryDirectPayments > 0 && (
              <div className="flex items-center justify-between">
                <span>Direct Payments to Supplier:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {factoryDirectPayments.toLocaleString()}
                </span>
              </div>
            )}
            {wholesaleFactorySpotCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Wholesale Spot Cash (Factory Account):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {wholesaleFactorySpotCash.toLocaleString()}
                </span>
              </div>
            )}
            {wholesaleFactoryAdvanceCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Wholesale Advance Payments (Factory Account):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {wholesaleFactoryAdvanceCash.toLocaleString()}
                </span>
              </div>
            )}
            {wholesaleCustomerPayments > 0 && (
              <div className="flex items-center justify-between">
                <span>Wholesale Dealer Debt Recoveries:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {wholesaleCustomerPayments.toLocaleString()}
                </span>
              </div>
            )}
            {netCrDrTreasury !== 0 && (
              <div className="flex items-center justify-between">
                <span>Net Treasury Audit (CR - DR):</span>
                <span className={`font-bold tabular-nums ${netCrDrTreasury >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {netCrDrTreasury > 0 ? `+Rs. ${netCrDrTreasury.toLocaleString()}` : `-Rs. ${Math.abs(netCrDrTreasury).toLocaleString()}`}
                </span>
              </div>
            )}
            {remainingFactoryDana > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                <span>Remaining Factory Dana Debt (Unpaid):</span>
                <span className="tabular-nums">Rs. {remainingFactoryDana.toLocaleString()}</span>
              </div>
            )}
            {totalFactoryAdvancePool > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                <span>Prepaid Advance Pool at Factories (Usable for Bags):</span>
                <span className="tabular-nums">Rs. {totalFactoryAdvancePool.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* User Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 shadow-xs transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide uppercase text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              User Balance
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setInitialBalanceInput(branchAccount.initialUserBalance ?? 0);
                  setBalanceStatusMessage(null);
                  setIsSetUserBalanceModalOpen(true);
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Set user balance on first time"
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
                <span>Set Balance</span>
              </button>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                Live Cash in Hand
              </span>
            </div>
          </div>

          <div className="mt-3">
            <div className={`text-3xl font-black tabular-nums tracking-tight ${liveUserBalance >= 0 ? 'text-indigo-700 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {liveUserBalance >= 0 ? `Rs. ${Math.round(liveUserBalance).toLocaleString()}` : `-Rs. ${Math.abs(Math.round(liveUserBalance)).toLocaleString()}`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Live user balance (initial balance + retail funds collected minus factory purchases &amp; shop expenses)
            </div>
          </div>

          {/* Breakdown summary */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {initialUserBalance > 0 && (
              <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-300 font-medium">
                <span>Initial / Opening Cash Set:</span>
                <span className="font-bold tabular-nums">
                  +Rs. {initialUserBalance.toLocaleString()}
                </span>
              </div>
            )}
            {retailSpotCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Retail Counter Cash (Normal):</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {retailSpotCash.toLocaleString()}
                </span>
              </div>
            )}
            {retailAdvanceCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Retail Advance Payments from Farmers:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {retailAdvanceCash.toLocaleString()}
                </span>
              </div>
            )}
            {retailCustomerPayments > 0 && (
              <div className="flex items-center justify-between">
                <span>Retail Khata Debt Recoveries:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  +Rs. {retailCustomerPayments.toLocaleString()}
                </span>
              </div>
            )}
            {wholesaleUserSpotCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Wholesale Spot Cash (User Account):</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  +Rs. {wholesaleUserSpotCash.toLocaleString()}
                </span>
              </div>
            )}
            {wholesaleUserAdvanceCash > 0 && (
              <div className="flex items-center justify-between">
                <span>Wholesale Advance Payments (User Account):</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  +Rs. {wholesaleUserAdvanceCash.toLocaleString()}
                </span>
              </div>
            )}

            {factorySpotPurchases > 0 && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Cut for Factory Buy Purchases (Spot Cash):</span>
                <span className="font-bold tabular-nums">
                  -Rs. {factorySpotPurchases.toLocaleString()}
                </span>
              </div>
            )}
            {factoryAdvancePurchases > 0 && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Cut for Advance Payments to Factory:</span>
                <span className="font-bold tabular-nums">
                  -Rs. {factoryAdvancePurchases.toLocaleString()}
                </span>
              </div>
            )}
            {factoryUdhaarReceive > 0 && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Cut for Factory Udhaar Paid Back:</span>
                <span className="font-bold tabular-nums">
                  -Rs. {factoryUdhaarReceive.toLocaleString()}
                </span>
              </div>
            )}
            {factoryDirectPayments > 0 && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Cut for Direct Supplier Payments:</span>
                <span className="font-bold tabular-nums">
                  -Rs. {factoryDirectPayments.toLocaleString()}
                </span>
              </div>
            )}
            {(totalWholesaleAdvancePool > 0 || totalRetailAdvancePool > 0) && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                <span>Advance Money Deposited by Customers (Liability):</span>
                <span className="tabular-nums">Rs. {(totalWholesaleAdvancePool + totalRetailAdvancePool).toLocaleString()}</span>
              </div>
            )}
            {shopExpensesTotal > 0 && (
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Cut for Daily Shop Expenses:</span>
                <span className="font-bold tabular-nums">
                  -Rs. {shopExpensesTotal.toLocaleString()}
                </span>
              </div>
            )}

            {totalCustomerUdhaarExcluded > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                <span>Excluded Customer Lana Udhaar (Unpaid):</span>
                <span className="tabular-nums">Rs. {totalCustomerUdhaarExcluded.toLocaleString()}</span>
              </div>
            )}
            {remainingFactoryDana > 0 && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Factory Dana Debt (Unpaid, not cut automatically):</span>
                <span className="tabular-nums font-mono">Rs. {remainingFactoryDana.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search CR/DR records by description, reference, notes..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                filterType === 'ALL' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All ({companyPayments.length})
            </button>
            <button
              onClick={() => setFilterType('CR')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                filterType === 'CR' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Credit (CR)
            </button>
            <button
              onClick={() => setFilterType('DR')}
              className={`px-3 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                filterType === 'DR' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Debit (DR)
            </button>
          </div>
        </div>
      </div>

      {/* 4. Transactions Ledger Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-colors">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Company &amp; User CR/DR Audit Trail</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chronological record of all credit and debit entries for company pay treasury.</p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Showing {filteredPayments.length} entries</span>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-50" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300">No CR/DR Transactions Recorded Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No CR/DR transactions recorded.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[800px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Date &amp; Ref #</th>
                  <th className="py-3 px-4">Type &amp; Description</th>
                  <th className="py-3 px-4 text-right">Credit (CR) (+)</th>
                  <th className="py-3 px-4 text-right">Debit (DR) (-)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPayments.map((p) => {
                  const isCR = p.entryType === 'CR';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.date}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.referenceNumber}</div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                          {isCR ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <ArrowDownCircle className="w-3 h-3" /> CR (Credit)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              <ArrowUpCircle className="w-3 h-3" /> DR (Debit)
                            </span>
                          )}
                          <span>{p.description}</span>
                        </div>
                        {p.notes && (
                          <div className="text-[11px] text-slate-400 italic mt-0.5">{p.notes}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isCR ? (
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm">
                            + Rs. {Number(p.amount).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isCR ? (
                          <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums text-sm">
                            - Rs. {Number(p.amount).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                        Rs. {Number(p.companyBalanceAfter ?? branchAccount.companyBalance).toLocaleString()}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteCompanyPayment(p)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete transaction record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD CR / DR ENTRY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Record Credit (CR) or Debit (DR) Entry</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Unified treasury update for company &amp; user account.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTransaction} className="p-6 space-y-4 overflow-y-auto flex-1">
              {statusMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {statusMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Transaction Type (CR / DR)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEntryType('CR');
                      setDescription('Cash Deposit / Money Received');
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      entryType === 'CR'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    <span>Credit (CR - Money In)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryType('DR');
                      setDescription('Supplier Payment / Expense Paid');
                    }}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      entryType === 'DR'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>Debit (DR - Money Out)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount (Rs.) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Category
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Factory Payment, Bank Deposit, Cash Withdrawn..."
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reference / Slip Number</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. TRF-98214"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional remarks..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100"
                ></textarea>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Recording...' : `Save ${entryType} Transaction`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set User Balance Modal */}
      {isSetUserBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Set User Balance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Set opening cash-in-hand balance on first time
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSetUserBalanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingInitialBalance(true);
                try {
                  const val = Math.max(0, Number(initialBalanceInput) || 0);
                  await api.setUserBalance(val);
                  await loadBranchData();
                  onRefresh();
                  setBalanceStatusMessage({
                    type: 'success',
                    text: `User balance set to Rs. ${val.toLocaleString()} successfully.`
                  });
                  setTimeout(() => {
                    setIsSetUserBalanceModalOpen(false);
                    setBalanceStatusMessage(null);
                  }, 800);
                } catch (err: any) {
                  console.error('Failed to set user balance:', err);
                  setBalanceStatusMessage({
                    type: 'error',
                    text: 'Failed to update user balance. Please try again.'
                  });
                } finally {
                  setSavingInitialBalance(false);
                }
              }}
              className="p-6 space-y-4"
            >
              {balanceStatusMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  balanceStatusMessage.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {balanceStatusMessage.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Initial Cash In Hand (PKR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={initialBalanceInput}
                    onChange={(e) => setInitialBalanceInput(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                    placeholder="e.g. 500000"
                    className="w-full pl-10 pr-4 py-2.5 text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 tabular-nums focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  This sets your initial opening balance. All future retail sales, wholesale money routed to user, factory purchases, and expenses will dynamically adjust this balance.
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Quick Amount Presets:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[100000, 250000, 500000, 1000000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInitialBalanceInput(preset)}
                      className={`px-2 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer text-center ${
                        Number(initialBalanceInput) === preset
                          ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-400 text-indigo-700 dark:text-indigo-300 font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {preset >= 1000000 ? `${preset / 1000000}M` : `${preset / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {Number(initialBalanceInput) > 0 && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
                  <span>Formatted Amount:</span>
                  <strong className="text-sm font-black tabular-nums">
                    Rs. {Number(initialBalanceInput).toLocaleString()}
                  </strong>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSetUserBalanceModalOpen(false)}
                  disabled={savingInitialBalance}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInitialBalance}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingInitialBalance ? (
                    'Saving...'
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save Balance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.title}
        description={deleteConfirmation.description}
        isDeleting={isDeleting}
        onConfirm={deleteConfirmation.onConfirm}
        onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
