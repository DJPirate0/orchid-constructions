import React, { useState } from 'react';
import { 
  Company, 
  Party,
  FeedItem, 
  Purchase, 
  Sale,
  Payment,
  LedgerEntry 
} from '../types/feed';
import { api } from '../services/api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { 
  Truck, 
  Plus, 
  Search, 
  Building2, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  X, 
  Download, 
  MapPin,
  Trash2,
  Users,
  ArrowDownLeft,
  HandCoins 
} from 'lucide-react';

interface PurchasesViewProps {
  companies: Company[];
  parties?: Party[];
  items: FeedItem[];
  purchases: Purchase[];
  sales?: Sale[];
  directPayments?: Payment[];
  onRefresh: () => void;
  openNewPurchaseModal: boolean;
  setOpenNewPurchaseModal: (open: boolean) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  companies,
  parties = [],
  items,
  purchases,
  sales = [],
  directPayments = [],
  onRefresh,
  openNewPurchaseModal,
  setOpenNewPurchaseModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyForLedger, setSelectedCompanyForLedger] = useState<Company | null>(null);
  const [companyLedgerData, setCompanyLedgerData] = useState<{
    company: Company;
    ledgerEntries: LedgerEntry[];
    calculatedBalance: number;
  } | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Modal: Add Company
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    city: '',
    bankDetails: '',
    initialBalance: 0
  });

  // Modal: Pay Company
  const [showPayCompanyModal, setShowPayCompanyModal] = useState<Company | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Bank Transfer (Online)');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payingCompany, setPayingCompany] = useState(false);

  // Modal: Receive Factory Buy Udhaar from User
  const [showReceiveUdhaarModal, setShowReceiveUdhaarModal] = useState(false);
  const [receiveTargetPurchase, setReceiveTargetPurchase] = useState<Purchase | null>(null);
  const [receiveData, setReceiveData] = useState({
    companyId: companies[0]?.id || '',
    amount: 0,
    paymentMethod: 'Cash (Direct to Factory Balance)',
    biltyNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [receivingUdhaar, setReceivingUdhaar] = useState(false);
  const [receiveSuccessMsg, setReceiveSuccessMsg] = useState('');

  // Form State for Factory Buy
  const [formData, setFormData] = useState({
    companyId: companies[0]?.id || '',
    transactionMode: 'BORROW_DANA' as 'BORROW_DANA' | 'GIVEN_ON_SPOT',
    quantityBags: 0,
    ratePerBag: 0,
    borrowedAmount: 0,
    givenOnSpot: 0,
    advancePayment: 0,
    advanceUsed: 0,
    vehicleNumber: '',
    biltyNumber: '',
    driverName: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (companies && companies.length > 0 && !formData.companyId) {
      setFormData(prev => ({ ...prev, companyId: companies[0].id }));
    }
  }, [companies]);

  React.useEffect(() => {
    if (parties && parties.length > 0 && !wholesaleFormData.partyId) {
      setWholesaleFormData(prev => ({ ...prev, partyId: parties[0].id }));
    }
  }, [parties]);

  // Modal: Wholesale (Big Parties) Company Entry
  const [openWholesaleCompanyModal, setOpenWholesaleCompanyModal] = useState(false);
  const [wholesaleFormData, setWholesaleFormData] = useState({
    partyId: parties && parties.length > 0 ? parties[0].id : '',
    paidSpot: 0,
    udhaarReceive: 0,
    vehicleNumber: '',
    biltyNumber: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleWholesaleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPartyId = wholesaleFormData.partyId || (parties && parties.length > 0 ? parties[0].id : '');
    const selectedParty = (parties || []).find(p => p.id === targetPartyId);
    const partyName = selectedParty ? selectedParty.name : 'Wholesale Dealer';
    const spotVal = Number(wholesaleFormData.paidSpot) || 0;
    const udhaarRecVal = Number(wholesaleFormData.udhaarReceive) || 0;

    if (spotVal <= 0 && udhaarRecVal <= 0) {
      alert('Please enter an amount for either Normal Money for Purchases or Udhaar (recieve)');
      return;
    }

    setSubmitting(true);
    try {
      await api.recordPurchase({
        companyId: companies[0]?.id || 'comp-default',
        partyId: targetPartyId || undefined,
        partyName: partyName,
        isUdhaarReceive: udhaarRecVal > 0,
        udhaarReceiveAmount: udhaarRecVal,
        partyCutAmount: udhaarRecVal,
        borrowedAmount: 0, // Strictly NO purchase debt!
        givenOnSpot: spotVal,
        paidNow: spotVal,
        amount: spotVal > 0 ? spotVal : udhaarRecVal,
        vehicleNumber: wholesaleFormData.vehicleNumber.toUpperCase() || 'N/A',
        biltyNumber: wholesaleFormData.biltyNumber || (udhaarRecVal > 0 ? `REC-${Math.floor(10000 + Math.random() * 90000)}` : `SLIP-${Math.floor(10000 + Math.random() * 90000)}`),
        driverName: '',
        date: wholesaleFormData.date,
        notes: `Wholesale Party: ${partyName}${udhaarRecVal > 0 ? ' [Udhaar (recieve) Payback - No Purchase]' : ''}${wholesaleFormData.notes ? ` - ${wholesaleFormData.notes}` : ''}`
      });

      setOpenWholesaleCompanyModal(false);
      onRefresh();
      setWholesaleFormData({
        partyId: parties && parties.length > 0 ? parties[0].id : '',
        paidSpot: 0,
        udhaarReceive: 0,
        vehicleNumber: '',
        biltyNumber: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (err: any) {
      alert(err.message || 'Error recording wholesale company transaction');
    } finally {
      setSubmitting(false);
    }
  };
  const [successMsg, setSuccessMsg] = useState('');

  const danaVal = Number(formData.borrowedAmount) || 0;
  const spotVal = Number(formData.givenOnSpot) || 0;
  const advanceVal = Number(formData.advancePayment) || 0;
  const advUsedVal = Number(formData.advanceUsed) || 0;
  const bagsCount = Number(formData.quantityBags) || 0;
  const pricePerBag = Number(formData.ratePerBag) || 0;
  const totalBagsCost = bagsCount * pricePerBag;

  const netPayableAdded = danaVal;
  const selectedCompanyObj = companies.find(c => c.id === formData.companyId) || companies[0];
  const availableAdvance = selectedCompanyObj?.advanceBalance || 0;
  const currentCompanyDue = selectedCompanyObj?.currentBalance || 0;
  const resultingCompanyBalance = currentCompanyDue + danaVal;
  const resultingAdvanceBalance = Math.max(0, availableAdvance + advanceVal - advUsedVal);

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCompanyId = formData.companyId || companies[0]?.id || 'comp-default';

    let finalBorrowed = Number(formData.borrowedAmount) || 0;
    let finalSpot = Number(formData.givenOnSpot) || 0;
    let finalAdvance = Number(formData.advancePayment) || 0;
    let finalAdvanceUsed = Number(formData.advanceUsed) || 0;

    // Auto-apply total bags cost if no split was manually entered
    if (finalBorrowed <= 0 && finalSpot <= 0 && finalAdvance <= 0 && finalAdvanceUsed <= 0 && totalBagsCost > 0) {
      if (availableAdvance >= totalBagsCost) {
        finalAdvanceUsed = totalBagsCost;
      } else if (availableAdvance > 0) {
        finalAdvanceUsed = availableAdvance;
        finalBorrowed = totalBagsCost - availableAdvance;
      } else {
        finalBorrowed = totalBagsCost;
      }
    }

    if (finalBorrowed <= 0 && finalSpot <= 0 && finalAdvance <= 0 && finalAdvanceUsed <= 0) {
      alert('Please enter a price per bag or an amount for Money Borrowed from Factory (Dana), Given on Spot, or Advance Payment.');
      return;
    }

    setSubmitting(true);
    setSuccessMsg('');

    try {
      await api.recordPurchase({
        companyId: targetCompanyId,
        quantityBags: bagsCount,
        ratePerBag: pricePerBag,
        borrowedAmount: finalBorrowed,
        givenOnSpot: finalSpot,
        advancePayment: finalAdvance,
        advanceUsed: finalAdvanceUsed,
        paidNow: finalSpot + finalAdvance,
        amount: totalBagsCost > 0 ? totalBagsCost : (finalBorrowed + finalSpot + finalAdvanceUsed),
        vehicleNumber: formData.vehicleNumber.toUpperCase() || 'N/A',
        biltyNumber: formData.biltyNumber || `BL-${Math.floor(10000 + Math.random() * 90000)}`,
        driverName: formData.driverName,
        date: formData.date,
        notes: pricePerBag > 0 
          ? (formData.notes ? `${formData.notes} [Rate: Rs. ${pricePerBag.toLocaleString()}/bag]` : `Rate: Rs. ${pricePerBag.toLocaleString()}/bag (${bagsCount} bags)`)
          : formData.notes
      });

      setSuccessMsg(resultingCompanyBalance === 0 ? 'Recorded! Factory payable is now Rs. 0 (ZERO).' : 'Factory buy entry recorded! Supplier ledger updated.');
      onRefresh();

      setTimeout(() => {
        setSuccessMsg('');
        setOpenNewPurchaseModal(false);
      }, 400);

      // Reset form
      setFormData({
        companyId: targetCompanyId,
        transactionMode: 'BORROW_DANA',
        quantityBags: 0,
        ratePerBag: 0,
        borrowedAmount: 0,
        givenOnSpot: 0,
        advancePayment: 0,
        advanceUsed: 0,
        vehicleNumber: '',
        biltyNumber: '',
        driverName: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    } catch (err: any) {
      alert(err.message || 'Error recording factory buy entry');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grossSalesCash = (sales || [])
    .filter(s => s.saleType === 'WHOLESALE' || s.saleType === 'RETAIL')
    .reduce((sum, s) => sum + (Number(s.paidAmount) || Number(s.paidSpot) || 0), 0) +
    (directPayments || []).filter(p => p.type === 'PAYMENT_FROM_CUSTOMER' && !p.isLinkedToFactoryBuy && !p.id.startsWith('pay-pur-')).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) +
    (purchases || []).filter(p => p.partyId && !p.isUdhaarReceive).reduce((sum, p) => sum + (Number(p.paidNow) || Number(p.givenOnSpot) || 0), 0);

  const factoryDanaGross = (purchases || []).filter(p => !p.isUdhaarReceive).reduce((sum, p) => sum + (Number(p.borrowedAmount) || 0), 0);
  const factoryDirectTotal = (directPayments || []).filter(p => p.type === 'PAYMENT_TO_COMPANY').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const factoryUdhaarTotal = (purchases || []).filter(p => p.isUdhaarReceive || Number(p.udhaarReceiveAmount) > 0).reduce((sum, p) => sum + (Number(p.udhaarReceiveAmount) || Number(p.partyCutAmount) || 0), 0);
  const activeFactoryDana = Math.max(0, factoryDanaGross - factoryDirectTotal - factoryUdhaarTotal);
  // User udhaar (dena) in factory buy does not automatically cut until paid willingly
  const danaCut = 0;

  // Remaining Dana Owed in Factory Buy (only reduced when paid willingly)
  const totalPayables = activeFactoryDana;

  // Calculate per-purchase unpaid Dana tracking:
  const purchaseUnpaidDanaMap = React.useMemo(() => {
    const map = new Map<string, number>();

    // If overall factory dana is 0, all purchases have 0 unpaid dana
    if (activeFactoryDana <= 0) {
      purchases.forEach(p => map.set(p.id, 0));
      return map;
    }

    // 1. Gather all udhaar receive repayments and direct payments
    const udhaarReceives = purchases.filter(x => x.isUdhaarReceive || Number(x.udhaarReceiveAmount) > 0);
    const directCompPayments = (directPayments || []).filter(p => p.type === 'PAYMENT_TO_COMPANY');

    // Linked repayments map
    const linkedPaidMap = new Map<string, number>();
    udhaarReceives.forEach(ur => {
      if (ur.linkedPurchaseId) {
        const current = linkedPaidMap.get(ur.linkedPurchaseId) || 0;
        linkedPaidMap.set(ur.linkedPurchaseId, current + (Number(ur.udhaarReceiveAmount) || Number(ur.partyCutAmount) || 0));
      }
    });

    // Calculate unlinked general pool (general udhaar receives + direct company payments)
    let unlinkedPool = udhaarReceives
      .filter(ur => !ur.linkedPurchaseId)
      .reduce((sum, ur) => sum + (Number(ur.udhaarReceiveAmount) || Number(ur.partyCutAmount) || 0), 0) +
      directCompPayments.reduce((sum, cp) => sum + (Number(cp.amount) || 0), 0);

    // Sort non-udhaar purchases chronologically (oldest first) to allocate FIFO
    const regularPurchases = purchases
      .filter(p => !p.isUdhaarReceive)
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    regularPurchases.forEach(p => {
      const initialDana = Number(p.borrowedAmount) || 0;
      if (initialDana <= 0 || p.paymentStatus === 'PAID') {
        map.set(p.id, 0);
        return;
      }

      // Subtract directly linked repayments
      const directlyPaid = linkedPaidMap.get(p.id) || 0;
      let remaining = Math.max(0, initialDana - directlyPaid);

      // Subtract from unlinked pool if any remains
      if (remaining > 0 && unlinkedPool > 0) {
        const deduction = Math.min(remaining, unlinkedPool);
        remaining -= deduction;
        unlinkedPool -= deduction;
      }

      map.set(p.id, remaining);
    });

    return map;
  }, [purchases, directPayments, activeFactoryDana]);

  const handleOpenGeneralReceive = () => {
    setReceiveTargetPurchase(null);
    const targetCompId = companies[0]?.id || 'comp-default';
    setReceiveData({
      companyId: targetCompId,
      amount: totalPayables > 0 ? totalPayables : 0,
      paymentMethod: 'Cash (Direct to Factory Balance)',
      biltyNumber: `REC-FB-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().split('T')[0],
      notes: 'Received factory buy udhaar from user (Farooq Gujjar)'
    });
    setReceiveSuccessMsg('');
    setShowReceiveUdhaarModal(true);
  };

  const handleOpenReceiveForPurchase = (purchase: Purchase, unpaidDanaAmt?: number) => {
    setReceiveTargetPurchase(purchase);
    const amt = unpaidDanaAmt !== undefined ? unpaidDanaAmt : (purchaseUnpaidDanaMap.get(purchase.id) ?? (Number(purchase.borrowedAmount) || 0));
    setReceiveData({
      companyId: purchase.companyId || companies[0]?.id || 'comp-default',
      amount: amt,
      paymentMethod: 'Cash (Direct to Factory Balance)',
      biltyNumber: `REC-FB-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString().split('T')[0],
      notes: `Received factory buy udhaar from user for slip #${purchase.biltyNumber || purchase.id}`
    });
    setReceiveSuccessMsg('');
    setShowReceiveUdhaarModal(true);
  };

  const handleSubmitReceiveUdhaar = async (e: React.FormEvent) => {
    e.preventDefault();
    const receiveAmt = Number(receiveData.amount) || 0;
    if (receiveAmt <= 0) {
      alert('Please enter an amount greater than 0 to receive.');
      return;
    }

    setReceivingUdhaar(true);
    setReceiveSuccessMsg('');

    try {
      const targetCompanyId = receiveData.companyId || companies[0]?.id || 'comp-default';

      await api.recordPurchase({
        companyId: targetCompanyId,
        isUdhaarReceive: true,
        isUserUdhaarReceive: true,
        udhaarReceiveAmount: receiveAmt,
        partyCutAmount: receiveAmt,
        borrowedAmount: 0,
        givenOnSpot: 0,
        paidNow: 0,
        amount: receiveAmt,
        vehicleNumber: receiveTargetPurchase?.vehicleNumber || 'N/A',
        biltyNumber: receiveData.biltyNumber || `REC-FB-${Math.floor(10000 + Math.random() * 90000)}`,
        driverName: '',
        date: receiveData.date,
        notes: receiveData.notes || `Received factory buy udhaar from user (Farooq Gujjar KB) - ${receiveData.paymentMethod}`,
        linkedPurchaseId: receiveTargetPurchase?.id
      });

      setReceiveSuccessMsg(`Received Rs. ${receiveAmt.toLocaleString()} successfully! Factory buy udhaar has been reduced.`);
      onRefresh();

      setTimeout(() => {
        setReceiveSuccessMsg('');
        setShowReceiveUdhaarModal(false);
      }, 700);
    } catch (err: any) {
      alert(err.message || 'Error recording factory buy udhaar receipt');
    } finally {
      setReceivingUdhaar(false);
    }
  };

  const handleOpenLedger = async (comp: Company) => {
    setSelectedCompanyForLedger(comp);
    setLoadingLedger(true);
    try {
      const data = await api.getCompanyLedger(comp.id);
      setCompanyLedgerData(data);
    } catch (err: any) {
      alert(err.message || 'Error fetching company ledger');
    } finally {
      setLoadingLedger(false);
    }
  };

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {}
  });
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePurchase = (purchase: Purchase) => {
    setDeleteConfirmation({
      isOpen: true,
      title: 'Delete Purchase Entry',
      description: `Are you sure you want to delete purchase entry for "${purchase.companyName}" (${purchase.quantityBags} bags of ${purchase.itemName})? Stock will be reversed from inventory and payable ledger updated.`,
      action: async () => {
        await api.deletePurchase(purchase.id);
        onRefresh();
      }
    });
  };

  const handleDeleteCompany = (comp: Company) => {
    setDeleteConfirmation({
      isOpen: true,
      title: `Delete Factory / Company "${comp.name}"`,
      description: `Are you sure you want to remove "${comp.name}" from your factory directory?`,
      action: async () => {
        await api.deleteCompany(comp.id);
        onRefresh();
      }
    });
  };

  const handleDeleteCompanyLedgerEntry = (entry: LedgerEntry) => {
    if (entry.type === 'OPENING_BALANCE') {
      alert('Opening balance is automatically computed from account history.');
      return;
    }
    setDeleteConfirmation({
      isOpen: true,
      title: 'Delete Ledger Entry',
      description: `Are you sure you want to delete entry "${entry.description}"? Linked stock and payable balances will be automatically reversed.`,
      action: async () => {
        if (entry.id.startsWith('pur-')) {
          await api.deletePurchase(entry.id);
        } else if (entry.id.startsWith('dp-') || entry.id.startsWith('pay-')) {
          await api.deletePayment(entry.id);
        } else if (entry.id.startsWith('tpp-')) {
          await api.deleteThirdPartyPayment(entry.id);
        }
        await onRefresh();
        if (selectedCompanyForLedger) {
          handleOpenLedger(selectedCompanyForLedger);
        }
      }
    });
  };

  const handleExecuteDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteConfirmation.action();
      setDeleteConfirmation(prev => ({ ...prev, isOpen: false }));
    } catch (err: any) {
      alert(err.message || 'Error executing deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadLedger = (company: Company) => {
    if (!companyLedgerData?.ledgerEntries) return;
    const lines = [
      `==================================================================`,
      `             SUPPLIER ACCOUNT STATEMENT - KB FACTORY              `,
      `==================================================================`,
      `Supplier Name:  ${company.name}`,
      `City:           ${company.city || 'N/A'}`,
      `Contact Person: ${company.contactPerson || 'N/A'} (${company.phone || 'N/A'})`,
      `Bank Details:   ${company.bankDetails || 'N/A'}`,
      `Generated On:   ${new Date().toLocaleDateString()}`,
      `------------------------------------------------------------------`,
      `TOTAL PURCHASES:      Rs. ${Math.round(company.totalPurchases || 0).toLocaleString()}`,
      `TOTAL PAYMENTS MADE:  Rs. ${Math.round(company.totalPayments || 0).toLocaleString()}`,
      `NET PAYABLE BALANCE:  Rs. ${Math.round(companyLedgerData.calculatedBalance ?? company.currentBalance).toLocaleString()}`,
      `------------------------------------------------------------------`,
      `DATE       | DESCRIPTION                              | DEBIT (PAYMENT) | CREDIT (BILL)  | RUNNING BALANCE`,
      `------------------------------------------------------------------`,
      ...companyLedgerData.ledgerEntries.map(e => {
        const d = (e.date || '').padEnd(10);
        const desc = (e.description || '').slice(0, 40).padEnd(40);
        const debit = e.debit > 0 ? `Rs. ${e.debit.toLocaleString()}`.padStart(15) : '—'.padStart(15);
        const credit = e.credit > 0 ? `Rs. ${e.credit.toLocaleString()}`.padStart(14) : '—'.padStart(14);
        const bal = `Rs. ${(e.runningBalance || 0).toLocaleString()}`.padStart(16);
        return `${d} | ${desc} | ${debit} | ${credit} | ${bal}`;
      }),
      `==================================================================`
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Supplier_Statement_${company.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyData.name) return;
    try {
      await api.createCompany(newCompanyData);
      setShowAddCompanyModal(false);
      setNewCompanyData({
        name: '',
        contactPerson: '',
        phone: '',
        city: '',
        bankDetails: '',
        initialBalance: 0
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error creating company');
    }
  };

  const handleDirectPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayCompanyModal || payAmount <= 0) return;
    setPayingCompany(true);
    try {
      await api.recordPayment({
        type: 'PAYMENT_TO_COMPANY',
        targetId: showPayCompanyModal.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        referenceNumber: payRef || `TRF-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        notes: payNotes
      });
      setShowPayCompanyModal(null);
      setPayAmount(0);
      setPayRef('');
      setPayNotes('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Error processing payment');
    } finally {
      setPayingCompany(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Banner with Summary & Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Factory Purchases &amp; Company Account</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record user purchases and wholesale (big parties) transactions into the company account.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Button 1: Record Purchase (User) */}
          <button
            onClick={() => {
              if (companies.length > 0 && !formData.companyId) {
                setFormData(prev => ({ ...prev, companyId: companies[0].id }));
              }
              setOpenNewPurchaseModal(true);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Purchase</span>
          </button>

          {/* Button 2: Receive Factory Buy Udhaar from User */}
          <button
            onClick={handleOpenGeneralReceive}
            disabled={totalPayables <= 0}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
              totalPayables > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
            }`}
            title={totalPayables > 0 ? "Receive factory buy udhaar from user" : "No factory buy udhaar currently owed (Rs. 0)"}
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Receive Udhaar</span>
          </button>
        </div>
      </div>

      {/* Top Company Account Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Factory Payable (Dana Owed)</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-1">
            Rs. {Math.round(totalPayables).toLocaleString()}
          </div>
          {danaCut > 0 && (
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              ✓ Rs. {Math.round(danaCut).toLocaleString()} cleared by Factory Balance cash
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Purchases (Inward Value)</div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
            Rs. {Math.round(purchases.filter(p => !p.isUdhaarReceive).reduce((sum, p) => sum + (p.borrowedAmount || p.totalAmount || 0), 0)).toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Spot &amp; Advance Given</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
            Rs. {Math.round(purchases.reduce((sum, p) => sum + (p.paidNow || p.givenOnSpot || 0) + (p.advancePayment || 0), 0)).toLocaleString()}
          </div>
          {purchases.some(p => (p.advancePayment || 0) > 0) && (
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
              Includes Rs. {Math.round(purchases.reduce((sum, p) => sum + (p.advancePayment || 0), 0)).toLocaleString()} Advance to Factory
            </div>
          )}
        </div>
      </div>



      {/* Recent Purchases & Factory Entries List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs mt-8 transition-colors">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Recent Factory Buy &amp; Company Account Entries</h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Recorded: {purchases.length}</span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[780px] text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Date &amp; Bilty / Slip #</th>
                <th className="py-3 px-4">Entry Source &amp; Type</th>
                <th className="py-3 px-4 text-center">Vehicle / Truck No.</th>
                <th className="py-3 px-4 text-right">Paid on Spot (Normal Money)</th>
                <th className="py-3 px-4 text-right">Dana (Factory Debt)</th>
                <th className="py-3 px-4 text-right">Udhaar (recieve)</th>
                <th className="py-3 px-4">Notes / Remarks</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-600 dark:text-amber-400" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No Factory Buy Records Yet</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Click &quot;Record Purchase&quot; or &quot;Wholesale (Big Parties)&quot; above to log your first transaction.
                    </p>
                  </td>
                </tr>
              ) : (
                purchases.map((p) => {
                  const isUserUdhaar = Boolean(p.isUserUdhaarReceive || (p.isUdhaarReceive && !p.partyId && !(p.partyName && !p.partyName.toLowerCase().includes('user') && !p.partyName.toLowerCase().includes('farooq'))));
                  const isWholesaleEntry = Boolean(!isUserUdhaar && (p.partyId || (p.notes || '').toLowerCase().includes('wholesale party:') || (p.isUdhaarReceive && p.partyId)));
                  const partyDisplayName = p.partyName 
                    ? `Wholesale: ${p.partyName}` 
                    : (p.notes?.split(' - ')[0] || 'Wholesale Big Party');
                  const isUdhaarRec = Boolean(p.isUdhaarReceive || (p.partyCutAmount && p.partyCutAmount > 0));
                  const udhaarRecAmt = Number(p.udhaarReceiveAmount || p.partyCutAmount || 0);
                  const spotMoney = Number(p.paidNow) || Number(p.givenOnSpot) || 0;
                  const initialDana = isUdhaarRec ? 0 : (Number(p.borrowedAmount) || 0);
                  const unpaidDana = purchaseUnpaidDanaMap.get(p.id) ?? initialDana;
                  const hasUnpaidDana = !isUdhaarRec && unpaidDana > 0;
                  const isDanaPaidOff = !isUdhaarRec && initialDana > 0 && unpaidDana === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{p.date}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{p.biltyNumber || '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        {isWholesaleEntry ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {partyDisplayName}
                            </span>
                            {isUdhaarRec ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Udhaar (recieve) · Pay/Receive
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                Normal Purchase Money
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              User (Farooq Gujjar KB)
                            </span>
                            {isUdhaarRec ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Udhaar (recieve) · Factory Payback
                              </span>
                            ) : p.quantityBags && p.quantityBags > 0 ? (
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                                  {p.quantityBags} Bags Bought
                                </span>
                                {p.ratePerBag && p.ratePerBag > 0 ? (
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                                    @ Rs. {p.ratePerBag.toLocaleString()}/bag
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700">
                          {p.vehicleNumber || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                        {spotMoney > 0 ? `Rs. ${spotMoney.toLocaleString()}` : <span className="text-slate-400 font-normal">Rs. 0</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        {isUdhaarRec ? (
                          <span className="text-slate-400 font-normal">—</span>
                        ) : hasUnpaidDana ? (
                          <div>
                            <span className="text-amber-800 dark:text-amber-400">
                              Rs. {unpaidDana.toLocaleString()}
                            </span>
                            {unpaidDana < initialDana && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                (of Rs. {initialDana.toLocaleString()})
                              </span>
                            )}
                          </div>
                        ) : isDanaPaidOff ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                              Rs. 0
                            </span>
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              Cleared / Paid
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-extrabold text-emerald-700 dark:text-emerald-400">
                        {udhaarRecAmt > 0 ? (
                          <div>
                            <div>Rs. {udhaarRecAmt.toLocaleString()}</div>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">Pay/Receive Payback</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        <span className="truncate max-w-[220px] block" title={p.notes}>
                          {isWholesaleEntry 
                            ? (p.notes?.split(' - ').slice(1).join(' - ') || (isUdhaarRec ? 'Udhaar payback (No Purchase)' : 'Wholesale entry')) 
                            : (p.notes || (isUdhaarRec ? 'Factory Buy Udhaar Received from User' : '—'))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasUnpaidDana ? (
                            <button
                              onClick={() => handleOpenReceiveForPurchase(p, unpaidDana)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                              title={`Receive unpaid Dana (Rs. ${unpaidDana.toLocaleString()})`}
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>Receive</span>
                            </button>
                          ) : isDanaPaidOff ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Dana Paid
                            </span>
                          ) : null}
                          <button
                            onClick={() => handleDeletePurchase(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Delete this purchase entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: RECORD FACTORY PURCHASE */}
      {openNewPurchaseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 transition-colors">
            <button
              onClick={() => setOpenNewPurchaseModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Factory / Mill Purchase</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Stock automatically increases, and any unpaid amount is logged in the factory payable ledger.
            </p>

            {successMsg && (
              <div className="p-3 mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bags Bought from Company (Count)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 100"
                    value={formData.quantityBags || ''}
                    onChange={e => {
                      const newQty = Number(e.target.value);
                      const currentRate = Number(formData.ratePerBag) || 0;
                      const newTotal = newQty * currentRate;
                      setFormData(prev => ({
                        ...prev,
                        quantityBags: newQty,
                        borrowedAmount: (prev.borrowedAmount === 0 && prev.givenOnSpot === 0 && prev.advancePayment === 0 && newTotal > 0) ? newTotal : prev.borrowedAmount
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Set Price Per Bag Option */}
              <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="block text-xs font-bold text-amber-950 dark:text-amber-300">
                    Set Price per Bag Bought (Rs.)
                  </label>
                  {totalBagsCost > 0 && (
                    <span className="text-[11px] font-mono font-bold text-amber-800 dark:text-amber-300">
                      Total: {bagsCount} bags × Rs. {pricePerBag.toLocaleString()} = Rs. {totalBagsCost.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2600 (Price per bag)"
                    value={formData.ratePerBag || ''}
                    onChange={e => {
                      const newRate = Number(e.target.value);
                      const currentQty = Number(formData.quantityBags) || 0;
                      const newTotal = currentQty * newRate;
                      setFormData(prev => ({
                        ...prev,
                        ratePerBag: newRate,
                        borrowedAmount: (prev.borrowedAmount === 0 && prev.givenOnSpot === 0 && prev.advancePayment === 0 && newTotal > 0) ? newTotal : prev.borrowedAmount
                      }));
                    }}
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 rounded-lg text-xs font-mono font-bold text-amber-900 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {totalBagsCost > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, borrowedAmount: totalBagsCost, givenOnSpot: 0, advancePayment: 0 }))}
                        className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-md shadow-xs cursor-pointer transition-colors"
                        title="Set full calculated amount as Dana (factory debt)"
                      >
                        All Dana
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, givenOnSpot: totalBagsCost, borrowedAmount: 0, advancePayment: 0 }))}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md shadow-xs cursor-pointer transition-colors"
                        title="Set full calculated amount as Paid on Spot"
                      >
                        All Spot
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, advancePayment: totalBagsCost, borrowedAmount: 0, givenOnSpot: 0 }))}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-md shadow-xs cursor-pointer transition-colors"
                        title="Set full calculated amount as Advance"
                      >
                        All Advance
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Set how much money each bag was bought for. Total purchase price will update automatically.
                </span>
              </div>

              {/* Option to Select Already Given Advance Money */}
              {availableAdvance > 0 && (
                <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">
                          Already Given Advance Money Available:
                        </span>
                        <span className="text-[10px] text-blue-700 dark:text-blue-300">
                          {selectedCompanyObj.name} holds prepaid advance credit
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-blue-600 text-white font-mono font-black text-xs rounded-lg shadow-xs">
                      Rs. {availableAdvance.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
                    <button
                      type="button"
                      onClick={() => {
                        const maxToUse = totalBagsCost > 0 ? Math.min(availableAdvance, totalBagsCost) : availableAdvance;
                        setFormData(prev => ({
                          ...prev,
                          advanceUsed: maxToUse,
                          borrowedAmount: totalBagsCost > 0 ? Math.max(0, totalBagsCost - maxToUse - (Number(prev.givenOnSpot) || 0)) : prev.borrowedAmount
                        }));
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Use Advance for Bags ({totalBagsCost > 0 ? `Apply Rs. ${Math.min(availableAdvance, totalBagsCost).toLocaleString()}` : 'Apply Max'})
                    </button>
                    {advUsedVal > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            advanceUsed: 0,
                            borrowedAmount: totalBagsCost > 0 ? Math.max(0, totalBagsCost - (Number(prev.givenOnSpot) || 0)) : prev.borrowedAmount
                          }));
                        }}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Clear Advance Selection
                      </button>
                    )}
                    {advUsedVal > 0 && (
                      <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300 ml-auto">
                        ✓ Selected: Rs. {advUsedVal.toLocaleString()} (Prepaid)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Factory Transaction Inputs */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Factory Transaction Amounts</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Select advance, borrow dana, pay spot, or add advance</span>
                </div>

                <div className={`grid grid-cols-1 ${availableAdvance > 0 || advUsedVal > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
                  {(availableAdvance > 0 || advUsedVal > 0) && (
                    <div>
                      <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-1">
                        1. From Available Advance (Rs.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={availableAdvance}
                        placeholder="0"
                        value={formData.advanceUsed || ''}
                        onChange={e => {
                          const newAdvUsed = Math.min(availableAdvance, Number(e.target.value));
                          setFormData(prev => ({
                            ...prev,
                            advanceUsed: newAdvUsed,
                            borrowedAmount: totalBagsCost > 0 ? Math.max(0, totalBagsCost - newAdvUsed - (Number(prev.givenOnSpot) || 0)) : prev.borrowedAmount
                          }));
                        }}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-600 rounded-lg text-xs font-mono font-bold text-blue-900 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        Prepaid credit (Rs. 0 cash cut today)
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 mb-1">
                      {availableAdvance > 0 || advUsedVal > 0 ? '2. Money Borrowed (Dana)' : '1. Money Borrowed (Dana)'} (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.borrowedAmount || ''}
                      onChange={e => setFormData({ ...formData, borrowedAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 rounded-lg text-xs font-mono font-bold text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Increases factory Dana debt (unpaid)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                      {availableAdvance > 0 || advUsedVal > 0 ? '3. Given on Spot' : '2. Given on Spot'} (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.givenOnSpot || ''}
                      onChange={e => {
                        const newSpot = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          givenOnSpot: newSpot,
                          borrowedAmount: totalBagsCost > 0 ? Math.max(0, totalBagsCost - (Number(prev.advanceUsed) || 0) - newSpot) : prev.borrowedAmount
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-600 rounded-lg text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Spot cash paid for bags (cuts User Cash)
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-900 dark:text-purple-300 mb-1">
                      {availableAdvance > 0 || advUsedVal > 0 ? '4. Add Advance Money' : '3. Add Advance Money'} (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.advancePayment || ''}
                      onChange={e => setFormData({ ...formData, advancePayment: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-purple-400 dark:border-purple-600 rounded-lg text-xs font-mono font-bold text-purple-900 dark:text-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Stays as advance money in factory pool
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic summary with live logical equation */}
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs space-y-2">
                {totalBagsCost > 0 && (
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">Settlement Equation:</span>
                    <div className="flex items-center gap-1 font-bold">
                      <span className="text-slate-900 dark:text-slate-100 font-extrabold">Rs. {totalBagsCost.toLocaleString()}</span>
                      <span>=</span>
                      {advUsedVal > 0 && (
                        <>
                          <span className="text-blue-700 dark:text-blue-400">{advUsedVal.toLocaleString()} (Adv Used)</span>
                          <span>+</span>
                        </>
                      )}
                      <span className="text-emerald-700 dark:text-emerald-400">{spotVal.toLocaleString()} (Spot)</span>
                      <span>+</span>
                      <span className="text-amber-800 dark:text-amber-400">{danaVal.toLocaleString()} (Dana)</span>
                      {advanceVal > 0 && (
                        <>
                          <span className="text-slate-400">+</span>
                          <span className="text-purple-700 dark:text-purple-400">{advanceVal.toLocaleString()} (New Adv)</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {advUsedVal > 0 && (
                  <div className="flex justify-between text-blue-800 dark:text-blue-300 font-semibold">
                    <span>From Already Given Advance (Prepaid):</span>
                    <span className="font-mono font-bold">Rs. {advUsedVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Money Borrowed from Factory (Dana Debt):</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">Rs. {danaVal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Paid on Spot to Factory (Cash):</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">Rs. {spotVal.toLocaleString()}</span>
                </div>
                {advanceVal > 0 && (
                  <div className="flex justify-between text-purple-800 dark:text-purple-300 font-bold">
                    <span>New Advance Money to Factory Pool:</span>
                    <span className="font-mono text-purple-700 dark:text-purple-400 font-bold">Rs. {advanceVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200 dark:border-slate-700 pt-1.5 items-center">
                  <span>Added to Factory Debt (Dana / Payable):</span>
                  <span className={`font-mono ${netPayableAdded === 0 ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-amber-800 dark:text-amber-400 font-bold'}`}>
                    {netPayableAdded === 0 ? 'Rs. 0 (ZERO / CLEARED)' : `Rs. ${netPayableAdded.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-800 dark:text-slate-200 font-bold border-t border-slate-200/60 dark:border-slate-700/60 pt-1 items-center">
                  <span>Resulting Factory Payable:</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded ${resultingCompanyBalance === 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-extrabold' : 'text-amber-900 dark:text-amber-300 font-bold'}`}>
                    {resultingCompanyBalance === 0 ? 'Rs. 0 (ZERO - PAID IN FULL)' : `Rs. ${resultingCompanyBalance.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between text-blue-900 dark:text-blue-300 font-bold border-t border-slate-200/60 dark:border-slate-700/60 pt-1 items-center">
                  <span>Resulting Available Advance Pool:</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 font-extrabold">
                    Rs. {resultingAdvanceBalance.toLocaleString()}
                  </span>
                </div>
                {advUsedVal > 0 && (
                  <div className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    ✓ Rs. {advUsedVal.toLocaleString()} deducted from prepaid advance pool — Rs. 0 new cash leaves User Balance today!
                  </div>
                )}
                {spotVal > 0 && (
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold pt-0.5">
                    ✓ Spot Cash (Rs. {spotVal.toLocaleString()}) cuts User Balance and adds to Factory Balance
                  </div>
                )}
                {advanceVal > 0 && (
                  <div className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold pt-0.5">
                    ✓ New Advance Payment (Rs. {advanceVal.toLocaleString()}) cuts User Balance, adds to Factory Balance &amp; stays in Factory Advance Pool
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle / Truck No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. LES-7821"
                    value={formData.vehicleNumber}
                    onChange={e => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bilty / Invoice No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. BL-49102"
                    value={formData.biltyNumber}
                    onChange={e => setFormData({ ...formData, biltyNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Warehouse Bay</label>
                <input
                  type="text"
                  placeholder="e.g. Unloaded at Bay 2, Quality test approved"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenNewPurchaseModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Recording...' : 'Confirm & Update Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: COMPANY LEDGER STATEMENT VIEWER */}
      {selectedCompanyForLedger && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 transition-colors">
            <button
              onClick={() => {
                setSelectedCompanyForLedger(null);
                setCompanyLedgerData(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
              <div>
                <span className="text-xs text-amber-700 dark:text-amber-400 font-bold tracking-wider uppercase">SUPPLIER ACCOUNT STATEMENT</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{selectedCompanyForLedger.name}</h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>City: <strong>{selectedCompanyForLedger.city}</strong></span>
                  <span>Contact: <strong>{selectedCompanyForLedger.contactPerson} ({selectedCompanyForLedger.phone})</strong></span>
                  <span>Bank: <strong>{selectedCompanyForLedger.bankDetails}</strong></span>
                </div>
              </div>

              <div className="text-right flex items-center gap-3">
                {(companyLedgerData?.calculatedBalance ?? selectedCompanyForLedger.currentBalance) > 0 && (
                  <button
                    onClick={() => {
                      setShowPayCompanyModal(selectedCompanyForLedger);
                      setPayAmount(companyLedgerData?.calculatedBalance ?? selectedCompanyForLedger.currentBalance);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Pay supplier and cut Dana udhaar"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Supplier</span>
                  </button>
                )}
                <button
                  onClick={() => handleDownloadLedger(selectedCompanyForLedger)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Download supplier statement document"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Statement</span>
                </button>
              </div>
            </div>

            {/* Balance Overview */}
            <div className="my-4 grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-center">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Total Purchases</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums mt-1">
                  Rs. {Math.round(selectedCompanyForLedger.totalPurchases || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-center">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Total Payments Made</div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-1">
                  Rs. {Math.round(selectedCompanyForLedger.totalPayments || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 text-center">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Net Payable Balance</div>
                <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-1">
                  Rs. {Math.round(companyLedgerData?.calculatedBalance ?? selectedCompanyForLedger.currentBalance).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            {loadingLedger ? (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">Loading ledger statement...</div>
            ) : (
              <div className="overflow-x-auto max-h-96 border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[11px] border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Transaction &amp; Vehicle</th>
                      <th className="py-2.5 px-3">Reference / Slip</th>
                      <th className="py-2.5 px-3 text-right">Debit (Payment)</th>
                      <th className="py-2.5 px-3 text-right">Credit (Bill)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {companyLedgerData?.ledgerEntries?.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-mono">{entry.date}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{entry.description}</div>
                          {entry.vehicleNumber && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Truck: {entry.vehicleNumber}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {entry.reference || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                          {entry.debit > 0 ? `Rs. ${entry.debit.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                          {entry.credit > 0 ? `Rs. ${entry.credit.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-extrabold text-amber-800 dark:text-amber-400">
                          Rs. {entry.runningBalance?.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleDeleteCompanyLedgerEntry(entry)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            title="Delete this ledger entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!companyLedgerData?.ledgerEntries || companyLedgerData.ledgerEntries.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                          No transaction records found for this company.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSelectedCompanyForLedger(null);
                  setCompanyLedgerData(null);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: ADD NEW COMPANY */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl text-slate-900 dark:text-slate-100 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Add Feed Mill / Factory</h3>
            <form onSubmit={handleAddCompany} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company / Mill Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Hamd Cattle Feeds Ltd"
                  value={newCompanyData.name}
                  onChange={e => setNewCompanyData({ ...newCompanyData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Malik Asif"
                    value={newCompanyData.contactPerson}
                    onChange={e => setNewCompanyData({ ...newCompanyData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 0300-1234567"
                    value={newCompanyData.phone}
                    onChange={e => setNewCompanyData({ ...newCompanyData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">City / Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Faisalabad / Sahiwal"
                    value={newCompanyData.city}
                    onChange={e => setNewCompanyData({ ...newCompanyData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Opening Payable (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newCompanyData.initialBalance}
                    onChange={e => setNewCompanyData({ ...newCompanyData, initialBalance: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bank Account Details (For Payments)</label>
                <input
                  type="text"
                  placeholder="e.g. HBL - 00427901182301"
                  value={newCompanyData.bankDetails}
                  onChange={e => setNewCompanyData({ ...newCompanyData, bankDetails: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 shadow-xs cursor-pointer"
                >
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: DIRECT PAY COMPANY */}
      {showPayCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl text-slate-900 dark:text-slate-100 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Record Payment to Factory</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Direct payment from us to {showPayCompanyModal.name}. Current payable: <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">Rs. {showPayCompanyModal.currentBalance?.toLocaleString()}</span>
            </p>

            <form onSubmit={handleDirectPaySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Amount (Rs.) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-emerald-700 dark:text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="Bank Transfer (Online)">Bank Transfer (Online / Raast)</option>
                  <option value="Cash Paid at Mill Counter">Cash Paid at Mill Counter</option>
                  <option value="Cheque / Pay Order">Cheque / Pay Order</option>
                  <option value="Freight / Truck Driver Advance">Freight / Truck Driver Advance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. FT-9948201 / Cheque # 8820"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Paid against October Vanda invoice"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayCompanyModal(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payingCompany}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {payingCompany ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: WHOLESALE (BIG PARTIES) COMPANY ENTRY */}
      {openWholesaleCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 transition-colors">
            <button
              onClick={() => setOpenWholesaleCompanyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Wholesale (Big Parties) Entry</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter normal money for purchases or &quot;Udhaar (recieve)&quot; payback directly from wholesale big parties into the factory account.
            </p>

            <form onSubmit={handleWholesaleCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Wholesale Big Party *</label>
                <select
                  required
                  value={wholesaleFormData.partyId}
                  onChange={e => setWholesaleFormData({ ...wholesaleFormData, partyId: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                >
                  {parties.length === 0 ? (
                    <option value="">No wholesale parties available</option>
                  ) : (
                    parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Phone: {p.phone || 'N/A'})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transaction Date *</label>
                <input
                  type="date"
                  required
                  value={wholesaleFormData.date}
                  onChange={e => setWholesaleFormData({ ...wholesaleFormData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Wholesale Amounts</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1">
                      1. Normal Money for Purchases (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={wholesaleFormData.paidSpot || ''}
                      onChange={e => setWholesaleFormData({ ...wholesaleFormData, paidSpot: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-400 dark:border-emerald-600 rounded-lg text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Spot payment to factory account
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 mb-1">
                      2. Udhaar (recieve) (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={wholesaleFormData.udhaarReceive || ''}
                      onChange={e => setWholesaleFormData({ ...wholesaleFormData, udhaarReceive: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-600 rounded-lg text-xs font-mono font-bold text-amber-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                      Normal transaction payback (cuts Dana of this party, no purchase of goods)
                    </span>
                  </div>
                </div>

                {(() => {
                  const selParty = parties.find(p => p.id === wholesaleFormData.partyId);
                  const spotAmt = Number(wholesaleFormData.paidSpot) || 0;
                  const udhaarAmt = Number(wholesaleFormData.udhaarReceive) || 0;
                  if (spotAmt <= 0 && udhaarAmt <= 0) return null;
                  const curBal = selParty?.currentBalance || 0;
                  const newBal = Math.max(0, curBal - udhaarAmt);

                  return (
                    <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-2">
                      <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/60 pb-1 flex items-center justify-between">
                        <span>Balance Impact Preview:</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">{selParty?.name || 'Wholesale Party'}</span>
                      </div>

                      {spotAmt > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
                            <span>Normal Money for Purchases:</span>
                            <span className="font-mono tabular-nums">Rs. {spotAmt.toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            ✓ Added to Factory Balance (+Rs. {spotAmt.toLocaleString()})
                          </div>
                        </div>
                      )}

                      {udhaarAmt > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300">
                            <span>Udhaar (recieve) Payback:</span>
                            <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-extrabold">- Rs. {udhaarAmt.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                            <span>Customer Current Dana (Debt):</span>
                            <span className="font-mono">Rs. {curBal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            <span>Customer Resulting Dana:</span>
                            <span className="font-mono text-emerald-700 dark:text-emerald-400">Rs. {newBal.toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            ✓ Acts as Pay/Receive (No Purchase) &amp; cuts customer Dana
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                            ✓ Added ONLY to Factory Balance (+Rs. {udhaarAmt.toLocaleString()})
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle / Truck No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. TK-8812"
                    value={wholesaleFormData.vehicleNumber}
                    onChange={e => setWholesaleFormData({ ...wholesaleFormData, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Slip / Reference No. (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. SLIP-9012"
                    value={wholesaleFormData.biltyNumber}
                    onChange={e => setWholesaleFormData({ ...wholesaleFormData, biltyNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Direct bank deposit from wholesale party"
                  value={wholesaleFormData.notes}
                  onChange={e => setWholesaleFormData({ ...wholesaleFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOpenWholesaleCompanyModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{submitting ? 'Saving...' : 'Save Wholesale Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: RECEIVE FACTORY BUY UDHAAR FROM USER */}
      {showReceiveUdhaarModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative my-auto max-h-[90vh] overflow-y-auto text-slate-900 dark:text-slate-100 transition-colors">
            <button
              onClick={() => setShowReceiveUdhaarModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Receive Factory Buy Udhaar</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receive dana/udhaar from User (Farooq Gujjar) to clear factory debt and deposit into factory balance.
                </p>
              </div>
            </div>

            {receiveSuccessMsg && (
              <div className="p-3 my-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{receiveSuccessMsg}</span>
              </div>
            )}

            {/* Udhaar Status Banner */}
            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Total Factory Payable (Dana Owed):</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  Rs. {Math.round(totalPayables).toLocaleString()}
                </span>
              </div>
              {receiveTargetPurchase && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    Slip #{receiveTargetPurchase.biltyNumber || receiveTargetPurchase.id} ({receiveTargetPurchase.date}):
                  </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    Rs. {Number(receiveTargetPurchase.borrowedAmount || 0).toLocaleString()} borrowed
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitReceiveUdhaar} className="space-y-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Amount to Receive (PKR / Rs.) *
                  </label>
                  {totalPayables > 0 && (
                    <button
                      type="button"
                      onClick={() => setReceiveData(prev => ({ ...prev, amount: totalPayables }))}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Fill Full Udhaar (Rs. {Math.round(totalPayables).toLocaleString()})
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rs.</span>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                    value={receiveData.amount || ''}
                    onChange={e => setReceiveData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Factory / Mill
                  </label>
                  <select
                    value={receiveData.companyId}
                    onChange={e => setReceiveData(prev => ({ ...prev, companyId: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={receiveData.paymentMethod}
                    onChange={e => setReceiveData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Cash (Direct to Factory Balance)">Cash (Direct to Factory Balance)</option>
                    <option value="Bank Transfer (Online)">Bank Transfer (Online)</option>
                    <option value="Cheque / Slip">Cheque / Slip</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={receiveData.date}
                    onChange={e => setReceiveData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Receipt / Bilty Ref #
                  </label>
                  <input
                    type="text"
                    value={receiveData.biltyNumber}
                    onChange={e => setReceiveData(prev => ({ ...prev, biltyNumber: e.target.value }))}
                    placeholder="e.g. REC-FB-1234"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  value={receiveData.notes}
                  onChange={e => setReceiveData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Received factory buy udhaar from user (Farooq Gujjar)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              {/* Dynamic Impact Summary */}
              {Number(receiveData.amount) > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300">
                    Summary of Balance Updates:
                  </div>
                  <div className="flex justify-between text-emerald-800 dark:text-emerald-400">
                    <span>• Factory Buy Udhaar (Dana Owed):</span>
                    <span className="font-mono font-bold">- Rs. {Number(receiveData.amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 dark:text-emerald-400">
                    <span>• Factory / Company Balance:</span>
                    <span className="font-mono font-bold">+ Rs. {Number(receiveData.amount).toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReceiveUdhaarModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receivingUdhaar || Number(receiveData.amount) <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {receivingUdhaar 
                      ? 'Receiving...' 
                      : Number(receiveData.amount) > 0 
                        ? `Receive Rs. ${Number(receiveData.amount).toLocaleString()}` 
                        : 'Receive Udhaar'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable in-app deletion confirmation modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmation.isOpen}
        title={deleteConfirmation.title}
        description={deleteConfirmation.description}
        isDeleting={isDeleting}
        onConfirm={handleExecuteDelete}
        onClose={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
