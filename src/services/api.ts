import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  FeedItem, 
  Company, 
  Party, 
  Customer, 
  Purchase, 
  Sale, 
  Payment, 
  ThirdPartyPayment, 
  DashboardStats, 
  HistoryRecord, 
  LedgerEntry, 
  BranchAccount, 
  CompanyPayment, 
  RetentionStatus, 
  RetentionResult,
  ShopExpense 
} from '../types/feed';
import { localStorageBackup } from './localStorageBackup';

const RETENTION_DAYS = 365;

function getRetentionCutoffDate(): string {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().split('T')[0];
}

function getUserId(): string {
  const user = auth.currentUser;
  if (user?.uid) {
    return user.uid;
  }
  const storedUser = localStorage.getItem('KB_FACTORY_USER');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.uid) return parsed.uid;
    } catch (e) {
      // ignore
    }
  }
  return 'kb-factory-admin';
}

function userCol(colName: string) {
  const uid = getUserId();
  return collection(db, 'users', uid, colName);
}

function userDoc(colName: string, docId: string) {
  const uid = getUserId();
  return doc(db, 'users', uid, colName, docId);
}

function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as unknown as T;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = cleanForFirestore(value);
    }
  }
  return result;
}

function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem('KB_FACTORY_DELETED_IDS');
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

function markAsDeleted(id: string) {
  try {
    const ids = getDeletedIds();
    ids.add(id);
    const cleanId = id.replace(/^(sale-|spot-|pay-|dp-|pur-|pur-ur-|tpp-|cp-)/, '');
    if (cleanId) ids.add(cleanId);
    const arr = Array.from(ids).slice(-500);
    localStorage.setItem('KB_FACTORY_DELETED_IDS', JSON.stringify(arr));
  } catch (e) {
    // ignore
  }
}

function unmarkDeleted(id: string) {
  try {
    const ids = getDeletedIds();
    ids.delete(id);
    const cleanId = id.replace(/^(sale-|spot-|pay-|dp-|pur-|pur-ur-|tpp-|cp-)/, '');
    if (cleanId) ids.delete(cleanId);
    localStorage.setItem('KB_FACTORY_DELETED_IDS', JSON.stringify(Array.from(ids)));
  } catch (e) {
    // ignore
  }
}

const inFlightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 2500;

export function clearApiCache(colName?: string) {
  if (colName) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.endsWith(`:${colName}`)) {
        memoryCache.delete(key);
      }
    }
    for (const key of Array.from(inFlightRequests.keys())) {
      if (key.endsWith(`:${colName}`)) {
        inFlightRequests.delete(key);
      }
    }
  } else {
    memoryCache.clear();
    inFlightRequests.clear();
  }
}

