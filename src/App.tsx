/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  DashboardStats, 
  FeedItem, 
  Company, 
  Party, 
  Customer, 
  Purchase, 
  Sale, 
  Payment, 
  ThirdPartyPayment, 
  HistoryRecord,
  ShopExpense 
} from './types/feed';
import { api } from './services/api';
import { localStorageBackup } from './services/localStorageBackup';
import { Navbar } from './components/Navbar';
import { ShopView } from './components/ShopView';
import { PurchasesView } from './components/PurchasesView';
import { WholesaleView } from './components/WholesaleView';
import { RetailKhataView } from './components/RetailKhataView';
import { PaymentsAutoBalancingView } from './components/PaymentsAutoBalancingView';
import { HistoryRecordsView } from './components/HistoryRecordsView';
import { CloudSyncView } from './components/CloudSyncView';
import { QuickEntryModal } from './components/QuickEntryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('shop');
  const [loading, setLoading] = useState<boolean>(true);

  // Core state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [thirdPartyPayments, setThirdPartyPayments] = useState<ThirdPartyPayment[]>([]);
  const [expenses, setExpenses] = useState<ShopExpense[]>([]);

  // Modals
  const [showQuickAction, setShowQuickAction] = useState<boolean>(false);
  const [openNewPurchaseModal, setOpenNewPurchaseModal] = useState<boolean>(false);
  const [openNewWholesaleModal, setOpenNewWholesaleModal] = useState<boolean>(false);
  const [openNewRetailModal, setOpenNewRetailModal] = useState<boolean>(false);
  const [activeReceiptRecord, setActiveReceiptRecord] = useState<HistoryRecord | null>(null);

  // Fetch all data with background update
  const loadAllData = async (isInitial = false) => {
    if (!user) return;
    try {
      if (isInitial && !stats) {
        setLoading(true);
      }

      // Safety timeout so loading screen dismisses in max 600ms
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
      }, 600);

      const data = await api.fetchAllAppData(!isInitial);
      clearTimeout(safetyTimeout);

      if (data.stats) setStats(data.stats);
      setItems(data.items);
      setCompanies(data.companies);
      setParties(data.parties);
      setCustomers(data.customers);
      setPurchases(data.purchases);
      setSales(data.sales);
      setPayments(data.payments);
      setThirdPartyPayments(data.thirdPartyPayments);
      if (data.shopExpenses) setExpenses(data.shopExpenses);
    } catch (err) {
      console.error('Error loading ERP data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Instant local cache hydration for seamless zero-delay UI rendering
      const cachedDashboard = localStorageBackup.get<DashboardStats>('dashboard');
      const cachedItems = localStorageBackup.get<FeedItem[]>('items');
      const cachedCompanies = localStorageBackup.get<Company[]>('companies');
      const cachedParties = localStorageBackup.get<Party[]>('parties');
      const cachedCustomers = localStorageBackup.get<Customer[]>('customers');
      const cachedPurchases = localStorageBackup.get<Purchase[]>('purchases');
      const cachedSales = localStorageBackup.get<Sale[]>('sales');
      const cachedPayments = localStorageBackup.get<Payment[]>('payments');
      const cachedThirdParty = localStorageBackup.get<ThirdPartyPayment[]>('thirdPartyPayments');
      const cachedExpenses = localStorageBackup.get<ShopExpense[]>('shopExpenses');

      const hasLocalData = Boolean(cachedDashboard || (cachedItems && cachedItems.length > 0) || (cachedPurchases && cachedPurchases.length > 0));

      if (hasLocalData) {
        if (cachedDashboard) setStats(cachedDashboard);
        if (cachedItems) setItems(cachedItems);
        if (cachedCompanies) setCompanies(cachedCompanies);
        if (cachedParties) setParties(cachedParties);
        if (cachedCustomers) setCustomers(cachedCustomers);
        if (cachedPurchases) setPurchases(cachedPurchases);
        if (cachedSales) setSales(cachedSales);
        if (cachedPayments) setPayments(cachedPayments);
        if (cachedThirdParty) setThirdPartyPayments(cachedThirdParty);
        if (cachedExpenses) setExpenses(cachedExpenses);
        setLoading(false);
        // Refresh silently in background
        loadAllData(false);
      } else {
        loadAllData(true);
      }
    } else {
      setLoading(false);
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <span className="text-sm font-semibold text-slate-300">Connecting to Cloud Database...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleQuickActionSelect = (action: 'PURCHASE' | 'WHOLESALE' | 'RETAIL' | 'PAYMENT' | 'THIRD_PARTY' | 'SHOP_EXPENSE') => {
    if (action === 'SHOP_EXPENSE') {
      setActiveTab('shop');
    } else if (action === 'PURCHASE') {
      setActiveTab('purchases');
      setOpenNewPurchaseModal(true);
    } else if (action === 'WHOLESALE') {
      setActiveTab('wholesale');
      setOpenNewWholesaleModal(true);
    } else if (action === 'RETAIL') {
      setActiveTab('retail');
      setOpenNewRetailModal(true);
    } else if (action === 'THIRD_PARTY' || action === 'PAYMENT') {
      setActiveTab('payments');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-600 dark:text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Connecting to KB Factory Cloud Database...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors">
      
      {/* Top Navbar adhering to Top Bar Contract */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAction={() => setShowQuickAction(true)}
      />

      {/* Main Content Area with generous bottom spacing */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-28 md:pb-16 overflow-x-hidden">
        
        {/* TAB 1: Shop & Daily Expenses */}
        {activeTab === 'shop' && (
          <ShopView
            expenses={expenses}
            onRefresh={loadAllData}
            userBalance={stats?.userBalance}
          />
        )}

        {/* TAB 3: Factory & Mill Purchases */}
        {activeTab === 'purchases' && (
          <PurchasesView
            companies={companies}
            parties={parties}
            items={items}
            purchases={purchases}
            sales={sales}
            directPayments={payments}
            onRefresh={loadAllData}
            openNewPurchaseModal={openNewPurchaseModal}
            setOpenNewPurchaseModal={setOpenNewPurchaseModal}
          />
        )}

        {/* TAB 4: Big Parties (Wholesale) */}
        {activeTab === 'wholesale' && (
          <WholesaleView
            parties={parties}
            items={items}
            sales={sales}
            onRefresh={loadAllData}
            openNewSaleModal={openNewWholesaleModal}
            setOpenNewSaleModal={setOpenNewWholesaleModal}
          />
        )}

        {/* TAB 5: Local Customers & Retail Khata */}
        {activeTab === 'retail' && (
          <RetailKhataView
            customers={customers}
            items={items}
            sales={sales}
            onRefresh={loadAllData}
            openNewSaleModal={openNewRetailModal}
            setOpenNewSaleModal={setOpenNewRetailModal}
          />
        )}

        {/* TAB 6: Advanced Payments & Auto-Balancing */}
        {activeTab === 'payments' && (
          <PaymentsAutoBalancingView
            companies={companies}
            parties={parties}
            customers={customers}
            purchases={purchases}
            sales={sales}
            thirdPartyPayments={thirdPartyPayments}
            directPayments={payments}
            expenses={expenses}
            onRefresh={loadAllData}
          />
        )}

        {/* TAB 7: History & Advanced Search */}
        {activeTab === 'history' && (
          <HistoryRecordsView
            companies={companies}
            parties={parties}
            customers={customers}
            onOpenReceipt={(rec) => setActiveReceiptRecord(rec)}
            onRefresh={loadAllData}
          />
        )}

        {/* TAB 8: Cloud Storage & Multi-Device Access */}
        {activeTab === 'cloud' && (
          <CloudSyncView
            lastSync={stats?.lastSync || new Date().toISOString()}
            onRefresh={loadAllData}
          />
        )}

      </main>

      {/* Quick Entry Modal */}
      <QuickEntryModal
        isOpen={showQuickAction}
        onClose={() => setShowQuickAction(false)}
        onSelectAction={handleQuickActionSelect}
      />

      {/* Printable Receipt / Voucher Modal */}
      <ReceiptModal
        record={activeReceiptRecord}
        onClose={() => setActiveReceiptRecord(null)}
      />

      {/* Desktop Footer Contract */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 text-center text-xs text-slate-500 dark:text-slate-400 no-print transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Made by Almas &copy; 2026</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Multi-Device Cloud Sync Active</span>
        </div>
      </footer>

    </div>
  );
}