async function fetchCollection<T extends { id?: string }>(colName: string, forceFresh = false): Promise<T[]> {
  const uid = getUserId();
  const cacheKey = `${uid}:${colName}`;

  if (!forceFresh) {
    const cachedEntry = memoryCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      return cachedEntry.data as T[];
    }
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T[]>;
    }
  }

  const path = `users/${uid}/${colName}`;
  const deletedIds = getDeletedIds();

  const fetchPromise = (async () => {
    try {
      const snap = await getDocs(userCol(colName));
      const serverItems: T[] = [];
      snap.forEach((d) => {
        if (!deletedIds.has(d.id)) {
          serverItems.push({ id: d.id, ...d.data() } as T);
        }
      });
      const cached = (localStorageBackup.get<T[]>(colName) || []) as T[];
      const serverIds = new Set(serverItems.map((i) => i.id).filter(Boolean));
      
      // Retain cached local items that have not yet arrived from server and have not been deleted
      const pendingLocalItems = cached.filter((c: any) => c && c.id && !serverIds.has(c.id) && !deletedIds.has(c.id));
      const merged = [...serverItems, ...pendingLocalItems];

      const result = merged.length > 0 ? merged : cached.filter((c: any) => c && c.id && !deletedIds.has(c.id));
      if (merged.length > 0) {
        localStorageBackup.save(colName, merged);
      }
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
      const cached = localStorageBackup.get<T[]>(colName);
      const fallback = cached ? cached.filter((c: any) => c && c.id && !deletedIds.has(c.id)) : [];
      memoryCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
      return fallback;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

function computeBranchBalances(
  purchases: Purchase[],
  sales: Sale[],
  payments: Payment[],
  companyPayments: CompanyPayment[],
  customers?: Customer[],
  parties?: Party[],
  shopExpenses?: ShopExpense[],
  initialUserBalance: number = 0
) {
  // 1. FACTORY BUY MONEY FLOWS:
  // Spot payments given to factory in Factory Buy (cuts from user balance, adds to factory balance)
  const factorySpotTotal = purchases
    .filter((p) => !p.isUdhaarReceive)
    .reduce((sum, p) => {
      const adv = Number(p.advancePayment) || 0;
      const totalPaid = Number(p.paidNow) || Number(p.givenOnSpot) || 0;
      const pureSpot = p.givenOnSpot !== undefined && p.givenOnSpot !== p.paidNow ? Number(p.givenOnSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Advance payments given to factory in Factory Buy (cuts from user balance, adds to factory balance)
  const factoryAdvanceTotal = purchases
    .filter((p) => !p.isUdhaarReceive)
    .reduce((sum, p) => sum + (Number(p.advancePayment) || 0), 0);

  // Factory Buy Udhaar willingly paid to factory (cuts from user balance, adds to factory balance)
  const factoryUdhaarTotal = purchases
    .filter((p) => p.isUdhaarReceive || Number(p.udhaarReceiveAmount) > 0)
    .reduce((sum, p) => sum + (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0), 0);

  // Direct cash payments made to company/factory (cuts from user balance, adds to factory balance)
  const factoryDirectTotal = payments
    .filter((p) => p.type === 'PAYMENT_TO_COMPANY')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Total cash paid to factory by user across all methods:
  const totalPaidToFactory = factorySpotTotal + factoryAdvanceTotal + factoryUdhaarTotal + factoryDirectTotal;

  // Factory Dana (debt borrowed from factory across purchases)
  const factoryDanaTotal = purchases
    .filter((p) => !p.isUdhaarReceive)
    .reduce((sum, p) => sum + (Number(p.borrowedAmount) || 0), 0);

  // Remaining active factory dana debt (dana borrowed minus debt repayments made via direct payments or udhaar receive)
  const activeFactoryDana = Math.max(
    0,
    factoryDanaTotal - factoryDirectTotal - factoryUdhaarTotal
  );

  // 2. RETAIL KHATA MONEY FLOWS:
  // Spot cash received from farmers at retail counter (adds to user balance)
  const retSpotCash = sales
    .filter((s) => s.saleType === 'RETAIL')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Advance payments received from farmers (adds to user balance)
  const retAdvanceCash = sales
    .filter((s) => s.saleType === 'RETAIL')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  const customerIdSet = new Set(customers?.map((c) => c.id) || []);
  const partyIdSet = new Set(parties?.map((p) => p.id) || []);

  const isRetailPayment = (p: Payment) => {
    if (p.partyType === 'RETAIL_CUSTOMER') return true;
    if (p.partyType === 'WHOLESALE_DEALER') return false;
    if (p.partyId && customerIdSet.has(p.partyId)) return true;
    if (p.partyId && partyIdSet.has(p.partyId)) return false;
    if (p.notes && /retail|counter|farmer/i.test(p.notes)) return true;
    return false;
  };

  const custPayments = payments.filter(
    (p) => p.type === 'PAYMENT_FROM_CUSTOMER' && !(p as any).isLinkedToFactoryBuy
  );

  // Customer debt repayments collected (adds to user balance)
  const retCustPayTotal = custPayments
    .filter(isRetailPayment)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // Total retail money collected by user:
  const retailKhataMoney = retSpotCash + retAdvanceCash + retCustPayTotal;

  // 3. WHOLESALE MONEY FLOWS:
  // Wholesale dealer spot cash routed to Factory (default)
  const wsFactorySpotCash = sales
    .filter((s) => s.saleType === 'WHOLESALE' && s.destinationAccount !== 'USER')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Wholesale dealer advance payments routed to Factory (default)
  const wsFactoryAdvanceCash = sales
    .filter((s) => s.saleType === 'WHOLESALE' && s.destinationAccount !== 'USER')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  // Wholesale dealer spot cash routed to User
  const wsUserSpotCash = sales
    .filter((s) => s.saleType === 'WHOLESALE' && s.destinationAccount === 'USER')
    .reduce((sum, s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || Number(s.paidSpot) || 0;
      const pureSpot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      return sum + (Number(pureSpot) || 0);
    }, 0);

  // Wholesale dealer advance payments routed to User
  const wsUserAdvanceCash = sales
    .filter((s) => s.saleType === 'WHOLESALE' && s.destinationAccount === 'USER')
    .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);

  // Wholesale dealer debt repayments
  const wsCustPayTotal = custPayments
    .filter((p) => !isRetailPayment(p))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const wsFactoryCash = wsFactorySpotCash + wsFactoryAdvanceCash + wsCustPayTotal;
  const wsUserCash = wsUserSpotCash + wsUserAdvanceCash;
  const wholesaleCash = wsFactoryCash + wsUserCash;
  const wsSpotCash = wsFactorySpotCash + wsUserSpotCash;
  const wsAdvanceCash = wsFactoryAdvanceCash + wsUserAdvanceCash;

  // 4. DAILY GENERAL SHOP EXPENSES:
  const shopExpensesTotal = (shopExpenses || []).reduce(
    (sum, exp) => sum + (Number(exp.amount) || 0),
    0
  );

  // 5. TREASURY AUDIT CR / DR:
  const crSum = companyPayments.filter((cp) => cp.entryType === 'CR').reduce((s, cp) => s + (Number(cp.amount) || 0), 0);
  const drSum = companyPayments.filter((cp) => cp.entryType === 'DR').reduce((s, cp) => s + (Number(cp.amount) || 0), 0);
  const netCrDrTreasury = crSum - drSum;

  // 6. LOGICAL BALANCES:
  // User Balance: Initial opening balance + Inflows from Retail Khata + Wholesale routed to User (Spot + Advance)
  // minus Factory Buy Purchases (Spot + Advance + Willingly paid Udhaar)
  // minus Direct Supplier Payments
  // minus Daily Shop Expenses
  const userBalance = (Number(initialUserBalance) || 0) + retailKhataMoney + wsUserCash - totalPaidToFactory - shopExpensesTotal;

  // Factory Balance:
  // Receives all payments to factory (Spot Purchases + Advance Payments + Willingly paid Udhaar + Direct Payments)
  // plus Wholesale cash routed to Factory (Spot + Advance + Dealer Payments)
  // plus Net Treasury CR/DR
  const companyBalance = Math.max(0, totalPaidToFactory + wsFactoryCash + netCrDrTreasury);

  return {
    userBalance,
    initialUserBalance: Number(initialUserBalance) || 0,
    companyBalance,
    retailKhataMoney,
    retSpotCash,
    retAdvanceCash,
    retCustPayTotal,
    wholesaleCash,
    wsFactoryCash,
    wsUserCash,
    wsFactorySpotCash,
    wsFactoryAdvanceCash,
    wsUserSpotCash,
    wsUserAdvanceCash,
    wsSpotCash,
    wsAdvanceCash,
    wsCustPayTotal,
    totalPaidToFactory,
    factorySpotTotal,
    factoryAdvanceTotal,
    factoryUdhaarTotal,
    factoryDirectTotal,
    activeFactoryDana,
    factoryDanaTotal,
    shopExpensesTotal,
    netCrDrTreasury
  };
}

export const api = {
  ensureDefaults: async (): Promise<void> => {
    try {
      const compSnap = await getDocs(userCol('companies'));
      if (compSnap.empty) {
        const defaultComp: Company = {
          id: 'comp-default',
          name: 'Supreme Feeds Ltd',
          city: 'Gujranwala',
          contactPerson: auth.currentUser?.displayName || 'Farooq Gujjar',
          phone: '0300-1234567',
          bankDetails: 'HBL 1234567890',
          totalPurchases: 0,
          totalPayments: 0,
          currentBalance: 0
        };
        await setDoc(userDoc('companies', defaultComp.id), defaultComp);
      }

      const branchRef = userDoc('branchAccount', 'main');
      const branchSnap = await getDoc(branchRef);
      if (!branchSnap.exists()) {
        const defaultBranch: BranchAccount = {
          userName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
          branchName: `${auth.currentUser?.displayName || 'Farooq Gujjar KB'} (Branch)`,
          userBalance: 0,
          companyBalance: 0,
          primaryCompanyId: 'comp-default',
          primaryCompanyName: 'Supreme Feeds Ltd'
        };
        await setDoc(branchRef, defaultBranch);
      }
    } catch (err) {
      console.warn('ensureDefaults check warning:', err);
    }
  },

  clearCache: clearApiCache,

  fetchAllAppData: async (skipCache = false) => {
    if (skipCache) {
      clearApiCache();
    }
    const [
      dashStats,
      feedItems,
      compList,
      partyList,
      custList,
      purList,
      salesList,
      payList,
      tppList,
      expenseList
    ] = await Promise.all([
      api.getDashboard().catch(() => null),
      api.getItems().catch(() => []),
      api.getCompanies().catch(() => []),
      api.getParties().catch(() => []),
      api.getCustomers().catch(() => []),
      api.getPurchases().catch(() => []),
      api.getSales().catch(() => []),
      fetchCollection<Payment>('payments').catch(() => []),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments').catch(() => []),
      api.getShopExpenses().catch(() => [])
    ]);

    return {
      stats: dashStats,
      items: feedItems,
      companies: compList,
      parties: partyList,
      customers: custList,
      purchases: purList,
      sales: salesList,
      payments: payList,
      thirdPartyPayments: tppList,
      shopExpenses: expenseList
    };
  },

  // 1. Dashboard
  getDashboard: async (): Promise<DashboardStats> => {
    try {
      await api.ensureDefaults();
      const [items, sales, purchases, payments, parties, customers, companies, companyPayments, shopExpenses] = await Promise.all([
        fetchCollection<FeedItem>('items'),
        fetchCollection<Sale>('sales'),
        fetchCollection<Purchase>('purchases'),
        fetchCollection<Payment>('payments'),
        fetchCollection<Party>('parties'),
        fetchCollection<Customer>('customers'),
        fetchCollection<Company>('companies'),
        fetchCollection<CompanyPayment>('companyPayments'),
        fetchCollection<ShopExpense>('shopExpenses')
      ]);

      const totalPurchasedBags = purchases.filter(p => !p.isUdhaarReceive).reduce((acc, p) => acc + (Number(p.quantityBags) || 0), 0);
      const totalSoldBags = sales.reduce((acc, s) => acc + (Number(s.quantityBags) || 0), 0);
      const totalWholesaleBags = sales.filter(s => s.saleType === 'WHOLESALE').reduce((acc, s) => acc + (Number(s.quantityBags) || 0), 0);
      const totalRetailBags = sales.filter(s => s.saleType === 'RETAIL').reduce((acc, s) => acc + (Number(s.quantityBags) || 0), 0);
      const itemsStockBags = items.reduce((acc, i) => acc + (Number(i.stockBags) || 0), 0);
      const totalStockBags = (totalPurchasedBags > 0 || totalSoldBags > 0) ? Math.max(0, totalPurchasedBags - totalSoldBags) : itemsStockBags;
      const totalStockValue = items.reduce((acc, i) => acc + ((Number(i.stockBags) || 0) * (Number(i.purchasePrice) || 0)), 0);

      const totalWholesaleReceivables = parties.reduce((acc, p) => acc + Math.max(0, Number(p.currentBalance) || 0), 0);
      const totalRetailReceivables = customers.reduce((acc, c) => acc + Math.max(0, Number(c.currentBalance) || 0), 0);
      const totalCustomerReceivables = totalWholesaleReceivables + totalRetailReceivables;

      let initialUserBalance = 0;
      try {
        const branchSnap = await getDoc(userDoc('branchAccount', 'main'));
        if (branchSnap.exists()) {
          initialUserBalance = Number(branchSnap.data().initialUserBalance) || 0;
        }
      } catch (e) {
        // ignore
      }

      const { userBalance, companyBalance, activeFactoryDana } = computeBranchBalances(
        purchases, 
        sales, 
        payments, 
        companyPayments, 
        customers, 
        parties, 
        shopExpenses,
        initialUserBalance
      );
      const totalCompanyPayables = activeFactoryDana;
      const netPosition = totalCustomerReceivables + totalStockValue - totalCompanyPayables;

      const today = new Date().toISOString().split('T')[0];
      const todaySales = sales.filter((s) => s.date === today);
      const todaySalesBags = todaySales.reduce((acc, s) => acc + (Number(s.quantityBags) || 0), 0);
      const todaySalesRevenue = todaySales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);

      const todayPurchases = purchases.filter((p) => p.date === today && !p.isUdhaarReceive);
      const todayPurchasesBags = todayPurchases.reduce((acc, p) => acc + (Number(p.quantityBags) || 0), 0);
      const todayPurchasesCost = todayPurchases.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);

      const stats: DashboardStats = {
        totalStockBags,
        totalStockValue,
        totalCompanyPayables,
        totalWholesaleReceivables,
        totalRetailReceivables,
        totalCustomerReceivables,
        netPosition,
        todaySalesBags,
        todaySalesRevenue,
        todayPurchasesBags,
        todayPurchasesCost,
        totalPurchasedBags,
        totalSoldBags,
        totalWholesaleBags,
        totalRetailBags,
        itemsCount: items.length,
        companiesCount: companies.length,
        partiesCount: parties.length,
        userBalance,
        companyBalance,
        userName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
        lastSync: new Date().toISOString(),
        meta: {
          businessName: 'KB Factory',
          tagline: 'Wholesale Distributor & Retail Center',
          ownerName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
          phone: '',
          currency: 'Rs. (PKR)'
        }
      };

      localStorageBackup.save('dashboard', stats);
      return stats;
    } catch (err) {
      const cached = localStorageBackup.get<DashboardStats>('dashboard');
      if (cached) return cached;
      throw err;
    }
  },

  // 2. Feed Items
  getItems: async (): Promise<FeedItem[]> => {
    try {
      const items = await fetchCollection<FeedItem>('items');
      localStorageBackup.save('items', items);
      return items;
    } catch (err) {
      const cached = localStorageBackup.get<FeedItem[]>('items');
      if (cached) return cached;
      throw err;
    }
  },

  createItem: async (item: Partial<FeedItem>): Promise<FeedItem> => {
    const uid = getUserId();
    const id = item.id || 'item-' + Date.now();
    unmarkDeleted(id);
    const newItem: FeedItem = {
      id,
      name: item.name || 'New Item',
      category: item.category || 'General',
      bagWeightKg: Number(item.bagWeightKg) || 50,
      unit: item.unit || 'Bags (50kg)',
      stockBags: Number(item.stockBags) || 0,
      minStockAlert: Number(item.minStockAlert) || 20,
      purchasePrice: Number(item.purchasePrice) || 0,
      wholesalePrice: Number(item.wholesalePrice) || 0,
      retailPrice: Number(item.retailPrice) || 0,
      manufacturer: item.manufacturer || 'Supreme Feeds'
    };
    try {
      await setDoc(userDoc('items', id), cleanForFirestore(newItem));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/items/${id}`);
    }
    const existing = localStorageBackup.get<FeedItem[]>('items') || [];
    localStorageBackup.save('items', [...existing.filter(i => i.id !== id), newItem]);
    return newItem;
  },

  updateItem: async (id: string, item: Partial<FeedItem>): Promise<FeedItem> => {
    const uid = getUserId();
    let updated: FeedItem = { id, name: item.name || 'Item', ...item } as FeedItem;
    try {
      const currentSnap = await getDoc(userDoc('items', id));
      const existing = currentSnap.exists() ? currentSnap.data() : {};
      updated = {
        ...(existing as FeedItem),
        ...item,
        id
      };
      await setDoc(userDoc('items', id), cleanForFirestore(updated));
      return updated;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/items/${id}`);
      return updated;
    }
  },

  deleteItem: async (itemId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = itemId.replace(/^(item-)+/, '');
    markAsDeleted(itemId);
    if (cleanId) markAsDeleted(cleanId);
    try {
      await deleteDoc(userDoc('items', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/items/${itemId}`);
    }
    const curItems = localStorageBackup.get<FeedItem[]>('items') || [];
    localStorageBackup.save('items', curItems.filter(i => i.id !== itemId && i.id !== cleanId));
  },

  // 3. Companies / Factories
  getCompanies: async (): Promise<Company[]> => {
    try {
      const [companies, purchases, sales, payments, companyPayments] = await Promise.all([
        fetchCollection<Company>('companies'),
        fetchCollection<Purchase>('purchases'),
        fetchCollection<Sale>('sales'),
        fetchCollection<Payment>('payments'),
        fetchCollection<CompanyPayment>('companyPayments')
      ]);

      const companiesWithCut = companies.map((comp) => {
        const compDana = purchases
          .filter((p) => p.companyId === comp.id && !p.isUdhaarReceive)
          .reduce((sum, p) => sum + (Number(p.borrowedAmount) || 0), 0);
        const compDirect = payments
          .filter((p) => p.companyId === comp.id && p.type === 'PAYMENT_TO_COMPANY')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const compUdhaar = purchases
          .filter((p) => p.companyId === comp.id && (p.isUdhaarReceive || Number(p.udhaarReceiveAmount) > 0))
          .reduce((sum, p) => sum + (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0), 0);
        const compActiveDana = Math.max(0, compDana - compDirect - compUdhaar);

        // Advance money given to factory vs consumed in purchases
        const compAdvanceGiven = purchases
          .filter((p) => p.companyId === comp.id && !p.isUdhaarReceive)
          .reduce((sum, p) => sum + (Number(p.advancePayment) || 0), 0);
        const compAdvanceConsumed = purchases
          .filter((p) => p.companyId === comp.id && !p.isUdhaarReceive)
          .reduce((sum, p) => sum + (Number(p.advanceUsed) || 0), 0);
        const compAvailableAdvance = Math.max(0, compAdvanceGiven - compAdvanceConsumed);

        return {
          ...comp,
          currentBalance: compActiveDana,
          advanceBalance: compAvailableAdvance
        };
      });

      localStorageBackup.save('companies', companiesWithCut);
      return companiesWithCut;
    } catch (err) {
      const cached = localStorageBackup.get<Company[]>('companies');
      if (cached) return cached;
      return [];
    }
  },

  createCompany: async (company: Partial<Company> & { initialBalance?: number }): Promise<Company> => {
    const uid = getUserId();
    const id = company.id || 'comp-' + Date.now();
    unmarkDeleted(id);
    const initBal = Number(company.initialBalance) || Number(company.currentBalance) || 0;
    const newComp: Company = {
      id,
      name: company.name || 'New Company',
      contactPerson: company.contactPerson || '',
      phone: company.phone || '',
      city: company.city || '',
      bankDetails: company.bankDetails || '',
      totalPurchases: initBal,
      totalPayments: 0,
      currentBalance: initBal
    };
    try {
      await setDoc(userDoc('companies', id), cleanForFirestore(newComp));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/companies/${id}`);
    }
    const existing = localStorageBackup.get<Company[]>('companies') || [];
    localStorageBackup.save('companies', [...existing.filter(c => c.id !== id), newComp]);
    return newComp;
  },

  getCompanyLedger: async (
    companyId: string
  ): Promise<{ company: Company; ledgerEntries: LedgerEntry[]; calculatedBalance: number }> => {
    const companies = await api.getCompanies();
    const company = companies.find((c) => c.id === companyId);
    if (!company) throw new Error('Company not found');

    const [purchases, directPayments, thirdPartyPayments, sales, payments, companyPayments] = await Promise.all([
      fetchCollection<Purchase>('purchases'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<CompanyPayment>('companyPayments')
    ]);

    const compPurchases = purchases.filter((p) => p.companyId === company.id);
    const compDirectPayments = directPayments.filter(
      (p) => p.companyId === company.id && p.type === 'PAYMENT_TO_COMPANY'
    );
    const compTpp = thirdPartyPayments.filter((t) => t.companyId === company.id);

    const compDana = compPurchases
      .filter((p) => !p.isUdhaarReceive)
      .reduce((sum, p) => sum + (Number(p.borrowedAmount) || 0), 0);
    const compDirect = compDirectPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const compUdhaar = compPurchases
      .filter((p) => p.isUdhaarReceive || Number(p.udhaarReceiveAmount) > 0)
      .reduce((sum, p) => sum + (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0), 0);
    const compActiveDana = Math.max(0, compDana - compDirect - compUdhaar);

    const ledgerEntries: LedgerEntry[] = [];

    compPurchases.forEach((p) => {
      if (p.isUdhaarReceive) {
        const credit = Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0;
        if (credit > 0) {
          ledgerEntries.push({
            id: 'pur-ur-' + p.id,
            date: p.date,
            type: 'PAYMENT',
            description: p.partyName 
              ? `Wholesale Udhaar (recieve) Payback: ${p.partyName}`
              : `User Udhaar (recieve) Payback: Farooq Gujjar KB`,
            debit: 0,
            credit,
            reference: p.biltyNumber || p.id
          });
        }
        return;
      }

      const adv = Number(p.advancePayment) || 0;
      const advUsed = Number(p.advanceUsed) || 0;
      const totalPaid = Number(p.paidNow) || Number(p.givenOnSpot) || 0;
      const spot = p.givenOnSpot !== undefined && p.givenOnSpot !== p.paidNow ? Number(p.givenOnSpot) : Math.max(0, totalPaid - adv);
      const borrowed = Number(p.borrowedAmount) || 0;
      const totalCost = Number(p.totalAmount) > 0 ? Number(p.totalAmount) : (borrowed + spot + advUsed);

      ledgerEntries.push({
        id: 'pur-' + p.id,
        date: p.date,
        type: 'PURCHASE',
        description: `Factory Purchase: ${p.itemName || 'Stock'} (${p.quantityBags || 0} Bags)`,
        debit: totalCost,
        credit: 0,
        reference: p.biltyNumber || p.id
      });

      if (advUsed > 0) {
        ledgerEntries.push({
          id: 'adv-used-' + p.id,
          date: p.date,
          type: 'PAYMENT',
          description: `Paid via Available Advance Credit (Prepaid)`,
          debit: 0,
          credit: advUsed,
          reference: p.biltyNumber || p.id
        });
      }

      if (spot > 0) {
        ledgerEntries.push({
          id: 'spot-pur-' + p.id,
          date: p.date,
          type: 'PAYMENT',
          description: `Spot Cash Payment to Factory`,
          debit: 0,
          credit: spot,
          reference: p.biltyNumber || p.id
        });
      }

      if (adv > 0) {
        ledgerEntries.push({
          id: 'adv-pur-' + p.id,
          date: p.date,
          type: 'PAYMENT',
          description: `Advance Payment Added to Factory Pool`,
          debit: 0,
          credit: adv,
          reference: p.biltyNumber || p.id
        });
      }
    });

    compDirectPayments.forEach((dp) => {
      ledgerEntries.push({
        id: 'dp-' + dp.id,
        date: dp.date,
        type: 'PAYMENT',
        description: `Direct Payment to Factory (${dp.paymentMethod})`,
        debit: 0,
        credit: Number(dp.amount) || 0,
        reference: dp.referenceNumber || dp.id
      });
    });

    compTpp.forEach((tpp) => {
      ledgerEntries.push({
        id: 'tpp-' + tpp.id,
        date: tpp.date,
        type: 'THIRD_PARTY_DEPOSIT',
        description: `Direct Deposit by Customer: ${tpp.customerName || 'Party'} into Factory Bank`,
        debit: 0,
        credit: Number(tpp.amount) || 0,
        reference: tpp.depositSlipNumber || tpp.id
      });
    });

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    ledgerEntries.forEach((entry) => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      entry.runningBalance = runningBalance;
    });

    const finalCalculatedBalance = compActiveDana;

    return {
      company,
      ledgerEntries,
      calculatedBalance: finalCalculatedBalance
    };
  },

  deleteCompany: async (companyId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = companyId.replace(/^(comp-)+/, '');
    const [companies, purchases, payments, tpps] = await Promise.all([
      fetchCollection<Company>('companies'),
      fetchCollection<Purchase>('purchases'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments')
    ]);

    const comp = companies.find((c) => c.id === companyId || c.id === cleanId || c.id.endsWith(cleanId));
    const actualId = comp ? comp.id : companyId;
    markAsDeleted(actualId);
    markAsDeleted(companyId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);

    batch.delete(userDoc('companies', actualId));

    purchases.filter((p) => p.companyId === actualId || p.companyId === companyId).forEach((p) => {
      markAsDeleted(p.id);
      batch.delete(userDoc('purchases', p.id));
    });

    payments
      .filter((p) => p.type === 'PAYMENT_TO_COMPANY' && (p.companyId === actualId || p.companyId === companyId))
      .forEach((p) => {
        markAsDeleted(p.id);
        batch.delete(userDoc('payments', p.id));
      });

    tpps.filter((t) => t.companyId === actualId || t.companyId === companyId).forEach((t) => {
      markAsDeleted(t.id);
      batch.delete(userDoc('thirdPartyPayments', t.id));
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/companies/${actualId}`);
    }

    const curComps = localStorageBackup.get<Company[]>('companies') || [];
    localStorageBackup.save('companies', curComps.filter(c => c.id !== actualId && c.id !== companyId && c.id !== cleanId));

    const curPurchases = localStorageBackup.get<Purchase[]>('purchases') || [];
    localStorageBackup.save('purchases', curPurchases.filter(p => p.companyId !== actualId && p.companyId !== companyId));

    const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
    localStorageBackup.save('payments', curPayments.filter(p => !(p.type === 'PAYMENT_TO_COMPANY' && (p.companyId === actualId || p.companyId === companyId))));

    const curTpps = localStorageBackup.get<ThirdPartyPayment[]>('thirdPartyPayments') || [];
    localStorageBackup.save('thirdPartyPayments', curTpps.filter(t => t.companyId !== actualId && t.companyId !== companyId));
  },

  // 4. Wholesale Big Parties
  getParties: async (): Promise<Party[]> => {
    try {
      const [parties, sales] = await Promise.all([
        fetchCollection<Party>('parties'),
        fetchCollection<Sale>('sales')
      ]);

      const partiesWithAdv = parties.map((party) => {
        const partySales = sales.filter((s) => s.partyId === party.id);
        
        // Factory Account Advance:
        const factoryAdvGiven = partySales
          .filter((s) => s.destinationAccount !== 'USER')
          .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);
        const factoryAdvConsumed = partySales
          .filter((s) => s.destinationAccount !== 'USER')
          .reduce((sum, s) => sum + (Number(s.advanceUsed) || 0), 0);
        const factoryAdvanceBalance = Math.max(0, factoryAdvGiven - factoryAdvConsumed);

        // User Account Advance:
        const userAdvGiven = partySales
          .filter((s) => s.destinationAccount === 'USER')
          .reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);
        const userAdvConsumed = partySales
          .filter((s) => s.destinationAccount === 'USER')
          .reduce((sum, s) => sum + (Number(s.advanceUsed) || 0), 0);
        const userAdvanceBalance = Math.max(0, userAdvGiven - userAdvConsumed);

        const availableAdv = factoryAdvanceBalance + userAdvanceBalance;

        return {
          ...party,
          advanceBalance: availableAdv,
          factoryAdvanceBalance,
          userAdvanceBalance
        };
      });

      localStorageBackup.save('parties', partiesWithAdv);
      return partiesWithAdv;
    } catch (err) {
      const cached = localStorageBackup.get<Party[]>('parties');
      if (cached) return cached;
      throw err;
    }
  },

  createParty: async (party: any): Promise<Party> => {
    const uid = getUserId();
    const id = party.id || 'party-' + Date.now();
    unmarkDeleted(id);
    const initBal = Number(party.initialBalance) || Number(party.currentBalance) || 0;
    const newParty: Party = {
      id,
      name: party.name || 'New Party',
      type: 'WHOLESALE_DEALER',
      phone: party.phone || '',
      area: party.city || party.area || '',
      vehicleNumbers: party.vehicleNumber ? [party.vehicleNumber] : party.vehicleNumbers || [],
      creditLimit: Number(party.creditLimit) || 0,
      totalSales: initBal,
      totalReceived: 0,
      currentBalance: initBal
    };
    try {
      await setDoc(userDoc('parties', id), cleanForFirestore(newParty));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/parties/${id}`);
    }
    const existing = localStorageBackup.get<Party[]>('parties') || [];
    localStorageBackup.save('parties', [...existing.filter(p => p.id !== id), newParty]);
    return newParty;
  },

  deleteParty: async (partyId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = partyId.replace(/^(party-)+/, '');
    const [parties, sales, payments, tpps, purchases, items, companies] = await Promise.all([
      fetchCollection<Party>('parties'),
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<Purchase>('purchases'),
      fetchCollection<FeedItem>('items'),
      fetchCollection<Company>('companies')
    ]);

    const party = parties.find((p) => p.id === partyId || p.id === cleanId || p.id.endsWith(cleanId));
    const actualId = party ? party.id : partyId;
    const partyName = party ? party.name.trim() : '';

    markAsDeleted(actualId);
    markAsDeleted(partyId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);

    // 1. Delete Party document
    batch.delete(userDoc('parties', actualId));

    // Matcher helper
    const matchesParty = (id?: string, name?: string, notes?: string) => {
      if (id && (id === actualId || id === partyId || id === cleanId || id.endsWith(cleanId))) return true;
      if (partyName && name && name.trim().toLowerCase() === partyName.toLowerCase()) return true;
      if (partyName && notes && notes.toLowerCase().includes(partyName.toLowerCase())) return true;
      return false;
    };

    // Track items that need their stock restored
    const updatedItemsMap = new Map<string, FeedItem>();
    items.forEach(i => updatedItemsMap.set(i.id, { ...i }));

    // Track companies that need adjustments
    const updatedCompaniesMap = new Map<string, Company>();
    companies.forEach(c => updatedCompaniesMap.set(c.id, { ...c }));

    // 2. Matching Sales (Wholesale dispatches / sales to this party)
    const matchingSales = sales.filter((s) => matchesParty(s.partyId, s.partyName, s.notes));
    const deletedSaleIds = new Set<string>();
    matchingSales.forEach((s) => {
      deletedSaleIds.add(s.id);
      markAsDeleted(s.id);
      batch.delete(userDoc('sales', s.id));
      if (s.itemId && Number(s.quantityBags) > 0) {
        const item = updatedItemsMap.get(s.itemId);
        if (item) {
          item.stockBags = (Number(item.stockBags) || 0) + Number(s.quantityBags);
          updatedItemsMap.set(s.itemId, item);
        }
      }
    });

    // 3. Matching Purchases (Factory Buy entries linked to this wholesale party, e.g. Udhaar receive)
    const matchingPurchases = purchases.filter((p) => matchesParty(p.partyId, p.partyName, p.notes));
    const deletedPurchaseIds = new Set<string>();
    matchingPurchases.forEach((p) => {
      deletedPurchaseIds.add(p.id);
      markAsDeleted(p.id);
      batch.delete(userDoc('purchases', p.id));

      // Also mark linked payment for this purchase as deleted
      const linkedPayId = 'pay-pur-' + p.id;
      markAsDeleted(linkedPayId);
      batch.delete(userDoc('payments', linkedPayId));

      // If this purchase added stock bags (normal purchase), reverse it
      if (!p.isUdhaarReceive && p.itemId && Number(p.quantityBags) > 0) {
        const item = updatedItemsMap.get(p.itemId);
        if (item) {
          item.stockBags = Math.max(0, (Number(item.stockBags) || 0) - Number(p.quantityBags));
          updatedItemsMap.set(p.itemId, item);
        }
      }

      // If linked to a factory company, reverse the company totals
      if (p.companyId) {
        const comp = updatedCompaniesMap.get(p.companyId);
        if (comp) {
          comp.totalPurchases = Math.max(0, (Number(comp.totalPurchases) || 0) - (Number(p.borrowedAmount) || Number(p.totalAmount) || 0));
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(p.paidNow) || Number(p.givenOnSpot) || 0));
          updatedCompaniesMap.set(p.companyId, comp);
        }
      }
    });

    // 4. Matching Payments
    const matchingPayments = payments.filter((p) => {
      if (matchesParty(p.partyId, p.partyName, p.notes)) return true;
      if (p.id.startsWith('pay-pur-')) {
        const linkedPurId = p.id.replace(/^pay-pur-/, '');
        if (deletedPurchaseIds.has(linkedPurId)) return true;
      }
      if (deletedSaleIds.has(p.id)) return true;
      return false;
    });

    matchingPayments.forEach((p) => {
      markAsDeleted(p.id);
      batch.delete(userDoc('payments', p.id));
      if (p.type === 'PAYMENT_TO_COMPANY' && p.companyId) {
        const comp = updatedCompaniesMap.get(p.companyId);
        if (comp) {
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(p.amount) || 0));
          comp.currentBalance = (Number(comp.currentBalance) || 0) + (Number(p.amount) || 0);
          updatedCompaniesMap.set(p.companyId, comp);
        }
      }
    });

    // 5. Matching Third-Party Payments (TPPs)
    const matchingTpps = tpps.filter((t) => matchesParty(t.customerPartyId, t.customerName, t.notes));
    matchingTpps.forEach((t) => {
      markAsDeleted(t.id);
      batch.delete(userDoc('thirdPartyPayments', t.id));
      if (t.companyId) {
        const comp = updatedCompaniesMap.get(t.companyId);
        if (comp) {
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(t.amount) || 0));
          comp.currentBalance = (Number(comp.currentBalance) || 0) + (Number(t.amount) || 0);
          updatedCompaniesMap.set(t.companyId, comp);
        }
      }
    });

    // 6. Write updated items & companies to batch
    for (const [_, item] of updatedItemsMap) {
      const original = items.find(i => i.id === item.id);
      if (original && original.stockBags !== item.stockBags) {
        batch.set(userDoc('items', item.id), cleanForFirestore(item));
      }
    }

    for (const [_, comp] of updatedCompaniesMap) {
      const original = companies.find(c => c.id === comp.id);
      if (original && (original.totalPurchases !== comp.totalPurchases || original.totalPayments !== comp.totalPayments || original.currentBalance !== comp.currentBalance)) {
        batch.set(userDoc('companies', comp.id), cleanForFirestore(comp));
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/parties/${actualId}`);
    }

    // 7. Update all local caches (localStorageBackup) so every section is immediately in sync
    const curParties = localStorageBackup.get<Party[]>('parties') || [];
    localStorageBackup.save('parties', curParties.filter(p => !matchesParty(p.id, p.name)));

    const curSales = localStorageBackup.get<Sale[]>('sales') || [];
    localStorageBackup.save('sales', curSales.filter(s => !deletedSaleIds.has(s.id) && !matchesParty(s.partyId, s.partyName, s.notes)));

    const curPurchases = localStorageBackup.get<Purchase[]>('purchases') || [];
    localStorageBackup.save('purchases', curPurchases.filter(p => !deletedPurchaseIds.has(p.id) && !matchesParty(p.partyId, p.partyName, p.notes)));

    const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
    const deletedPayIds = new Set(matchingPayments.map(p => p.id));
    matchingPurchases.forEach(p => deletedPayIds.add('pay-pur-' + p.id));
    localStorageBackup.save('payments', curPayments.filter(p => !deletedPayIds.has(p.id) && !matchesParty(p.partyId, p.partyName, p.notes)));

    const curTpps = localStorageBackup.get<ThirdPartyPayment[]>('thirdPartyPayments') || [];
    const deletedTppIds = new Set(matchingTpps.map(t => t.id));
    localStorageBackup.save('thirdPartyPayments', curTpps.filter(t => !deletedTppIds.has(t.id) && !matchesParty(t.customerPartyId, t.customerName, t.notes)));

    localStorageBackup.save('items', Array.from(updatedItemsMap.values()));
    localStorageBackup.save('companies', Array.from(updatedCompaniesMap.values()));
  },

  getPartyLedger: async (
    partyId: string
  ): Promise<{ party: Party; ledgerEntries: LedgerEntry[]; calculatedBalance: number }> => {
    const parties = await api.getParties();
    const party = parties.find((p) => p.id === partyId);
    if (!party) throw new Error('Party not found');

    const [sales, directPayments, thirdPartyDeposits, purchases] = await Promise.all([
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<Purchase>('purchases')
    ]);

    const partySales = sales.filter((s) => s.partyId === party.id);
    const partyPayments = directPayments.filter(
      (p) => p.partyId === party.id && p.type === 'PAYMENT_FROM_CUSTOMER'
    );
    const partyTpp = thirdPartyDeposits.filter((t) => t.customerPartyId === party.id);
    const partyUdhaarReceives = purchases.filter(
      (pur) => (pur.partyId === party.id || (pur as any).linkedPartyId === party.id) && pur.isUdhaarReceive
    );

    const ledgerEntries: LedgerEntry[] = [];

    partySales.forEach((s) => {
      const acctTag = s.destinationAccount === 'USER' ? ' [User Account]' : ' [Factory Account]';
      ledgerEntries.push({
        id: 'sale-' + s.id,
        date: s.date,
        type: 'SALE',
        description: `Wholesale Dispatch${acctTag}: ${s.itemName || 'Feed'} (${s.quantityBags || 0} Bags)`,
        debit: Number(s.totalAmount) || 0,
        credit: 0,
        reference: s.invoiceNumber || s.id
      });
      if (Number(s.advanceUsed) > 0) {
        const advAcct = s.destinationAccount === 'USER' ? 'User Advance' : 'Factory Advance';
        ledgerEntries.push({
          id: 'adv-used-' + s.id,
          date: s.date,
          type: 'PAYMENT',
          description: `Settled via Available ${advAcct} Credit (Prepaid)`,
          debit: 0,
          credit: Number(s.advanceUsed),
          reference: s.invoiceNumber || s.id
        });
      }
      if (Number(s.paidAmount) > 0) {
        const advAmt = Number(s.advancePayment) || 0;
        const spotAmt = Math.max(0, (Number(s.paidAmount) || 0) - advAmt);
        const acctLabel = s.destinationAccount === 'USER' ? 'User Account' : 'Factory Account';
        if (spotAmt > 0) {
          ledgerEntries.push({
            id: 'spot-' + s.id,
            date: s.date,
            type: 'PAYMENT',
            description: `Spot Cash Payment at Dispatch (${acctLabel})`,
            debit: 0,
            credit: spotAmt,
            reference: s.invoiceNumber || s.id
          });
        }
        if (advAmt > 0) {
          ledgerEntries.push({
            id: 'adv-' + s.id,
            date: s.date,
            type: 'PAYMENT',
            description: `Advance Payment Received from Dealer (${acctLabel})`,
            debit: 0,
            credit: advAmt,
            reference: s.invoiceNumber || s.id
          });
        }
      }
    });

    partyPayments.forEach((p) => {
      if ((p as any).isLinkedToFactoryBuy) return;
      ledgerEntries.push({
        id: 'pay-' + p.id,
        date: p.date,
        type: 'PAYMENT',
        description: `Direct Payment Received (${p.paymentMethod})`,
        debit: 0,
        credit: Number(p.amount) || 0,
        reference: p.referenceNumber || p.id
      });
    });

    partyTpp.forEach((tpp) => {
      ledgerEntries.push({
        id: 'tpp-' + tpp.id,
        date: tpp.date,
        type: 'THIRD_PARTY_DEPOSIT',
        description: `Factory Direct Bank Deposit: Credited to Supplier`,
        debit: 0,
        credit: Number(tpp.amount) || 0,
        reference: tpp.depositSlipNumber || tpp.id
      });
    });

    partyUdhaarReceives.forEach((ur) => {
      const cutAmt = Number(ur.udhaarReceiveAmount) || Number(ur.partyCutAmount) || 0;
      ledgerEntries.push({
        id: 'pur-ur-' + ur.id,
        date: ur.date,
        type: 'PAYMENT',
        description: `Factory Buy: Udhaar (recieve) Dana Payback`,
        debit: 0,
        credit: cutAmt,
        reference: ur.biltyNumber || ur.id
      });
    });

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    ledgerEntries.forEach((entry) => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      entry.runningBalance = runningBalance;
    });

    return {
      party,
      ledgerEntries,
      calculatedBalance: runningBalance
    };
  },

  // 5. Local Customers (Retail Khata)
  getCustomers: async (): Promise<Customer[]> => {
    try {
      const [customers, sales] = await Promise.all([
        fetchCollection<Customer>('customers'),
        fetchCollection<Sale>('sales')
      ]);

      const customersWithAdv = customers.map((cust) => {
        const custSales = sales.filter((s) => s.partyId === cust.id);
        const custAdvGiven = custSales.reduce((sum, s) => sum + (Number(s.advancePayment) || 0), 0);
        const custAdvConsumed = custSales.reduce((sum, s) => sum + (Number(s.advanceUsed) || 0), 0);
        const availableAdv = Math.max(0, custAdvGiven - custAdvConsumed);
        return {
          ...cust,
          advanceBalance: availableAdv
        };
      });

      localStorageBackup.save('customers', customersWithAdv);
      return customersWithAdv;
    } catch (err) {
      const cached = localStorageBackup.get<Customer[]>('customers');
      if (cached) return cached;
      throw err;
    }
  },

  createCustomer: async (customer: any): Promise<Customer> => {
    const uid = getUserId();
    const id = customer.id || 'cust-' + Date.now();
    unmarkDeleted(id);
    const initBal = Number(customer.initialBalance) || Number(customer.currentBalance) || 0;
    const newCust: Customer = {
      id,
      name: customer.name || 'New Customer',
      phone: customer.phone || '',
      village: customer.village || '',
      cattleCount: Number(customer.cattleCount) || 0,
      totalSales: initBal,
      totalReceived: 0,
      currentBalance: initBal
    };
    try {
      await setDoc(userDoc('customers', id), cleanForFirestore(newCust));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${uid}/customers/${id}`);
    }
    const existing = localStorageBackup.get<Customer[]>('customers') || [];
    localStorageBackup.save('customers', [...existing.filter(c => c.id !== id), newCust]);
    return newCust;
  },

  deleteCustomer: async (customerId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = customerId.replace(/^(cust-)+/, '');
    const [customers, sales, payments, tpps, purchases, items, companies] = await Promise.all([
      fetchCollection<Customer>('customers'),
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<Purchase>('purchases'),
      fetchCollection<FeedItem>('items'),
      fetchCollection<Company>('companies')
    ]);

    const customer = customers.find((c) => c.id === customerId || c.id === cleanId || c.id.endsWith(cleanId));
    const actualId = customer ? customer.id : customerId;
    const customerName = customer ? customer.name.trim() : '';

    markAsDeleted(actualId);
    markAsDeleted(customerId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);

    // 1. Delete Customer document
    batch.delete(userDoc('customers', actualId));

    // Matcher helper
    const matchesCustomer = (id?: string, name?: string, notes?: string) => {
      if (id && (id === actualId || id === customerId || id === cleanId || id.endsWith(cleanId))) return true;
      if (customerName && name && name.trim().toLowerCase() === customerName.toLowerCase()) return true;
      if (customerName && notes && notes.toLowerCase().includes(customerName.toLowerCase())) return true;
      return false;
    };

    // Track items that need their stock restored
    const updatedItemsMap = new Map<string, FeedItem>();
    items.forEach(i => updatedItemsMap.set(i.id, { ...i }));

    // Track companies that need adjustments
    const updatedCompaniesMap = new Map<string, Company>();
    companies.forEach(c => updatedCompaniesMap.set(c.id, { ...c }));

    // 2. Matching Sales (Retail counter sales / sales to this customer)
    const matchingSales = sales.filter((s) => matchesCustomer(s.partyId, s.partyName, s.notes));
    const deletedSaleIds = new Set<string>();
    matchingSales.forEach((s) => {
      deletedSaleIds.add(s.id);
      markAsDeleted(s.id);
      batch.delete(userDoc('sales', s.id));
      if (s.itemId && Number(s.quantityBags) > 0) {
        const item = updatedItemsMap.get(s.itemId);
        if (item) {
          item.stockBags = (Number(item.stockBags) || 0) + Number(s.quantityBags);
          updatedItemsMap.set(s.itemId, item);
        }
      }
    });

    // 3. Matching Purchases (if any factory buy/udhaar was linked to this customer)
    const matchingPurchases = purchases.filter((p) => matchesCustomer(p.partyId, p.partyName, p.notes));
    const deletedPurchaseIds = new Set<string>();
    matchingPurchases.forEach((p) => {
      deletedPurchaseIds.add(p.id);
      markAsDeleted(p.id);
      batch.delete(userDoc('purchases', p.id));

      const linkedPayId = 'pay-pur-' + p.id;
      markAsDeleted(linkedPayId);
      batch.delete(userDoc('payments', linkedPayId));

      if (!p.isUdhaarReceive && p.itemId && Number(p.quantityBags) > 0) {
        const item = updatedItemsMap.get(p.itemId);
        if (item) {
          item.stockBags = Math.max(0, (Number(item.stockBags) || 0) - Number(p.quantityBags));
          updatedItemsMap.set(p.itemId, item);
        }
      }

      if (p.companyId) {
        const comp = updatedCompaniesMap.get(p.companyId);
        if (comp) {
          comp.totalPurchases = Math.max(0, (Number(comp.totalPurchases) || 0) - (Number(p.borrowedAmount) || Number(p.totalAmount) || 0));
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(p.paidNow) || Number(p.givenOnSpot) || 0));
          updatedCompaniesMap.set(p.companyId, comp);
        }
      }
    });

    // 4. Matching Payments
    const matchingPayments = payments.filter((p) => {
      if (matchesCustomer(p.partyId, p.partyName, p.notes)) return true;
      if (p.id.startsWith('pay-pur-')) {
        const linkedPurId = p.id.replace(/^pay-pur-/, '');
        if (deletedPurchaseIds.has(linkedPurId)) return true;
      }
      if (deletedSaleIds.has(p.id)) return true;
      return false;
    });

    matchingPayments.forEach((p) => {
      markAsDeleted(p.id);
      batch.delete(userDoc('payments', p.id));
      if (p.type === 'PAYMENT_TO_COMPANY' && p.companyId) {
        const comp = updatedCompaniesMap.get(p.companyId);
        if (comp) {
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(p.amount) || 0));
          comp.currentBalance = (Number(comp.currentBalance) || 0) + (Number(p.amount) || 0);
          updatedCompaniesMap.set(p.companyId, comp);
        }
      }
    });

    // 5. Matching Third-Party Payments (TPPs)
    const matchingTpps = tpps.filter((t) => matchesCustomer(t.customerPartyId, t.customerName, t.notes));
    matchingTpps.forEach((t) => {
      markAsDeleted(t.id);
      batch.delete(userDoc('thirdPartyPayments', t.id));
      if (t.companyId) {
        const comp = updatedCompaniesMap.get(t.companyId);
        if (comp) {
          comp.totalPayments = Math.max(0, (Number(comp.totalPayments) || 0) - (Number(t.amount) || 0));
          comp.currentBalance = (Number(comp.currentBalance) || 0) + (Number(t.amount) || 0);
          updatedCompaniesMap.set(t.companyId, comp);
        }
      }
    });

    // 6. Write updated items & companies to batch
    for (const [_, item] of updatedItemsMap) {
      const original = items.find(i => i.id === item.id);
      if (original && original.stockBags !== item.stockBags) {
        batch.set(userDoc('items', item.id), cleanForFirestore(item));
      }
    }

    for (const [_, comp] of updatedCompaniesMap) {
      const original = companies.find(c => c.id === comp.id);
      if (original && (original.totalPurchases !== comp.totalPurchases || original.totalPayments !== comp.totalPayments || original.currentBalance !== comp.currentBalance)) {
        batch.set(userDoc('companies', comp.id), cleanForFirestore(comp));
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/customers/${actualId}`);
    }

    // 7. Update all local caches
    const curCusts = localStorageBackup.get<Customer[]>('customers') || [];
    localStorageBackup.save('customers', curCusts.filter(c => !matchesCustomer(c.id, c.name)));

    const curSales = localStorageBackup.get<Sale[]>('sales') || [];
    localStorageBackup.save('sales', curSales.filter(s => !deletedSaleIds.has(s.id) && !matchesCustomer(s.partyId, s.partyName, s.notes)));

    const curPurchases = localStorageBackup.get<Purchase[]>('purchases') || [];
    localStorageBackup.save('purchases', curPurchases.filter(p => !deletedPurchaseIds.has(p.id) && !matchesCustomer(p.partyId, p.partyName, p.notes)));

    const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
    const deletedPayIds = new Set(matchingPayments.map(p => p.id));
    matchingPurchases.forEach(p => deletedPayIds.add('pay-pur-' + p.id));
    localStorageBackup.save('payments', curPayments.filter(p => !deletedPayIds.has(p.id) && !matchesCustomer(p.partyId, p.partyName, p.notes)));

    const curTpps = localStorageBackup.get<ThirdPartyPayment[]>('thirdPartyPayments') || [];
    const deletedTppIds = new Set(matchingTpps.map(t => t.id));
    localStorageBackup.save('thirdPartyPayments', curTpps.filter(t => !deletedTppIds.has(t.id) && !matchesCustomer(t.customerPartyId, t.customerName, t.notes)));

    localStorageBackup.save('items', Array.from(updatedItemsMap.values()));
    localStorageBackup.save('companies', Array.from(updatedCompaniesMap.values()));
  },

  getCustomerLedger: async (
    customerId: string
  ): Promise<{ customer: Customer; ledgerEntries: LedgerEntry[]; calculatedBalance: number }> => {
    const customers = await api.getCustomers();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) throw new Error('Customer not found');

    const [sales, directPayments, thirdPartyDeposits] = await Promise.all([
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments')
    ]);

    const custSales = sales.filter((s) => s.partyId === customer.id);
    const custPayments = directPayments.filter(
      (p) => p.partyId === customer.id && p.type === 'PAYMENT_FROM_CUSTOMER'
    );
    const custTpp = thirdPartyDeposits.filter((t) => t.customerPartyId === customer.id);

    const ledgerEntries: LedgerEntry[] = [];

    custSales.forEach((s) => {
      ledgerEntries.push({
        id: 'sale-' + s.id,
        date: s.date,
        type: 'SALE',
        description: `Retail Counter Sale: ${s.itemName || 'Feed'} (${s.quantityBags || 0} Bags)`,
        debit: Number(s.totalAmount) || 0,
        credit: 0,
        reference: s.invoiceNumber || s.id
      });
      if (Number(s.advanceUsed) > 0) {
        ledgerEntries.push({
          id: 'adv-used-' + s.id,
          date: s.date,
          type: 'PAYMENT',
          description: `Settled via Available Advance Credit (Prepaid)`,
          debit: 0,
          credit: Number(s.advanceUsed),
          reference: s.invoiceNumber || s.id
        });
      }
      if (Number(s.paidAmount) > 0) {
        const advAmt = Number(s.advancePayment) || 0;
        const spotAmt = Math.max(0, (Number(s.paidAmount) || 0) - advAmt);
        if (spotAmt > 0) {
          ledgerEntries.push({
            id: 'spot-' + s.id,
            date: s.date,
            type: 'PAYMENT',
            description: `Spot Cash Paid at Counter`,
            debit: 0,
            credit: spotAmt,
            reference: s.invoiceNumber || s.id
          });
        }
        if (advAmt > 0) {
          ledgerEntries.push({
            id: 'adv-' + s.id,
            date: s.date,
            type: 'PAYMENT',
            description: `Advance Payment Received from Customer`,
            debit: 0,
            credit: advAmt,
            reference: s.invoiceNumber || s.id
          });
        }
      }
    });

    custPayments.forEach((p) => {
      ledgerEntries.push({
        id: 'pay-' + p.id,
        date: p.date,
        type: 'PAYMENT',
        description: `Direct Payment Received (${p.paymentMethod})`,
        debit: 0,
        credit: Number(p.amount) || 0,
        reference: p.referenceNumber || p.id
      });
    });

    custTpp.forEach((tpp) => {
      ledgerEntries.push({
        id: 'tpp-' + tpp.id,
        date: tpp.date,
        type: 'THIRD_PARTY_DEPOSIT',
        description: `Direct Bank Deposit into Factory Account`,
        debit: 0,
        credit: Number(tpp.amount) || 0,
        reference: tpp.depositSlipNumber || tpp.id
      });
    });

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    ledgerEntries.forEach((entry) => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      entry.runningBalance = runningBalance;
    });

    return {
      customer,
      ledgerEntries,
      calculatedBalance: runningBalance
    };
  },

  // 6. Purchases
  getPurchases: async (): Promise<Purchase[]> => {
    try {
      const purchases = await fetchCollection<Purchase>('purchases');
      purchases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorageBackup.save('purchases', purchases);
      return purchases;
    } catch (err) {
      const cached = localStorageBackup.get<Purchase[]>('purchases');
      if (cached) return cached;
      throw err;
    }
  },

  recordPurchase: async (payload: {
    companyId: string;
    partyId?: string;
    partyName?: string;
    partyCutAmount?: number;
    isUdhaarReceive?: boolean;
    udhaarReceiveAmount?: number;
    isUserUdhaarReceive?: boolean;
    linkedPurchaseId?: string;
    itemId?: string;
    quantityBags?: number;
    ratePerBag?: number;
    vehicleNumber?: string;
    biltyNumber?: string;
    driverName?: string;
    date: string;
    paidNow?: number;
    borrowedAmount?: number;
    givenOnSpot?: number;
    advancePayment?: number;
    advanceUsed?: number;
    amount?: number;
    transactionMode?: 'BORROW_DANA' | 'GIVEN_ON_SPOT';
    notes?: string;
  }): Promise<{ message: string; data: Purchase; currentBalance?: number; partyBalance?: number }> => {
    const uid = getUserId();
    const [companies, items, parties] = await Promise.all([
      fetchCollection<Company>('companies'),
      fetchCollection<FeedItem>('items'),
      fetchCollection<Party>('parties')
    ]);

    let company = companies.find((c) => c.id === payload.companyId) || companies[0];
    if (!company) {
      company = {
        id: 'comp-default',
        name: 'Supreme Feeds Ltd',
        city: 'Gujranwala',
        contactPerson: auth.currentUser?.displayName || 'Farooq Gujjar',
        phone: '0300-1234567',
        bankDetails: 'HBL 1234567890',
        totalPurchases: 0,
        totalPayments: 0,
        currentBalance: 0
      };
    }

    const item = items.find((i) => i.id === payload.itemId) || items[0];
    const itemName = item ? item.name : 'Factory Product / Stock';

    const isUdhaarReceive = Boolean(
      payload.isUdhaarReceive ||
      payload.udhaarReceiveAmount ||
      (payload.partyId && payload.partyCutAmount)
    );

    const qty = Number(payload.quantityBags) || 0;
    const rate = Number(payload.ratePerBag) || (item ? item.purchasePrice : 0);
    const totalAmount = isUdhaarReceive ? 0 : qty > 0 && rate > 0 ? qty * rate : Number(payload.amount) || 0;

    let borrowed = 0;
    let spot = 0;
    const advance = Number(payload.advancePayment) || 0;
    const advanceUsed = Number(payload.advanceUsed) || 0;

    if (payload.transactionMode === 'BORROW_DANA') {
      borrowed = Number(payload.borrowedAmount) || Math.max(0, totalAmount - advanceUsed);
      spot = 0;
    } else if (payload.transactionMode === 'GIVEN_ON_SPOT') {
      spot = Number(payload.givenOnSpot) || Number(payload.paidNow) || Math.max(0, totalAmount - advanceUsed);
      borrowed = 0;
    } else {
      spot = Number(payload.givenOnSpot) !== undefined ? Number(payload.givenOnSpot) : (Number(payload.paidNow) || 0);
      borrowed = payload.borrowedAmount !== undefined ? Number(payload.borrowedAmount) : Math.max(0, totalAmount - advanceUsed - spot);
    }

    const totalPaid = spot + advance;

    const partyCutAmount = Number(payload.partyCutAmount) || Number(payload.udhaarReceiveAmount) || 0;
    const linkedParty = payload.partyId ? parties.find((p) => p.id === payload.partyId) : null;
    const actualPartyName = linkedParty ? linkedParty.name : payload.partyName || '';

    const newPurchaseId = 'pur-' + Date.now();
    unmarkDeleted(newPurchaseId);

    const notesSummary = payload.notes || (isUdhaarReceive ? (actualPartyName ? `Wholesale Party: ${actualPartyName} - Udhaar (recieve) Payback` : 'User (Farooq Gujjar KB) - Factory Buy Udhaar Received') : borrowed > 0 ? 'Borrow from Factory (Dana)' : 'Paid on Spot to Factory (Normal Transaction)');
    let notesExtra = '';
    if (advanceUsed > 0) notesExtra += ` [From Advance: Rs. ${advanceUsed.toLocaleString()}]`;
    if (advance > 0) notesExtra += ` [Advance to Factory: Rs. ${advance.toLocaleString()}]`;
    const finalNotes = notesExtra ? `${notesSummary}${notesExtra}` : notesSummary;

    const finalTotalAmount = isUdhaarReceive ? 0 : (totalAmount > 0 ? totalAmount : (spot + advanceUsed + borrowed));

    const newPurchase: Purchase = {
      id: newPurchaseId,
      companyId: company.id,
      companyName: company.name,
      entryType: isUdhaarReceive ? 'UDHAAR_RECEIVE' : 'PURCHASE',
      isUdhaarReceive,
      isUserUdhaarReceive: payload.isUserUdhaarReceive ?? (!payload.partyId && isUdhaarReceive),
      linkedPurchaseId: payload.linkedPurchaseId,
      itemId: item ? item.id : 'unknown',
      itemName,
      quantityBags: qty,
      ratePerBag: rate,
      totalAmount: finalTotalAmount,
      borrowedAmount: borrowed,
      givenOnSpot: spot,
      advancePayment: advance > 0 ? advance : undefined,
      advanceUsed: advanceUsed > 0 ? advanceUsed : undefined,
      balanceAdded: borrowed,
      vehicleNumber: payload.vehicleNumber || 'N/A',
      biltyNumber: payload.biltyNumber || (isUdhaarReceive ? `REC-${Math.floor(10000 + Math.random() * 90000)}` : `BL-${Math.floor(10000 + Math.random() * 90000)}`),
      driverName: payload.driverName || '',
      date: payload.date || new Date().toISOString().split('T')[0],
      paidNow: totalPaid,
      paymentStatus: borrowed === 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'CREDIT',
      notes: finalNotes
    };

    if (linkedParty) {
      newPurchase.partyId = linkedParty.id;
      newPurchase.partyName = linkedParty.name;
    } else if (actualPartyName) {
      newPurchase.partyName = actualPartyName;
    }

    if (isUdhaarReceive && partyCutAmount > 0) {
      newPurchase.partyCutAmount = partyCutAmount;
      newPurchase.udhaarReceiveAmount = partyCutAmount;
    }

    const batch = writeBatch(db);

    batch.set(userDoc('purchases', newPurchase.id), cleanForFirestore(newPurchase));

    if (linkedParty && isUdhaarReceive && partyCutAmount > 0) {
      const linkedPayment: Payment = {
        id: 'pay-pur-' + newPurchase.id,
        type: 'PAYMENT_FROM_CUSTOMER',
        partyId: linkedParty.id,
        partyName: linkedParty.name,
        partyType: 'WHOLESALE_DEALER',
        amount: partyCutAmount,
        paymentMethod: 'Factory Buy - Udhaar (recieve)',
        referenceNumber: newPurchase.biltyNumber,
        date: newPurchase.date,
        isLinkedToFactoryBuy: true,
        notes: `Pay/Receive: Normal payback received from wholesale party ${linkedParty.name} via Factory Buy`
      };
      batch.set(userDoc('payments', linkedPayment.id), cleanForFirestore(linkedPayment));

      linkedParty.currentBalance = Math.max(0, (linkedParty.currentBalance || 0) - partyCutAmount);
      linkedParty.totalReceived = (linkedParty.totalReceived || 0) + partyCutAmount;
      batch.set(userDoc('parties', linkedParty.id), cleanForFirestore(linkedParty));
    }

    if (!isUdhaarReceive && item && qty > 0) {
      item.stockBags = (item.stockBags || 0) + qty;
      if (rate > 0) item.purchasePrice = rate;
      batch.set(userDoc('items', item.id), cleanForFirestore(item));
    }

    if (!isUdhaarReceive) {
      company.totalPurchases = (company.totalPurchases || 0) + finalTotalAmount;
      company.totalPayments = (company.totalPayments || 0) + totalPaid;
      company.currentBalance = Math.max(0, (company.currentBalance || 0) + borrowed);
    }
    batch.set(userDoc('companies', company.id), cleanForFirestore(company));

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/purchases/${newPurchase.id}`);
    }

    // Synchronize local cache for immediate UI persistence
    const curPurchases = localStorageBackup.get<Purchase[]>('purchases') || [];
    localStorageBackup.save('purchases', [newPurchase, ...curPurchases.filter(p => p.id !== newPurchase.id)]);

    if (!isUdhaarReceive && item && qty > 0) {
      const curItems = localStorageBackup.get<FeedItem[]>('items') || [];
      localStorageBackup.save('items', [...curItems.filter(i => i.id !== item.id), item]);
    }

    const curCompanies = localStorageBackup.get<Company[]>('companies') || [];
    localStorageBackup.save('companies', [...curCompanies.filter(c => c.id !== company.id), company]);

    if (linkedParty && isUdhaarReceive && partyCutAmount > 0) {
      const curParties = localStorageBackup.get<Party[]>('parties') || [];
      localStorageBackup.save('parties', [...curParties.filter(p => p.id !== linkedParty.id), linkedParty]);
    }

    return {
      message: isUdhaarReceive ? 'Udhaar (recieve) recorded successfully' : 'Purchase recorded successfully',
      data: newPurchase,
      currentBalance: company.currentBalance,
      partyBalance: linkedParty ? linkedParty.currentBalance : undefined
    };
  },

  deletePurchase: async (purchaseId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = purchaseId.replace(/^(pur-ur-|pur-)+/, '');
    const [purchases, items, companies] = await Promise.all([
      fetchCollection<Purchase>('purchases'),
      fetchCollection<FeedItem>('items'),
      fetchCollection<Company>('companies')
    ]);

    const pur = purchases.find((p) => p.id === purchaseId || p.id === cleanId || p.id.endsWith(cleanId));
    if (!pur) return;

    const actualId = pur.id;
    markAsDeleted(actualId);
    markAsDeleted(purchaseId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);
    batch.delete(userDoc('purchases', actualId));

    if (pur.isUdhaarReceive) {
      const linkedPaymentId = 'pay-pur-' + actualId;
      markAsDeleted(linkedPaymentId);
      batch.delete(userDoc('payments', linkedPaymentId));
      
      const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
      localStorageBackup.save('payments', curPayments.filter(p => p.id !== linkedPaymentId));

      const partyId = pur.partyId;
      if (partyId) {
        const parties = await fetchCollection<Party>('parties');
        const party = parties.find(p => p.id === partyId || p.id.endsWith(partyId.replace(/^party-/, '')));
        if (party) {
          const cutAmt = Number(pur.udhaarReceiveAmount) || Number(pur.partyCutAmount) || 0;
          party.currentBalance = (party.currentBalance || 0) + cutAmt;
          party.totalReceived = Math.max(0, (party.totalReceived || 0) - cutAmt);
          batch.set(userDoc('parties', party.id), cleanForFirestore(party));
          const curParties = localStorageBackup.get<Party[]>('parties') || [];
          localStorageBackup.save('parties', [...curParties.filter(p => p.id !== party.id), party]);
        }
      }
    }

    if (!pur.isUdhaarReceive && pur.itemId && Number(pur.quantityBags) > 0) {
      const item = items.find((i) => i.id === pur.itemId);
      if (item) {
        item.stockBags = Math.max(0, (item.stockBags || 0) - Number(pur.quantityBags));
        batch.set(userDoc('items', item.id), cleanForFirestore(item));
      }
    }

    if (pur.companyId) {
      const comp = companies.find((c) => c.id === pur.companyId);
      if (comp) {
        comp.totalPurchases = Math.max(0, (comp.totalPurchases || 0) - (pur.borrowedAmount || pur.totalAmount || 0));
        comp.totalPayments = Math.max(0, (comp.totalPayments || 0) - (pur.paidNow || pur.givenOnSpot || 0));
        batch.set(userDoc('companies', comp.id), cleanForFirestore(comp));
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/purchases/${actualId}`);
    }

    const curPurchases = localStorageBackup.get<Purchase[]>('purchases') || [];
    localStorageBackup.save('purchases', curPurchases.filter(p => p.id !== actualId && p.id !== purchaseId && p.id !== cleanId));

    if (!pur.isUdhaarReceive && pur.itemId && Number(pur.quantityBags) > 0) {
      const item = items.find((i) => i.id === pur.itemId);
      if (item) {
        const curItems = localStorageBackup.get<FeedItem[]>('items') || [];
        localStorageBackup.save('items', [...curItems.filter(i => i.id !== item.id), item]);
      }
    }

    if (pur.companyId) {
      const comp = companies.find((c) => c.id === pur.companyId);
      if (comp) {
        const curComps = localStorageBackup.get<Company[]>('companies') || [];
        localStorageBackup.save('companies', [...curComps.filter(c => c.id !== comp.id), comp]);
      }
    }
  },

  // 7. Sales (Wholesale & Retail)
  getSales: async (): Promise<Sale[]> => {
    try {
      const sales = await fetchCollection<Sale>('sales');
      sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      localStorageBackup.save('sales', sales);
      return sales;
    } catch (err) {
      const cached = localStorageBackup.get<Sale[]>('sales');
      if (cached) return cached;
      throw err;
    }
  },

  recordSale: async (payload: {
    saleType: 'WHOLESALE' | 'RETAIL';
    destinationAccount?: 'FACTORY' | 'USER';
    partyId: string;
    itemId?: string;
    quantityBags?: number;
    ratePerBag?: number;
    discount?: number;
    paidAmount?: number;
    borrowedLana?: number;
    paidSpot?: number;
    advancePayment?: number;
    advanceUsed?: number;
    totalAmount?: number;
    vehicleNumber?: string;
    driverName?: string;
    date: string;
    notes?: string;
  }): Promise<{ message: string; data: Sale }> => {
    const uid = getUserId();
    const [items, parties, customers] = await Promise.all([
      fetchCollection<FeedItem>('items'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    const item = items.find((i) => i.id === payload.itemId);
    const itemName = item ? item.name : 'Feed Item';

    let partyName = 'Counter Customer';
    let targetEntity: Party | Customer | undefined;

    if (payload.saleType === 'WHOLESALE') {
      targetEntity = parties.find((p) => p.id === payload.partyId);
      partyName = targetEntity ? targetEntity.name : 'Wholesale Dealer';
    } else {
      targetEntity = customers.find((c) => c.id === payload.partyId);
      partyName = targetEntity ? targetEntity.name : 'Walk-in Farmer';
    }

    const qty = Number(payload.quantityBags) || 0;
    const rate = Number(payload.ratePerBag) || 0;
    const discount = Number(payload.discount) || 0;
    const totalAmount = payload.totalAmount !== undefined ? payload.totalAmount : qty * rate - discount;

    const advanceUsed = Number(payload.advanceUsed) || 0;
    const spot = Number(payload.paidSpot) !== undefined && payload.paidSpot !== null
      ? Number(payload.paidSpot)
      : (Number(payload.paidAmount) || 0);
    const advanceVal = Number(payload.advancePayment) || 0;
    const totalPaid = spot + advanceVal;
    const borrowed = payload.borrowedLana !== undefined 
      ? Number(payload.borrowedLana) 
      : Math.max(0, totalAmount - advanceUsed - spot);

    const finalTotalAmount = totalAmount > 0 ? totalAmount : (spot + advanceUsed + borrowed);

    const newSaleId = 'sale-' + Date.now();
    unmarkDeleted(newSaleId);

    let notesExtra = '';
    if (advanceUsed > 0) notesExtra += ` [From Advance: Rs. ${advanceUsed.toLocaleString()}]`;
    if (advanceVal > 0) notesExtra += ` [Advance Received: Rs. ${advanceVal.toLocaleString()}]`;
    const notesWithAdv = notesExtra ? `${payload.notes || ''}${notesExtra}` : (payload.notes || '');

    const newSale: Sale = {
      id: newSaleId,
      saleType: payload.saleType,
      destinationAccount: payload.saleType === 'WHOLESALE' ? (payload.destinationAccount || 'FACTORY') : undefined,
      partyId: payload.partyId,
      partyName,
      itemId: item ? item.id : 'unknown',
      itemName,
      quantityBags: qty,
      ratePerBag: rate,
      discount,
      netAmount: finalTotalAmount,
      totalAmount: finalTotalAmount,
      paidAmount: totalPaid,
      paidSpot: spot,
      advancePayment: advanceVal > 0 ? advanceVal : undefined,
      advanceUsed: advanceUsed > 0 ? advanceUsed : undefined,
      borrowedLana: borrowed,
      remainingBalance: borrowed,
      vehicleNumber: payload.vehicleNumber || 'N/A',
      driverName: payload.driverName || '',
      date: payload.date || new Date().toISOString().split('T')[0],
      invoiceNumber: payload.saleType === 'WHOLESALE' ? `INV-WS-${Math.floor(1000 + Math.random() * 9000)}` : `INV-RT-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: notesWithAdv
    };

    const batch = writeBatch(db);

    batch.set(userDoc('sales', newSale.id), cleanForFirestore(newSale));

    if (item && qty > 0) {
      item.stockBags = Math.max(0, (item.stockBags || 0) - qty);
      batch.set(userDoc('items', item.id), cleanForFirestore(item));
    }

    if (targetEntity) {
      targetEntity.totalSales = (targetEntity.totalSales || 0) + finalTotalAmount;
      targetEntity.totalReceived = (targetEntity.totalReceived || 0) + totalPaid;
      // If purchase of goods, balance increases by remaining unpaid debt (borrowed)
      // If pure advance deposit (totalAmount 0 & borrowed 0), balance decreases by advance paid
      if (finalTotalAmount === 0 && advanceVal > 0) {
        targetEntity.currentBalance = Math.max(0, (targetEntity.currentBalance || 0) - advanceVal);
      } else {
        targetEntity.currentBalance = Math.max(0, (targetEntity.currentBalance || 0) + borrowed);
      }

      const colName = payload.saleType === 'WHOLESALE' ? 'parties' : 'customers';
      batch.set(userDoc(colName, targetEntity.id), cleanForFirestore(targetEntity));
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/sales/${newSale.id}`);
    }

    const curSales = localStorageBackup.get<Sale[]>('sales') || [];
    localStorageBackup.save('sales', [newSale, ...curSales.filter(s => s.id !== newSale.id)]);

    if (item && qty > 0) {
      const curItems = localStorageBackup.get<FeedItem[]>('items') || [];
      localStorageBackup.save('items', [...curItems.filter(i => i.id !== item.id), item]);
    }

    if (targetEntity) {
      const colName = payload.saleType === 'WHOLESALE' ? 'parties' : 'customers';
      const curEntities = localStorageBackup.get<any[]>(colName) || [];
      localStorageBackup.save(colName, [...curEntities.filter(e => e.id !== targetEntity!.id), targetEntity]);
    }

    return { message: 'Sale recorded successfully', data: newSale };
  },

  deleteSale: async (saleId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = saleId.replace(/^(sale-|spot-)+/, '');
    const [sales, items, parties, customers] = await Promise.all([
      fetchCollection<Sale>('sales'),
      fetchCollection<FeedItem>('items'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    const sale = sales.find((s) => s.id === saleId || s.id === cleanId || s.id.endsWith(cleanId));
    if (!sale) return;

    const actualId = sale.id;
    markAsDeleted(actualId);
    markAsDeleted(saleId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);
    batch.delete(userDoc('sales', actualId));

    if (sale.itemId && Number(sale.quantityBags) > 0) {
      const item = items.find((i) => i.id === sale.itemId);
      if (item) {
        item.stockBags = (item.stockBags || 0) + Number(sale.quantityBags);
        batch.set(userDoc('items', item.id), cleanForFirestore(item));
      }
    }

    const colName = sale.saleType === 'WHOLESALE' ? 'parties' : 'customers';
    const target = sale.saleType === 'WHOLESALE'
      ? parties.find((p) => p.id === sale.partyId)
      : customers.find((c) => c.id === sale.partyId);

    if (target) {
      target.totalSales = Math.max(0, (target.totalSales || 0) - (sale.totalAmount || 0));
      target.totalReceived = Math.max(0, (target.totalReceived || 0) - (sale.paidAmount || sale.paidSpot || 0));
      const adv = Number(sale.advancePayment) || 0;
      target.currentBalance = Math.max(0, (target.currentBalance || 0) - (sale.borrowedLana || 0) + adv);
      batch.set(userDoc(colName, target.id), cleanForFirestore(target));
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/sales/${actualId}`);
    }

    const curSales = localStorageBackup.get<Sale[]>('sales') || [];
    localStorageBackup.save('sales', curSales.filter(s => s.id !== actualId && s.id !== saleId && s.id !== cleanId));

    if (sale.itemId && Number(sale.quantityBags) > 0) {
      const item = items.find((i) => i.id === sale.itemId);
      if (item) {
        const curItems = localStorageBackup.get<FeedItem[]>('items') || [];
        localStorageBackup.save('items', [...curItems.filter(i => i.id !== item.id), item]);
      }
    }

    if (target) {
      const curTargets = localStorageBackup.get<any[]>(colName) || [];
      localStorageBackup.save(colName, [...curTargets.filter(t => t.id !== target.id), target]);
    }
  },

  // 8. Direct Payments
  recordPayment: async (payload: {
    type: 'PAYMENT_TO_COMPANY' | 'PAYMENT_FROM_CUSTOMER';
    targetId: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    date: string;
    notes?: string;
  }): Promise<{ message: string; data: Payment }> => {
    const uid = getUserId();
    const [companies, parties, customers] = await Promise.all([
      fetchCollection<Company>('companies'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    let partyName = '';
    let companyName = '';
    let partyType: 'WHOLESALE_DEALER' | 'RETAIL_CUSTOMER' | undefined;

    const batch = writeBatch(db);

    if (payload.type === 'PAYMENT_TO_COMPANY') {
      const comp = companies.find((c) => c.id === payload.targetId) || companies[0];
      if (comp) {
        companyName = comp.name;
        comp.totalPayments = (comp.totalPayments || 0) + Number(payload.amount);
        comp.currentBalance = Math.max(0, (comp.currentBalance || 0) - Number(payload.amount));
        batch.set(userDoc('companies', comp.id), cleanForFirestore(comp));
      }
    } else {
      const party = parties.find((p) => p.id === payload.targetId);
      if (party) {
        partyName = party.name;
        partyType = 'WHOLESALE_DEALER';
        party.totalReceived = (party.totalReceived || 0) + Number(payload.amount);
        party.currentBalance = Math.max(0, (party.currentBalance || 0) - Number(payload.amount));
        batch.set(userDoc('parties', party.id), cleanForFirestore(party));
      } else {
        const cust = customers.find((c) => c.id === payload.targetId);
        if (cust) {
          partyName = cust.name;
          partyType = 'RETAIL_CUSTOMER';
          cust.totalReceived = (cust.totalReceived || 0) + Number(payload.amount);
          cust.currentBalance = Math.max(0, (cust.currentBalance || 0) - Number(payload.amount));
          batch.set(userDoc('customers', cust.id), cleanForFirestore(cust));
        }
      }
    }

    const newPaymentId = 'pay-' + Date.now();
    unmarkDeleted(newPaymentId);
    const newPayment: Payment = {
      id: newPaymentId,
      type: payload.type,
      partyId: payload.type === 'PAYMENT_FROM_CUSTOMER' ? payload.targetId : undefined,
      partyName: partyName || undefined,
      partyType,
      companyId: payload.type === 'PAYMENT_TO_COMPANY' ? payload.targetId : undefined,
      companyName: companyName || undefined,
      amount: Number(payload.amount),
      paymentMethod: payload.paymentMethod,
      referenceNumber: payload.referenceNumber || `REC-${Math.floor(1000 + Math.random() * 9000)}`,
      date: payload.date || new Date().toISOString().split('T')[0],
      notes: payload.notes || ''
    };

    batch.set(userDoc('payments', newPayment.id), cleanForFirestore(newPayment));

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/payments/${newPayment.id}`);
    }

    const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
    localStorageBackup.save('payments', [newPayment, ...curPayments.filter(p => p.id !== newPayment.id)]);

    return { message: 'Payment recorded successfully', data: newPayment };
  },

  deletePayment: async (paymentId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = paymentId.replace(/^(pay-|dp-)+/, '');
    const [payments, companies, parties, customers] = await Promise.all([
      fetchCollection<Payment>('payments'),
      fetchCollection<Company>('companies'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    const pay = payments.find((p) => p.id === paymentId || p.id === cleanId || p.id.endsWith(cleanId));
    if (!pay) return;

    const actualId = pay.id;
    markAsDeleted(actualId);
    markAsDeleted(paymentId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);
    batch.delete(userDoc('payments', actualId));

    if (pay.type === 'PAYMENT_TO_COMPANY' && pay.companyId) {
      const comp = companies.find((c) => c.id === pay.companyId);
      if (comp) {
        comp.totalPayments = Math.max(0, (comp.totalPayments || 0) - (pay.amount || 0));
        comp.currentBalance = (comp.currentBalance || 0) + (pay.amount || 0);
        batch.set(userDoc('companies', comp.id), cleanForFirestore(comp));
      }
    } else if (pay.partyId) {
      const party = parties.find((p) => p.id === pay.partyId);
      if (party) {
        party.totalReceived = Math.max(0, (party.totalReceived || 0) - (pay.amount || 0));
        party.currentBalance = (party.currentBalance || 0) + (pay.amount || 0);
        batch.set(userDoc('parties', party.id), cleanForFirestore(party));
      } else {
        const cust = customers.find((c) => c.id === pay.partyId);
        if (cust) {
          cust.totalReceived = Math.max(0, (cust.totalReceived || 0) - (pay.amount || 0));
          cust.currentBalance = (cust.currentBalance || 0) + (pay.amount || 0);
          batch.set(userDoc('customers', cust.id), cleanForFirestore(cust));
        }
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/payments/${actualId}`);
    }

    const curPayments = localStorageBackup.get<Payment[]>('payments') || [];
    localStorageBackup.save('payments', curPayments.filter(p => p.id !== actualId && p.id !== paymentId && p.id !== cleanId));

    if (pay.type === 'PAYMENT_TO_COMPANY' && pay.companyId) {
      const comp = companies.find((c) => c.id === pay.companyId);
      if (comp) {
        const curComps = localStorageBackup.get<Company[]>('companies') || [];
        localStorageBackup.save('companies', [...curComps.filter(c => c.id !== comp.id), comp]);
      }
    } else if (pay.partyId) {
      const party = parties.find((p) => p.id === pay.partyId);
      if (party) {
        const curParties = localStorageBackup.get<Party[]>('parties') || [];
        localStorageBackup.save('parties', [...curParties.filter(p => p.id !== party.id), party]);
      } else {
        const cust = customers.find((c) => c.id === pay.partyId);
        if (cust) {
          const curCusts = localStorageBackup.get<Customer[]>('customers') || [];
          localStorageBackup.save('customers', [...curCusts.filter(c => c.id !== cust.id), cust]);
        }
      }
    }
  },

  // 9. Third-Party Direct Factory Payments
  recordThirdPartyPayment: async (payload: {
    customerPartyId: string;
    companyId: string;
    amount: number;
    bankName: string;
    factoryAccountTitle?: string;
    depositSlipNumber: string;
    date: string;
    recordedBy?: string;
    notes?: string;
  }): Promise<{ message: string; data: ThirdPartyPayment }> => {
    const uid = getUserId();
    const [companies, parties, customers] = await Promise.all([
      fetchCollection<Company>('companies'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    const company = companies.find((c) => c.id === payload.companyId) || companies[0];
    const party = parties.find((p) => p.id === payload.customerPartyId);
    const customer = customers.find((c) => c.id === payload.customerPartyId);

    const customerName = party ? party.name : customer ? customer.name : 'Unknown Customer';
    const amount = Number(payload.amount);

    const newTppId = 'tpp-' + Date.now();
    unmarkDeleted(newTppId);
    const newTpp: ThirdPartyPayment = {
      id: newTppId,
      customerPartyId: payload.customerPartyId,
      customerName,
      partyType: party ? 'WHOLESALE_DEALER' : 'RETAIL_CUSTOMER',
      companyId: company ? company.id : payload.companyId,
      companyName: company ? company.name : 'Factory Supplier',
      amount,
      bankName: payload.bankName,
      factoryAccountTitle: payload.factoryAccountTitle || '',
      depositSlipNumber: payload.depositSlipNumber || `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
      date: payload.date || new Date().toISOString().split('T')[0],
      recordedBy: payload.recordedBy || auth.currentUser?.displayName || 'Farooq Gujjar KB',
      notes: payload.notes || 'Third-Party direct bank deposit into factory account'
    };

    const batch = writeBatch(db);
    batch.set(userDoc('thirdPartyPayments', newTpp.id), cleanForFirestore(newTpp));

    if (party) {
      party.totalReceived = (party.totalReceived || 0) + amount;
      party.currentBalance = Math.max(0, (party.currentBalance || 0) - amount);
      batch.set(userDoc('parties', party.id), cleanForFirestore(party));
    } else if (customer) {
      customer.totalReceived = (customer.totalReceived || 0) + amount;
      customer.currentBalance = Math.max(0, (customer.currentBalance || 0) - amount);
      batch.set(userDoc('customers', customer.id), cleanForFirestore(customer));
    }

    if (company) {
      company.totalPayments = (company.totalPayments || 0) + amount;
      company.currentBalance = Math.max(0, (company.currentBalance || 0) - amount);
      batch.set(userDoc('companies', company.id), cleanForFirestore(company));
    }

    try {
      await batch.commit();
      return { message: 'Third-party payment recorded successfully', data: newTpp };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/thirdPartyPayments/${newTpp.id}`);
      return { message: 'Third-party payment recorded', data: newTpp };
    }
  },

  deleteThirdPartyPayment: async (tppId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = tppId.replace(/^(tpp-)+/, '');
    const [tpps, companies, parties, customers] = await Promise.all([
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<Company>('companies'),
      fetchCollection<Party>('parties'),
      fetchCollection<Customer>('customers')
    ]);

    const tpp = tpps.find((t) => t.id === tppId || t.id === cleanId || t.id.endsWith(cleanId));
    if (!tpp) return;

    const actualId = tpp.id;
    markAsDeleted(actualId);
    markAsDeleted(tppId);
    if (cleanId) markAsDeleted(cleanId);

    const batch = writeBatch(db);
    batch.delete(userDoc('thirdPartyPayments', actualId));

    if (tpp.companyId) {
      const comp = companies.find((c) => c.id === tpp.companyId);
      if (comp) {
        comp.totalPayments = Math.max(0, (comp.totalPayments || 0) - tpp.amount);
        comp.currentBalance = (comp.currentBalance || 0) + tpp.amount;
        batch.set(userDoc('companies', comp.id), comp);
      }
    }

    if (tpp.customerPartyId) {
      const party = parties.find((p) => p.id === tpp.customerPartyId);
      if (party) {
        party.totalReceived = Math.max(0, (party.totalReceived || 0) - tpp.amount);
        party.currentBalance = (party.currentBalance || 0) + tpp.amount;
        batch.set(userDoc('parties', party.id), party);
      } else {
        const cust = customers.find((c) => c.id === tpp.customerPartyId);
        if (cust) {
          cust.totalReceived = Math.max(0, (cust.totalReceived || 0) - tpp.amount);
          cust.currentBalance = (cust.currentBalance || 0) + tpp.amount;
          batch.set(userDoc('customers', cust.id), cust);
        }
      }
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/thirdPartyPayments/${actualId}`);
    }

    const curTpps = localStorageBackup.get<ThirdPartyPayment[]>('thirdPartyPayments') || [];
    localStorageBackup.save('thirdPartyPayments', curTpps.filter(t => t.id !== actualId && t.id !== tppId && t.id !== cleanId));

    if (tpp.companyId) {
      const comp = companies.find((c) => c.id === tpp.companyId);
      if (comp) {
        const curComps = localStorageBackup.get<Company[]>('companies') || [];
        localStorageBackup.save('companies', [...curComps.filter(c => c.id !== comp.id), comp]);
      }
    }

    if (tpp.customerPartyId) {
      const party = parties.find((p) => p.id === tpp.customerPartyId);
      if (party) {
        const curParties = localStorageBackup.get<Party[]>('parties') || [];
        localStorageBackup.save('parties', [...curParties.filter(p => p.id !== party.id), party]);
      } else {
        const cust = customers.find((c) => c.id === tpp.customerPartyId);
        if (cust) {
          const curCusts = localStorageBackup.get<Customer[]>('customers') || [];
          localStorageBackup.save('customers', [...curCusts.filter(c => c.id !== cust.id), cust]);
        }
      }
    }
  },

  // 10. History & Advanced Search
  getHistory: async (params?: {
    q?: string;
    partyId?: string;
    companyId?: string;
    vehicleNumber?: string;
    startDate?: string;
    endDate?: string;
    transactionType?: string;
  }): Promise<{ totalCount: number; data: HistoryRecord[] }> => {
    const [sales, purchases, payments, thirdPartyPayments] = await Promise.all([
      fetchCollection<Sale>('sales'),
      fetchCollection<Purchase>('purchases'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments')
    ]);

    let records: HistoryRecord[] = [];

    sales.forEach((s) => {
      const adv = Number(s.advancePayment) || 0;
      const totalPaid = Number(s.paidAmount) || 0;
      const spot = s.paidSpot !== undefined && s.paidSpot !== s.paidAmount ? Number(s.paidSpot) : Math.max(0, totalPaid - adv);
      const paidOrReceived = spot + adv;

      records.push({
        id: s.id,
        category: s.saleType === 'WHOLESALE' ? 'SALE_WHOLESALE' : 'SALE_RETAIL',
        categoryLabel: s.saleType === 'WHOLESALE' ? 'Wholesale Dispatch' : 'Retail Counter Sale',
        date: s.date,
        partyName: s.partyName || 'Customer',
        relatedEntityId: s.partyId,
        itemName: s.itemName || 'Feed',
        quantityBags: s.quantityBags,
        rate: s.ratePerBag,
        amount: s.totalAmount,
        paidOrReceived,
        spotCash: spot,
        advancePayment: adv,
        advanceUsed: Number(s.advanceUsed) || 0,
        borrowedUdhaar: s.borrowedLana,
        destinationAccount: s.destinationAccount,
        vehicleNumber: s.vehicleNumber || 'N/A',
        referenceNumber: s.invoiceNumber || s.id,
        notes: s.notes || '',
        status: s.remainingBalance > 0 ? 'PARTIAL' : 'PAID',
        raw: s
      });
    });

    purchases.forEach((p) => {
      const adv = Number(p.advancePayment) || 0;
      const advUsed = Number(p.advanceUsed) || 0;
      const totalPaid = Number(p.paidNow) || 0;
      const spot = p.givenOnSpot !== undefined && p.givenOnSpot !== p.paidNow ? Number(p.givenOnSpot) : Math.max(0, totalPaid - adv);
      const paidOrReceived = p.isUdhaarReceive ? (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0) : (spot + adv);

      records.push({
        id: p.id,
        category: 'PURCHASE',
        categoryLabel: p.isUdhaarReceive ? 'Udhaar (recieve) Payback' : 'Factory Feed Purchase',
        date: p.date,
        partyName: p.companyName || p.partyName || 'Factory',
        relatedEntityId: p.companyId,
        itemName: p.itemName || 'Feed Stock',
        quantityBags: p.quantityBags,
        rate: p.ratePerBag,
        amount: p.totalAmount,
        paidOrReceived,
        spotCash: spot,
        advancePayment: adv,
        advanceUsed: advUsed,
        borrowedUdhaar: p.borrowedAmount,
        udhaarReceive: p.udhaarReceiveAmount,
        vehicleNumber: p.vehicleNumber || 'N/A',
        referenceNumber: p.biltyNumber || p.id,
        notes: p.notes || '',
        status: p.paymentStatus || 'PAID',
        raw: p
      });
    });

    payments.forEach((p) => {
      records.push({
        id: p.id,
        category: 'PAYMENT',
        categoryLabel: p.type === 'PAYMENT_TO_COMPANY' ? 'Supplier Payment' : 'Customer Debt Payment',
        date: p.date,
        partyName: p.partyName || p.companyName || 'Cash Account',
        relatedEntityId: p.partyId || p.companyId || '',
        itemName: 'Direct Cash Transfer',
        quantityBags: 0,
        rate: 0,
        amount: p.amount,
        paidOrReceived: p.amount,
        vehicleNumber: 'N/A',
        referenceNumber: p.referenceNumber || p.id,
        notes: p.notes || '',
        status: 'COMPLETED',
        raw: p
      });
    });

    thirdPartyPayments.forEach((t) => {
      records.push({
        id: t.id,
        category: 'THIRD_PARTY',
        categoryLabel: 'Third-Party Bank Deposit',
        date: t.date,
        partyName: t.customerName,
        relatedEntityId: t.customerPartyId,
        itemName: `Direct Deposit to ${t.companyName}`,
        quantityBags: 0,
        rate: 0,
        amount: t.amount,
        paidOrReceived: t.amount,
        vehicleNumber: 'N/A',
        referenceNumber: t.depositSlipNumber || t.id,
        notes: `${t.bankName} - ${t.notes || ''}`,
        status: 'VERIFIED',
        raw: t
      });
    });

    if (params?.transactionType) {
      if (params.transactionType === 'PAYMENT') {
        records = records.filter((r) => r.category === 'PAYMENT');
      } else if (params.transactionType === 'THIRD_PARTY') {
        records = records.filter((r) => r.category === 'THIRD_PARTY');
      } else if (params.transactionType === 'PURCHASE') {
        records = records.filter((r) => r.category === 'PURCHASE');
      } else if (params.transactionType === 'SALE_WHOLESALE') {
        records = records.filter((r) => r.category === 'SALE_WHOLESALE');
      } else if (params.transactionType === 'SALE_RETAIL') {
        records = records.filter((r) => r.category === 'SALE_RETAIL');
      }
    }

    if (params?.partyId) {
      records = records.filter((r) => r.relatedEntityId === params.partyId);
    }
    if (params?.companyId) {
      records = records.filter((r) => r.relatedEntityId === params.companyId);
    }
    if (params?.vehicleNumber) {
      records = records.filter(
        (r) => r.vehicleNumber && r.vehicleNumber.toLowerCase().includes(params.vehicleNumber!.toLowerCase())
      );
    }
    if (params?.startDate) {
      records = records.filter((r) => r.date >= params.startDate!);
    }
    if (params?.endDate) {
      records = records.filter((r) => r.date <= params.endDate!);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      records = records.filter(
        (r) =>
          (r.partyName && r.partyName.toLowerCase().includes(query)) ||
          (r.itemName && r.itemName.toLowerCase().includes(query)) ||
          (r.referenceNumber && r.referenceNumber.toLowerCase().includes(query)) ||
          (r.vehicleNumber && r.vehicleNumber.toLowerCase().includes(query))
      );
    }

    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { totalCount: records.length, data: records };
  },

  // 11. Database Clear / Reset
  clearAllData: async () => {
    const uid = getUserId();
    localStorageBackup.clearAll();
    try {
      localStorage.removeItem('KB_FACTORY_DELETED_IDS');
    } catch (e) {
      // ignore
    }
    const batch = writeBatch(db);

    const cols = ['items', 'parties', 'customers', 'purchases', 'sales', 'payments', 'thirdPartyPayments', 'companyPayments'];
    for (const col of cols) {
      const snap = await getDocs(userCol(col));
      snap.forEach((d) => batch.delete(d.ref));
    }

    batch.set(userDoc('branchAccount', 'main'), {
      userName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
      branchName: `${auth.currentUser?.displayName || 'Farooq Gujjar KB'} (Branch)`,
      userBalance: 0,
      companyBalance: 0,
      primaryCompanyId: 'comp-default',
      primaryCompanyName: 'Supreme Feeds Ltd'
    });

    try {
      await batch.commit();
      return { success: true, message: 'All user data cleared successfully' };
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/*`);
    }
  },

  resetDemoData: async () => {
    return api.clearAllData();
  },

  // 12. 1-Year Retention Lifecycle & Maintenance
  getRetentionStatus: async (): Promise<RetentionStatus> => {
    const cutoffDate = getRetentionCutoffDate();
    const [purchases, sales, payments, tpps, cp] = await Promise.all([
      fetchCollection<Purchase>('purchases'),
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<CompanyPayment>('companyPayments')
    ]);

    const activePurchases = purchases.filter((p) => !p.date || p.date >= cutoffDate).length;
    const activeSales = sales.filter((s) => !s.date || s.date >= cutoffDate).length;
    const activePayments = payments.filter((p) => !p.date || p.date >= cutoffDate).length;
    const activeTpp = tpps.filter((t) => !t.date || t.date >= cutoffDate).length;
    const activeCp = cp.filter((c) => !c.date || c.date >= cutoffDate).length;

    const totalWithin = activePurchases + activeSales + activePayments + activeTpp + activeCp;

    return {
      active: true,
      retentionDays: RETENTION_DAYS,
      cutoffDate,
      totalEntriesWithinWindow: totalWithin,
      lastPrunedTimestamp: new Date().toISOString(),
      totalPrunedLifetime: 0,
      collectionBreakdown: {
        purchases: activePurchases,
        sales: activeSales,
        payments: activePayments,
        thirdPartyPayments: activeTpp,
        companyPayments: activeCp
      }
    };
  },

  runRetentionCleanup: async (): Promise<RetentionResult> => {
    const uid = getUserId();
    const cutoffDate = getRetentionCutoffDate();
    const [purchases, sales, payments, tpps, cp] = await Promise.all([
      fetchCollection<Purchase>('purchases'),
      fetchCollection<Sale>('sales'),
      fetchCollection<Payment>('payments'),
      fetchCollection<ThirdPartyPayment>('thirdPartyPayments'),
      fetchCollection<CompanyPayment>('companyPayments')
    ]);

    const batch = writeBatch(db);

    let count = 0;
    const details = {
      purchasesPruned: 0,
      salesPruned: 0,
      paymentsPruned: 0,
      thirdPartyPaymentsPruned: 0,
      companyPaymentsPruned: 0
    };

    purchases.filter((p) => p.date && p.date < cutoffDate).forEach((p) => {
      batch.delete(userDoc('purchases', p.id));
      details.purchasesPruned++;
      count++;
    });

    sales.filter((s) => s.date && s.date < cutoffDate).forEach((s) => {
      batch.delete(userDoc('sales', s.id));
      details.salesPruned++;
      count++;
    });

    payments.filter((p) => p.date && p.date < cutoffDate).forEach((p) => {
      batch.delete(userDoc('payments', p.id));
      details.paymentsPruned++;
      count++;
    });

    tpps.filter((t) => t.date && t.date < cutoffDate).forEach((t) => {
      batch.delete(userDoc('thirdPartyPayments', t.id));
      details.thirdPartyPaymentsPruned++;
      count++;
    });

    cp.filter((c) => c.date && c.date < cutoffDate).forEach((c) => {
      batch.delete(userDoc('companyPayments', c.id));
      details.companyPaymentsPruned++;
      count++;
    });

    if (count > 0) {
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/retention-prune`);
      }
    }

    const updatedStatus = await api.getRetentionStatus();

    return {
      prunedCount: count,
      cutoffDate,
      message: count > 0 ? `Successfully cleaned ${count} expired records older than 365 days` : 'All records are within the 365-day retention window',
      details,
      status: updatedStatus
    };
  },

  // 13. Small Branch Account & Payments Sent to Company
  getBranchAccount: async (): Promise<{
    branchAccount: BranchAccount;
    companyPayments: CompanyPayment[];
    companies: Company[];
    parties: Party[];
  }> => {
    try {
      await api.ensureDefaults();
      const [purchases, sales, payments, companyPayments, companies, parties, customers, shopExpenses] = await Promise.all([
        fetchCollection<Purchase>('purchases'),
        fetchCollection<Sale>('sales'),
        fetchCollection<Payment>('payments'),
        fetchCollection<CompanyPayment>('companyPayments'),
        api.getCompanies(),
        api.getParties(),
        fetchCollection<Customer>('customers'),
        fetchCollection<ShopExpense>('shopExpenses')
      ]);

      let initialUserBalance = 0;
      let branchName = `${auth.currentUser?.displayName || 'Farooq Gujjar KB'} (Branch)`;
      try {
        const branchSnap = await getDoc(userDoc('branchAccount', 'main'));
        if (branchSnap.exists()) {
          const data = branchSnap.data();
          initialUserBalance = Number(data.initialUserBalance) || 0;
          if (data.branchName) branchName = data.branchName;
        }
      } catch (e) {
        // ignore
      }

      const { userBalance, companyBalance } = computeBranchBalances(
        purchases, 
        sales, 
        payments, 
        companyPayments, 
        customers, 
        parties, 
        shopExpenses,
        initialUserBalance
      );

      const branchAccount: BranchAccount = {
        userName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
        branchName,
        userBalance,
        initialUserBalance,
        companyBalance,
        primaryCompanyId: companies[0]?.id || '',
        primaryCompanyName: companies[0]?.name || ''
      };

      const result = {
        branchAccount,
        companyPayments,
        companies,
        parties
      };

      localStorageBackup.save('branchAccount', result);
      return result;
    } catch (err) {
      const cached = localStorageBackup.get<{
        branchAccount: BranchAccount;
        companyPayments: CompanyPayment[];
        companies: Company[];
        parties: Party[];
      }>('branchAccount');
      if (cached) return cached;
      throw err;
    }
  },

  setUserBalance: async (amount: number): Promise<BranchAccount> => {
    const uid = getUserId();
    const branchRef = userDoc('branchAccount', 'main');
    let existing: any = {};
    try {
      const branchSnap = await getDoc(branchRef);
      if (branchSnap.exists()) {
        existing = branchSnap.data();
      }
    } catch (e) {
      // ignore
    }

    const numAmount = Number(amount) || 0;
    const updated: BranchAccount = {
      ...existing,
      userName: existing.userName || auth.currentUser?.displayName || 'Farooq Gujjar KB',
      branchName: existing.branchName || `${auth.currentUser?.displayName || 'Farooq Gujjar KB'} (Branch)`,
      initialUserBalance: numAmount,
      userBalance: numAmount,
      companyBalance: existing.companyBalance || 0,
      primaryCompanyId: existing.primaryCompanyId || 'comp-default',
      primaryCompanyName: existing.primaryCompanyName || 'Supreme Feeds Ltd'
    };

    try {
      await setDoc(branchRef, cleanForFirestore(updated), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/branchAccount/main`);
    }

    const cached = localStorageBackup.get<{
      branchAccount: BranchAccount;
      companyPayments: CompanyPayment[];
      companies: Company[];
      parties: Party[];
    }>('branchAccount');

    if (cached && cached.branchAccount) {
      cached.branchAccount.initialUserBalance = numAmount;
      localStorageBackup.save('branchAccount', cached);
    }

    const res = await api.getBranchAccount();
    return res.branchAccount;
  },

  recordCompanyPayment: async (payload: {
    entryType: 'CR' | 'DR';
    amount: number;
    description: string;
    referenceNumber?: string;
    date: string;
    notes?: string;
  }): Promise<{ message: string; data: CompanyPayment; branchAccount: BranchAccount }> => {
    const uid = getUserId();
    const newCpId = 'cp-' + Date.now();
    unmarkDeleted(newCpId);
    const newCp: CompanyPayment = {
      id: newCpId,
      entryType: payload.entryType,
      amount: Number(payload.amount),
      description: payload.description,
      referenceNumber: payload.referenceNumber || `TR-${Math.floor(1000 + Math.random() * 9000)}`,
      date: payload.date || new Date().toISOString().split('T')[0],
      notes: payload.notes || ''
    };

    try {
      await setDoc(userDoc('companyPayments', newCp.id), cleanForFirestore(newCp));
      const curCp = localStorageBackup.get<CompanyPayment[]>('companyPayments') || [];
      localStorageBackup.save('companyPayments', [newCp, ...curCp.filter(c => c.id !== newCp.id)]);
      const res = await api.getBranchAccount();
      return {
        message: 'Company payment recorded successfully',
        data: newCp,
        branchAccount: res.branchAccount
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/companyPayments/${newCp.id}`);
      const curCp = localStorageBackup.get<CompanyPayment[]>('companyPayments') || [];
      localStorageBackup.save('companyPayments', [newCp, ...curCp.filter(c => c.id !== newCp.id)]);
      return {
        message: 'Company payment recorded',
        data: newCp,
        branchAccount: {
          userName: 'Farooq Gujjar KB',
          branchName: 'Farooq Gujjar KB (Branch)',
          userBalance: 0,
          companyBalance: 0,
          primaryCompanyId: 'comp-default',
          primaryCompanyName: 'Supreme Feeds Ltd'
        }
      };
    }
  },

  deleteCompanyPayment: async (paymentId: string): Promise<void> => {
    const uid = getUserId();
    const cleanId = paymentId.replace(/^(cp-)+/, '');
    markAsDeleted(paymentId);
    if (cleanId) markAsDeleted(cleanId);
    try {
      await deleteDoc(userDoc('companyPayments', paymentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/companyPayments/${paymentId}`);
    }
    const curCp = localStorageBackup.get<CompanyPayment[]>('companyPayments') || [];
    localStorageBackup.save('companyPayments', curCp.filter(c => c.id !== paymentId && c.id !== cleanId));
  },

  updateBranchBalance: async (payload: {
    userBalance?: number;
    companyBalance?: number;
  }): Promise<{ message: string; branchAccount: BranchAccount }> => {
    const uid = getUserId();
    const branchRef = userDoc('branchAccount', 'main');
    const snap = await getDoc(branchRef);
    const existing = snap.exists() ? snap.data() : {};
    const updated: BranchAccount = {
      userName: auth.currentUser?.displayName || 'Farooq Gujjar KB',
      branchName: `${auth.currentUser?.displayName || 'Farooq Gujjar KB'} (Branch)`,
      primaryCompanyId: 'comp-default',
      primaryCompanyName: 'Supreme Feeds Ltd',
      userBalance: 0,
      companyBalance: 0,
      ...existing,
      ...payload
    };

    try {
      await setDoc(branchRef, cleanForFirestore(updated));
      return { message: 'Branch balance updated successfully', branchAccount: updated };
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/branchAccount/main`);
      return { message: 'Branch balance updated', branchAccount: updated };
    }
  },

  getShopExpenses: async (): Promise<ShopExpense[]> => {
    try {
      const expenses = await fetchCollection<ShopExpense>('shopExpenses');
      return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.warn('Error fetching shop expenses:', err);
      return [];
    }
  },

  createShopExpense: async (expenseData: Partial<ShopExpense>): Promise<ShopExpense> => {
    const uid = getUserId();
    const id = expenseData.id || `exp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newExpense: ShopExpense = {
      id,
      date: expenseData.date || new Date().toISOString().split('T')[0],
      title: expenseData.title || 'General Shop Expense',
      category: expenseData.category || 'General & Misc',
      amount: Number(expenseData.amount) || 0,
      paymentMethod: expenseData.paymentMethod || 'CASH',
      paidTo: expenseData.paidTo || '',
      deductFromUserBalance: !!expenseData.deductFromUserBalance,
      notes: expenseData.notes || '',
      receiptNumber: expenseData.receiptNumber || `EXP-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString()
    };

    unmarkDeleted(id);
    const existing = localStorageBackup.get<ShopExpense[]>('shopExpenses') || [];
    const updated = [newExpense, ...existing.filter(e => e.id !== id)];
    localStorageBackup.save('shopExpenses', updated);

    try {
      await setDoc(userDoc('shopExpenses', id), cleanForFirestore(newExpense));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/shopExpenses/${id}`);
    }

    return newExpense;
  },

  updateShopExpense: async (id: string, expenseData: Partial<ShopExpense>): Promise<void> => {
    const uid = getUserId();
    const existing = localStorageBackup.get<ShopExpense[]>('shopExpenses') || [];
    const current = existing.find(e => e.id === id);
    if (!current) return;

    const updatedItem: ShopExpense = {
      ...current,
      ...expenseData,
      id
    };

    const updated = existing.map(e => (e.id === id ? updatedItem : e));
    localStorageBackup.save('shopExpenses', updated);

    try {
      await setDoc(userDoc('shopExpenses', id), cleanForFirestore(updatedItem));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/shopExpenses/${id}`);
    }
  },

  deleteShopExpense: async (id: string): Promise<void> => {
    const uid = getUserId();
    markAsDeleted(id);
    try {
      await deleteDoc(userDoc('shopExpenses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}/shopExpenses/${id}`);
    }
    const existing = localStorageBackup.get<ShopExpense[]>('shopExpenses') || [];
    localStorageBackup.save('shopExpenses', existing.filter(e => e.id !== id));
  }
};
