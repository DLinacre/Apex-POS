const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;

createApp({
    setup() {
        // Multi-tab sync channel (BroadcastChannel API)
        let syncChannel = null;
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                syncChannel = new BroadcastChannel('apex-pos-sync');
            }
        } catch (e) { /* BroadcastChannel not supported */ }

        return { syncChannel };
    },

    data() {
        return {
            currentView: 'dashboard',
            sidebarOpen: false,
            darkMode: false,

            settings: {
                storeName: "Apex Corner Shop",
                storeAddress: "101 Colmore Row, Birmingham, B3 3AG",
                storePhone: "+44 121 555 0199",
                storeEmail: "contact@apexshop.co.uk",
                currency: "£",
                taxRate: 20,
                receiptHeader: "THANK YOU FOR YOUR BUSINESS!",
                receiptFooter: "Please keep this receipt. Refunds within 14 days.",
                lowStockAlert: 10,
                googleClientId: "",
                receiptLogo: "" // data URL for receipt logo
            },

            products: [],
            categories: [],
            sales: [],
            customers: [],
            expenses: [],
            cashiers: [],

            activeCashier: {
                name: "Admin Manager",
                role: "Manager",
                email: "manager@apexpos.com",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80"
            },

            selectedCategory: 'All',
            searchQuery: '',

            cart: [],
            cartDiscount: 0,
            cartDiscountType: 'fixed',
            selectedCustomer: null,
            heldCarts: [],

            paymentMethod: 'Cash',
            paidAmount: null,
            checkoutNotes: '',
            isCheckoutModalOpen: false,

            nfcSupported: false,
            nfcScanning: false,
            nfcWriteData: '',
            isNfcWriterOpen: false,
            nfcWriteTargetType: 'customer',
            nfcWriteTargetId: '',

            currentReceiptSale: null,
            isReceiptModalOpen: false,

            productModalMode: 'add',
            isProductModalOpen: false,
            productForm: { id: null, name: '', sku: '', barcode: '', category: '', costPrice: 0, retailPrice: 0, stock: 0, reorderPoint: 5, image: '', status: 'active', description: '' },

            customerModalMode: 'add',
            isCustomerModalOpen: false,
            customerForm: { id: null, name: '', phone: '', email: '', address: '', notes: '' },

            expenseModalMode: 'add',
            isExpenseModalOpen: false,
            expenseForm: { id: null, date: new Date().toISOString().split('T')[0], category: 'Rent', amount: 0, description: '', paymentMethod: 'Bank Transfer' },

            isCategoryModalOpen: false,
            categoryForm: { name: '', description: '' },

            isCashierModalOpen: false,
            cashierForm: { name: '', passcode: '', role: 'Cashier', email: '', nfcUid: '' },

            barcodeBuffer: '',
            lastBarcodeKeyTime: 0,
            barcodeScannerActive: false,
            barcodeScannerStream: null,
            _barcodeVideo: null,
            _barcodeScanInterval: null,

            reportRange: '7days',
            customStartDate: '',
            customEndDate: '',

            salesChartInstance: null,
            categoryChartInstance: null,

            isShortcutsModalOpen: false,
            isOnline: navigator.onLine,
            isLoading: true,

            defaultProductImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"%3E%3Crect fill="%23e2e8f0" width="300" height="300"/%3E%3Ctext x="150" y="150" text-anchor="middle" dy=".35em" fill="%2394a3b8" font-size="48" font-family="system-ui" font-weight="600"%3EPOS%3C/text%3E%3C/svg%3E',

            notification: { show: false, message: '', type: 'success' },
            liveRegionMessage: '',

            // Multi-tab sync
            syncEnabled: false,
            syncTabs: false
        };
    },

    computed: {
        shortcuts() {
            return [
                { key: 'R', action: 'Open POS Register' },
                { key: 'D', action: 'Open Dashboard' },
                { key: 'I', action: 'Open Inventory' },
                { key: 'S', action: 'Open Sales History' },
                { key: 'C', action: 'Open Checkout' },
                { key: 'B', action: 'Toggle Camera Barcode Scanner' },
                { key: '?', action: 'Toggle Shortcuts Help' },
                { key: 'Esc', action: 'Close Modal / Cancel' }
            ];
        },

        filteredProducts() {
            return this.products.filter(p => {
                const matchesCategory = this.selectedCategory === 'All' || p.category === this.selectedCategory;
                const searchLower = this.searchQuery.toLowerCase();
                const matchesSearch = p.name.toLowerCase().includes(searchLower) ||
                                      p.sku.toLowerCase().includes(searchLower) ||
                                      (p.barcode && p.barcode.includes(this.searchQuery));
                return matchesCategory && matchesSearch && p.status === 'active';
            });
        },

        cartSubtotal() {
            return this.cart.reduce((sum, item) => sum + (item.retailPrice * item.qty), 0);
        },

        cartDiscountAmount() {
            if (this.cartDiscountType === 'percent') {
                return parseFloat(((this.cartSubtotal * this.cartDiscount) / 100).toFixed(2));
            }
            return parseFloat(Number(this.cartDiscount).toFixed(2));
        },

        cartTaxableAmount() {
            return Math.max(0, this.cartSubtotal - this.cartDiscountAmount);
        },

        cartTaxAmount() {
            const rate = this.settings.taxRate / 100;
            return parseFloat((this.cartTaxableAmount * rate).toFixed(2));
        },

        cartTotal() {
            return parseFloat((this.cartTaxableAmount + this.cartTaxAmount).toFixed(2));
        },

        cartChangeAmount() {
            if (this.paidAmount === null || this.paidAmount === '') return 0;
            return parseFloat((Number(this.paidAmount) - this.cartTotal).toFixed(2));
        },

        dashboardMetrics() {
            const rangeSales = this.getFilteredSalesForReports();
            const rangeExpenses = this.getFilteredExpensesForReports();

            const grossSales = rangeSales.reduce((sum, s) => s.status === 'completed' ? sum + s.total : sum, 0);
            const totalProfit = rangeSales.reduce((sum, s) => s.status === 'completed' ? sum + s.profit : sum, 0);
            const totalExpenses = rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
            const netProfit = parseFloat((totalProfit - totalExpenses).toFixed(2));
            const transactionCount = rangeSales.filter(s => s.status === 'completed').length;
            const avgBasket = transactionCount > 0 ? parseFloat((grossSales / transactionCount).toFixed(2)) : 0;
            const lowStockProducts = this.products.filter(p => p.stock <= p.reorderPoint);

            return {
                netSales: parseFloat(grossSales.toFixed(2)),
                netProfit,
                transactionCount,
                avgBasket,
                totalExpenses: parseFloat(totalExpenses.toFixed(2)),
                lowStockCount: lowStockProducts.length,
                lowStockProducts: lowStockProducts.slice(0, 5)
            };
        }
    },

    methods: {
        showNotification(message, type = 'success') {
            this.notification.message = message;
            this.notification.type = type;
            this.notification.show = true;
            this.liveRegionMessage = message + ' — ' + type;
            setTimeout(() => {
                this.notification.show = false;
                this.liveRegionMessage = '';
            }, 4000);
        },

        // ── MULTI-TAB SYNC (BroadcastChannel) ──
        initSyncChannel() {
            if (!this.syncChannel) {
                try {
                    if (typeof BroadcastChannel !== 'undefined') {
                        this.syncChannel = new BroadcastChannel('apex-pos-sync');
                    }
                } catch (e) { return; }
            }
            if (!this.syncChannel) return;

            this.syncChannel.onmessage = (event) => {
                const msg = event.data;
                if (!msg || !msg.type) return;

                // Ignore messages we sent ourselves
                if (msg.sender && msg.sender === this._syncId) return;

                switch (msg.type) {
                    case 'DATA_CHANGED':
                        this.showNotification('Data synced from another tab.', 'info');
                        this.loadAllData();
                        break;
                    case 'CART_UPDATED':
                        this.restoreCartFromStorage();
                        this.showNotification('Cart synced from another tab.', 'info');
                        break;
                    case 'SETTINGS_CHANGED':
                        this.loadAllData();
                        this.showNotification('Settings synced from another tab.', 'info');
                        break;
                }
            };
            this.syncEnabled = true;
        },

        broadcastSync(type) {
            if (!this.syncChannel || !this.syncEnabled) return;
            try {
                this.syncChannel.postMessage({
                    type: type,
                    sender: this._syncId,
                    timestamp: Date.now()
                });
            } catch (e) { /* silent */ }
        },

        // ── SESSION PERSISTENCE ──
        saveCartToStorage() {
            const state = { cart: this.cart, cartDiscount: this.cartDiscount, cartDiscountType: this.cartDiscountType, selectedCustomer: this.selectedCustomer };
            try {
                localStorage.setItem('apex_pos_cart_state', JSON.stringify(state));
                document.cookie = `apex_cart_active=true; max-age=86400; path=/; SameSite=Lax; Secure`;
                this.broadcastSync('CART_UPDATED');
            } catch (e) { console.warn('Cart save failed:', e); }
        },

        restoreCartFromStorage() {
            const stateStr = localStorage.getItem('apex_pos_cart_state');
            if (stateStr) {
                try {
                    const state = JSON.parse(stateStr);
                    this.cart = state.cart || [];
                    this.cartDiscount = state.cartDiscount || 0;
                    this.cartDiscountType = state.cartDiscountType || 'fixed';
                    this.selectedCustomer = state.selectedCustomer || null;
                } catch (e) { console.error("Cart state load error", e); }
            }
        },

        saveCashierSession(cashier) {
            const { passcode, nfcUid, ...safeCashier } = cashier;
            this.activeCashier = safeCashier;
            try {
                localStorage.setItem('apex_pos_cashier', JSON.stringify(safeCashier));
                document.cookie = `apex_cashier_name=${encodeURIComponent(safeCashier.name)}; max-age=2592000; path=/; SameSite=Lax; Secure`;
            } catch (e) { console.warn('Cashier save failed:', e); }
        },

        restoreCashierSession() {
            const cashierStr = localStorage.getItem('apex_pos_cashier');
            if (cashierStr) {
                try { this.activeCashier = JSON.parse(cashierStr); } catch (e) { console.error("Cashier session error", e); }
            }
        },

        // ── GOOGLE SIGN-IN ──
        initGoogleIdentity() {
            const clientID = (this.settings.googleClientId || "").trim();
            if (!clientID) return;
            const startGsi = () => {
                if (typeof google === 'undefined' || !google.accounts) return;
                try {
                    google.accounts.id.initialize({ client_id: clientID, callback: this.handleGoogleCredentialResponse, auto_select: true });
                    const btn = document.getElementById("google-signin-button");
                    if (btn) google.accounts.id.renderButton(btn, { theme: "outline", size: "medium", shape: "pill" });
                } catch (err) { console.warn("Google SSO init failed:", err); }
            };
            if (typeof google !== 'undefined' && google.accounts) { startGsi(); return; }
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true; script.defer = true;
            script.onload = startGsi;
            script.onerror = () => console.warn("Google Identity Services failed to load.");
            document.head.appendChild(script);
        },

        handleGoogleCredentialResponse(response) {
            try {
                const profile = this.decodeJwt(response.credential);
                if (profile) {
                    const cashier = { name: profile.name, role: "Google User", email: profile.email, avatar: profile.picture || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80" };
                    this.saveCashierSession(cashier);
                    this.showNotification(`Logged in as ${cashier.name}!`, "success");
                    this.changeView('dashboard');
                }
            } catch (err) { console.error("JWT Decode error", err); this.showNotification("Google profile parse failed.", "error"); }
        },

        decodeJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                return JSON.parse(jsonPayload);
            } catch (e) { return null; }
        },

        logoutCashier() {
            const defaultCashier = { name: "Admin Manager", role: "Manager", email: "manager@apexpos.com", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80" };
            this.saveCashierSession(defaultCashier);
            this.showNotification("Logged out cashier session.", "success");
        },

        // ── WEB NFC API ──
        async toggleNfcScanning() {
            if (!('NDEFReader' in window)) { this.showNotification("Web NFC is not supported on this device. Use the simulator instead.", "warning"); return; }
            try {
                if (this.nfcScanning) { this.nfcScanning = false; this.showNotification("NFC reader disabled.", "info"); return; }
                const ndef = new NDEFReader();
                await ndef.scan();
                this.nfcScanning = true;
                this.showNotification("NFC active! Tap NFC cards/tags.", "success");
                ndef.addEventListener("reading", ({ message }) => {
                    for (const record of message.records) {
                        const decoder = new TextDecoder(record.encoding || 'utf-8');
                        this.processNfcTag(decoder.decode(record.data));
                    }
                });
                ndef.addEventListener("readingerror", () => this.showNotification("NFC read error.", "error"));
            } catch (error) { console.error("NFC setup error:", error); this.showNotification("NFC permission denied.", "error"); }
        },

        processNfcTag(payload) {
            const tag = payload.trim();
            if (tag.startsWith("employee:")) { this.dbLoginByNfc(tag.split(":")[1]); }
            else if (tag.startsWith("customer:")) {
                const name = tag.split(":").slice(1).join(":");
                const cust = this.customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (cust) { this.selectedCustomer = cust; this.saveCartToStorage(); this.showNotification(`Loyalty profile: ${cust.name}`, "success"); }
                else { this.showNotification(`Customer not found: ${name}`, "warning"); }
            } else if (tag.startsWith("product:")) {
                const sku = tag.split(":").slice(1).join(":");
                const prod = this.products.find(p => p.sku === sku && p.status === 'active');
                if (prod) { this.addToCart(prod); this.showNotification(`Added ${prod.name} via NFC!`, "success"); }
                else { this.showNotification(`Product SKU not found: ${sku}`, "warning"); }
            } else {
                const prod = this.products.find(p => p.sku === tag || p.barcode === tag);
                if (prod) { this.addToCart(prod); this.showNotification(`Added ${prod.name} via NFC!`, "success"); return; }
                const cust = this.customers.find(c => c.phone === tag || c.name === tag);
                if (cust) { this.selectedCustomer = cust; this.showNotification(`Loyalty profile: ${cust.name}`, "success"); return; }
                this.showNotification(`Unknown NFC tag: ${tag}`, "info");
            }
        },

        async dbLoginByNfc(passcodeOrName) {
            const matched = this.cashiers.find(c => c.passcode === passcodeOrName || c.name.toLowerCase() === passcodeOrName.toLowerCase() || c.nfcUid === `employee:${passcodeOrName}`);
            if (matched) {
                const cashier = { name: matched.name, role: matched.role, email: matched.email, avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80" };
                this.saveCashierSession(cashier);
                this.showNotification(`NFC Login: Welcome, ${cashier.name}!`, "success");
                this.changeView('dashboard');
            } else { this.showNotification("NFC badge not matched.", "error"); }
        },

        openNfcWriter(type, item) {
            this.nfcWriteTargetType = type;
            this.nfcWriteData = type === 'customer' ? `customer:${item.name}` : type === 'product' ? `product:${item.sku}` : `employee:${item.passcode || item.name}`;
            this.nfcWriteTargetId = item.id;
            this.isNfcWriterOpen = true;
        },

        async executeNfcWrite() {
            if (!('NDEFReader' in window)) { this.showNotification("NFC Writing requires Chrome on Android.", "error"); return; }
            try {
                this.showNotification("Hold empty NFC tag near phone...", "info");
                const ndef = new NDEFReader();
                await ndef.write(this.nfcWriteData);
                this.showNotification("NFC tag programmed!", "success");
                this.isNfcWriterOpen = false;
                if (this.nfcWriteTargetType === 'employee') await db.cashiers.update(this.nfcWriteTargetId, { nfcUid: this.nfcWriteData });
                await this.loadAllData();
            } catch (error) { console.error(error); this.showNotification("NFC programming failed.", "error"); }
        },

        handleImageError(event) { event.target.src = this.defaultProductImage; event.target.onerror = null; },

        toggleShortcuts() { this.isShortcutsModalOpen = !this.isShortcutsModalOpen; },

        simulateNfcTap(simulatedPayload) {
            this.showNotification(`[NFC Simulator] Scanning: "${simulatedPayload}"`, "info");
            setTimeout(() => this.processNfcTag(simulatedPayload), 500);
        },

        // ── TENDER KEYPAD ──
        addTenderDigit(digit) {
            const current = this.paidAmount === null ? '' : String(this.paidAmount);
            if (digit === '.') { if (current.includes('.')) return; this.paidAmount = current === '' ? '0.' : current + '.'; }
            else { this.paidAmount = parseFloat(current + digit); }
        },
        clearTender() { this.paidAmount = ''; },
        backspaceTender() {
            const current = String(this.paidAmount || '');
            this.paidAmount = current.length <= 1 ? '' : (parseFloat(current.slice(0, -1)) || '');
        },
        setQuickTender(amount) { this.paidAmount = amount === 'exact' ? this.cartTotal : amount; },

        // ── DATABASE ──
        async loadAllData() {
            this.isLoading = true;
            try {
                await seedDemoData();
                const settingsMap = await getSettingsMap();
                if (settingsMap.storeName) this.settings = { ...this.settings, ...settingsMap };
                this.products = await db.products.toArray();
                this.categories = await db.categories.toArray();
                this.customers = await db.customers.toArray();
                this.expenses = await db.expenses.toArray();
                this.cashiers = await db.cashiers.toArray();
                this.sales = await db.sales.orderBy('date').reverse().toArray();
                this.restoreCashierSession();
                this.restoreCartFromStorage();
                if (this.customers.length > 0 && !this.selectedCustomer) {
                    this.selectedCustomer = this.customers.find(c => c.name === "Walk-in Customer") || this.customers[0];
                }
                this.initGoogleIdentity();
                if (this.currentView === 'dashboard') this.renderCharts();
            } catch (err) { console.error("DB sync failed", err); this.showNotification("IndexedDB sync failure.", "error"); }
            finally { this.isLoading = false; }
        },

        changeView(view) {
            this.currentView = view;
            this.sidebarOpen = false;
            nextTick(() => {
                const main = document.querySelector('main');
                if (main) { main.setAttribute('tabindex', '-1'); main.focus(); }
                if (view === 'dashboard') this.renderCharts();
            });
        },

        // ── CART WORKFLOWS ──
        addToCart(product) {
            if (product.stock <= 0) { this.showNotification(`Stock depleted for ${product.name}!`, "warning"); return; }
            const existing = this.cart.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty >= product.stock) { this.showNotification(`Max stock (${product.stock}).`, "warning"); return; }
                existing.qty++;
            } else {
                this.cart.push({ id: product.id, name: product.name, sku: product.sku, costPrice: product.costPrice, retailPrice: product.retailPrice, qty: 1 });
            }
            this.saveCartToStorage();
        },

        updateCartQty(item, amount) {
            const product = this.products.find(p => p.id === item.id);
            const newQty = item.qty + amount;
            if (newQty <= 0) { this.removeFromCart(item); return; }
            if (product && newQty > product.stock) this.showNotification(`Only ${product.stock} available.`, "warning");
            item.qty = Math.max(1, newQty);
            this.saveCartToStorage();
        },

        removeFromCart(item) { const idx = this.cart.indexOf(item); if (idx > -1) this.cart.splice(idx, 1); this.saveCartToStorage(); },

        clearCart() {
            this.cart = []; this.cartDiscount = 0; this.paidAmount = null; this.checkoutNotes = '';
            const walkIn = this.customers.find(c => c.name === "Walk-in Customer");
            if (walkIn) this.selectedCustomer = walkIn;
            this.saveCartToStorage();
        },

        suspendCart() {
            if (this.cart.length === 0) return;
            this.heldCarts.push({ id: Date.now(), date: new Date().toISOString(), customer: this.selectedCustomer ? { ...this.selectedCustomer } : null, items: [...this.cart], discount: this.cartDiscount, discountType: this.cartDiscountType });
            this.clearCart();
            this.showNotification("Cart held in drafts.", "success");
        },

        resumeCart(heldCart) {
            this.cart = heldCart.items; this.cartDiscount = heldCart.discount; this.cartDiscountType = heldCart.discountType;
            if (heldCart.customer) this.selectedCustomer = this.customers.find(c => c.id === heldCart.customer.id) || heldCart.customer;
            this.heldCarts = this.heldCarts.filter(c => c.id !== heldCart.id);
            this.saveCartToStorage();
            this.showNotification("Cart restored.", "success");
        },

        deleteHeldCart(heldCart) { this.heldCarts = this.heldCarts.filter(c => c.id !== heldCart.id); this.showNotification("Held cart cleared.", "success"); },

        triggerCartDiscount() {
            const symbol = this.cartDiscountType === 'percent' ? '%' : this.settings.currency;
            const input = prompt(`Enter discount (${symbol}):`, this.cartDiscount);
            if (input === null) return;
            const val = parseFloat(input);
            this.cartDiscount = isNaN(val) || val < 0 ? 0 : val;
            this.saveCartToStorage();
        },

        toggleDiscountType() { this.cartDiscountType = this.cartDiscountType === 'fixed' ? 'percent' : 'fixed'; this.saveCartToStorage(); },

        openCheckout() {
            if (this.cart.length === 0) { this.showNotification("Cart is empty.", "warning"); return; }
            this.paidAmount = this.cartTotal;
            this.isCheckoutModalOpen = true;
        },

        setPaymentMethod(method) { this.paymentMethod = method; if (method !== 'Cash') this.paidAmount = this.cartTotal; },

        async submitCheckout() {
            if (this.paidAmount < this.cartTotal && this.paymentMethod === 'Cash') { this.showNotification("Cash tendered is less than total.", "error"); return; }
            try {
                const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
                const saleDate = new Date().toISOString();
                let totalCost = 0;
                const saleItems = this.cart.map(item => { const cost = item.costPrice * item.qty; totalCost += cost; return { productId: item.id, name: item.name, sku: item.sku, price: item.retailPrice, qty: item.qty, cost: item.costPrice, total: item.retailPrice * item.qty }; });
                for (const item of this.cart) {
                    const prod = this.products.find(p => p.id === item.id);
                    if (prod) await db.products.update(prod.id, { stock: Math.max(0, prod.stock - item.qty) });
                }
                const revenue = this.cartTotal;
                const profit = parseFloat((revenue - totalCost).toFixed(2));
                const saleRecord = { invoiceNumber, date: saleDate, items: saleItems, discount: this.cartDiscountAmount, tax: this.cartTaxAmount, subtotal: this.cartSubtotal, total: revenue, profit, paidAmount: Number(this.paidAmount), changeAmount: this.cartChangeAmount, paymentMethod: this.paymentMethod, status: 'completed', customerId: this.selectedCustomer ? this.selectedCustomer.id : null, customerName: this.selectedCustomer ? this.selectedCustomer.name : 'Walk-in Customer', notes: this.checkoutNotes, cashierName: this.activeCashier ? this.activeCashier.name : 'System Terminal' };
                const saleId = await db.sales.add(saleRecord);
                saleRecord.id = saleId;
                if (this.selectedCustomer && this.selectedCustomer.name !== "Walk-in Customer") {
                    await db.customers.update(this.selectedCustomer.id, { points: (this.selectedCustomer.points || 0) + Math.floor(revenue) });
                }
                this.isCheckoutModalOpen = false;
                this.showNotification(`Sale ${invoiceNumber} completed!`, "success");
                this.currentReceiptSale = saleRecord;
                this.isReceiptModalOpen = true;
                this.clearCart();
                this.broadcastSync('DATA_CHANGED');
                await this.loadAllData();
            } catch (err) { console.error("Sale error:", err); this.showNotification("Sale failed.", "error"); }
        },

        // ── KEYBOARD & BARCODE HANDLERS ──
        handleGlobalKeypress(e) {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastBarcodeKeyTime;
            this.lastBarcodeKeyTime = currentTime;

            if (timeDiff < 50) {
                if (e.key === 'Enter') {
                    const matchedBarcode = this.barcodeBuffer.trim();
                    this.barcodeBuffer = '';
                    if (matchedBarcode.length > 2) this.addByBarcode(matchedBarcode);
                } else if (e.key !== 'Shift') { this.barcodeBuffer += e.key; }
            } else {
                this.barcodeBuffer = e.key !== 'Shift' ? e.key : '';
                if (!isInput) {
                    if (e.key === 'r' || e.key === 'R') this.changeView('register');
                    if (e.key === 'd' || e.key === 'D') this.changeView('dashboard');
                    if (e.key === 'i' || e.key === 'I') this.changeView('inventory');
                    if (e.key === 's' || e.key === 'S') this.changeView('sales');
                    if (e.key === 'c' || e.key === 'C') this.openCheckout();
                    if (e.key === 'b' || e.key === 'B') this.toggleBarcodeScanner();
                    if (e.key === '?' || (e.key === '/' && !isInput)) this.toggleShortcuts();
                    if (e.key === 'Escape') {
                        this.isCheckoutModalOpen = false; this.isReceiptModalOpen = false; this.isProductModalOpen = false;
                        this.isCustomerModalOpen = false; this.isExpenseModalOpen = false; this.isCategoryModalOpen = false;
                        this.isCashierModalOpen = false; this.isNfcWriterOpen = false; this.isShortcutsModalOpen = false;
                    }
                }
            }
        },

        // ── CAMERA BARCODE SCANNER (Web API) ──
        async toggleBarcodeScanner() {
            if (this.barcodeScannerActive) { this.stopBarcodeScanner(); return; }
            if ('BarcodeDetector' in window) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640, height: 480 } });
                    this.barcodeScannerStream = stream;
                    this.barcodeScannerActive = true;

                    const video = document.createElement('video');
                    video.srcObject = stream;
                    video.setAttribute('playsinline', '');
                    video.setAttribute('autoplay', '');
                    video.style.cssText = 'width:100%;max-height:240px;border-radius:12px;background:#000;';

                    const container = document.getElementById('barcode-scanner-container');
                    if (container) { container.innerHTML = ''; container.appendChild(video); }

                    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'qr_code', 'data_matrix', 'pdf417'] });

                    this._barcodeVideo = video;
                    this._barcodeScanInterval = setInterval(async () => {
                        if (!this.barcodeScannerActive) { this.stopBarcodeScanner(); return; }
                        try {
                            const barcodes = await detector.detect(video);
                            if (barcodes.length > 0) {
                                const rawValue = barcodes[0].rawValue;
                                this.stopBarcodeScanner();
                                this.showNotification(`Barcode: ${rawValue}`, 'success');
                                this.addByBarcode(rawValue);
                            }
                        } catch (e) { /* detection frame error */ }
                    }, 500);
                    this.showNotification('Camera barcode scanner active. Point at a barcode.', 'success');
                } catch (err) {
                    console.warn('Camera/BarcodeDetector failed:', err);
                    this.showNotification('Camera access denied.', 'warning');
                    this.barcodeScannerActive = false;
                }
            } else {
                this.showNotification('BarcodeDetector not available. Use USB scanner.', 'info');
            }
        },

        stopBarcodeScanner() {
            this.barcodeScannerActive = false;
            if (this._barcodeScanInterval) { clearInterval(this._barcodeScanInterval); this._barcodeScanInterval = null; }
            if (this._barcodeVideo && this._barcodeVideo.parentNode) { this._barcodeVideo.parentNode.removeChild(this._barcodeVideo); this._barcodeVideo = null; }
            if (this.barcodeScannerStream) { this.barcodeScannerStream.getTracks().forEach(t => t.stop()); this.barcodeScannerStream = null; }
            const container = document.getElementById('barcode-scanner-container');
            if (container) container.innerHTML = '';
        },

        addByBarcode(barcode) {
            const product = this.products.find(p => p.barcode === barcode && p.status === 'active');
            if (product) {
                this.addToCart(product); this.showNotification(`Added ${product.name} via barcode.`, "success");
                const element = document.getElementById(`prod-card-${product.id}`);
                if (element) { element.classList.add('pulse-emerald'); setTimeout(() => element.classList.remove('pulse-emerald'), 1000); }
            } else { this.showNotification(`No product matches barcode: ${barcode}`, "warning"); }
        },

        printReceipt() { window.print(); },
        emailReceipt() { const email = prompt("Customer email:", this.selectedCustomer?.email || ''); if (email) this.showNotification(`Receipt emailed to ${email}!`, "success"); },

        // ── PRODUCT CRUD ──
        openAddProduct() {
            this.productModalMode = 'add';
            this.productForm = { id: null, name: '', sku: `SKU-${Date.now().toString().slice(-6)}`, barcode: '', category: this.categories[0]?.name || 'Beverages', costPrice: 0, retailPrice: 0, stock: 0, reorderPoint: 5, image: '', status: 'active', description: '' };
            this.isProductModalOpen = true;
        },
        openEditProduct(product) { this.productModalMode = 'edit'; this.productForm = { ...product }; this.isProductModalOpen = true; },

        async saveProduct() {
            try {
                const productData = { ...this.productForm };
                delete productData.id;
                if (!productData.image) productData.image = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60`;
                if (this.productModalMode === 'add') {
                    if (this.products.some(p => p.sku === productData.sku)) { this.showNotification("SKU already exists.", "error"); return; }
                    await db.products.add(productData);
                    this.showNotification(`Product "${productData.name}" created!`, "success");
                } else { await db.products.update(this.productForm.id, productData); this.showNotification("Product updated!", "success"); }
                this.isProductModalOpen = false;
                this.broadcastSync('DATA_CHANGED');
                await this.loadAllData();
            } catch (err) { console.error(err); this.showNotification("Product save failed.", "error"); }
        },

        async deleteProduct(id) { if (confirm("Delete this product permanently?")) { await db.products.delete(id); this.showNotification("Product deleted.", "success"); await this.loadAllData(); } },

        openAddCategory() { this.categoryForm = { name: '', description: '' }; this.isCategoryModalOpen = true; },

        async saveCategory() {
            if (!this.categoryForm.name.trim()) return;
            try {
                const name = this.categoryForm.name.trim();
                if (this.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) { this.showNotification("Category already exists.", "warning"); return; }
                await db.categories.add({ name, description: this.categoryForm.description });
                this.showNotification(`Category "${name}" added!`, "success");
                this.isCategoryModalOpen = false;
                await this.loadAllData();
            } catch (err) { console.error(err); }
        },

        openAddCashier() { this.cashierForm = { name: '', passcode: '', role: 'Cashier', email: '', nfcUid: '' }; this.isCashierModalOpen = true; },

        async saveCashier() {
            if (!this.cashierForm.name || !this.cashierForm.passcode) return;
            try { await db.cashiers.add({ ...this.cashierForm }); this.showNotification("Cashier created!", "success"); this.isCashierModalOpen = false; await this.loadAllData(); } catch (err) { console.error(err); }
        },

        async deleteCashier(id) { if (confirm("Delete this cashier?")) { await db.cashiers.delete(id); this.showNotification("Cashier deleted.", "success"); await this.loadAllData(); } },

        openAddCustomer() { this.customerModalMode = 'add'; this.customerForm = { id: null, name: '', phone: '', email: '', address: '', notes: '' }; this.isCustomerModalOpen = true; },
        openEditCustomer(cust) { this.customerModalMode = 'edit'; this.customerForm = { ...cust }; this.isCustomerModalOpen = true; },

        async saveCustomer() {
            try {
                const custData = { ...this.customerForm }; delete custData.id;
                if (this.customerModalMode === 'add') { custData.points = 0; custData.createdAt = new Date().toISOString(); await db.customers.add(custData); this.showNotification("Customer created!", "success"); }
                else { await db.customers.update(this.customerForm.id, custData); this.showNotification("Customer updated!", "success"); }
                this.isCustomerModalOpen = false; await this.loadAllData();
            } catch (err) { console.error(err); }
        },

        async deleteCustomer(id) { if (confirm("Delete this customer?")) { await db.customers.delete(id); this.showNotification("Customer deleted.", "success"); await this.loadAllData(); } },

        openAddExpense() { this.expenseModalMode = 'add'; this.expenseForm = { id: null, date: new Date().toISOString().split('T')[0], category: 'Rent', amount: 0, description: '', paymentMethod: 'Bank Transfer' }; this.isExpenseModalOpen = true; },
        openEditExpense(exp) { this.expenseModalMode = 'edit'; this.expenseForm = { ...exp }; this.isExpenseModalOpen = true; },

        async saveExpense() {
            try {
                const expData = { ...this.expenseForm }; delete expData.id; expData.amount = Number(expData.amount);
                if (this.expenseModalMode === 'add') { await db.expenses.add(expData); this.showNotification("Expense logged.", "success"); }
                else { await db.expenses.update(this.expenseForm.id, expData); this.showNotification("Expense updated.", "success"); }
                this.isExpenseModalOpen = false; await this.loadAllData();
            } catch (err) { console.error(err); }
        },

        async deleteExpense(id) { if (confirm("Delete this expense?")) { await db.expenses.delete(id); this.showNotification("Expense deleted.", "success"); await this.loadAllData(); } },

        openReceipt(sale) { this.currentReceiptSale = sale; this.isReceiptModalOpen = true; },

        async refundSale(sale) {
            if (sale.status === 'refunded') return;
            if (confirm(`Refund invoice ${sale.invoiceNumber}?`)) {
                try {
                    await db.sales.update(sale.id, { status: 'refunded' });
                    for (const item of sale.items) { const prod = this.products.find(p => p.id === item.productId); if (prod) await db.products.update(prod.id, { stock: prod.stock + item.qty }); }
                    if (sale.customerId && sale.customerName !== "Walk-in Customer") {
                        const cust = this.customers.find(c => c.id === sale.customerId);
                        if (cust) await db.customers.update(cust.id, { points: Math.max(0, (cust.points || 0) - Math.floor(sale.total)) });
                    }
                    this.showNotification(`Invoice ${sale.invoiceNumber} refunded.`, "success");
                    await this.loadAllData();
                } catch (err) { console.error(err); }
            }
        },

        // ── SETTINGS ──
        async saveSettings() {
            try {
                for (const [key, value] of Object.entries(this.settings)) { await db.settings.put({ key, value }); }
                this.showNotification("Settings saved!", "success");
                this.broadcastSync('SETTINGS_CHANGED');
                await this.loadAllData();
            } catch (err) { console.error(err); }
        },

        async exportDatabase() {
            try {
                const data = { products: await db.products.toArray(), categories: await db.categories.toArray(), sales: await db.sales.toArray(), customers: await db.customers.toArray(), expenses: await db.expenses.toArray(), cashiers: await db.cashiers.toArray(), settings: await db.settings.toArray() };
                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = `ApexPOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                this.showNotification("Backup downloaded!", "success");
            } catch (err) { console.error(err); }
        },

        triggerImportDatabase() { document.getElementById('import-file-input')?.click(); },

        async importDatabase(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!parsed.products || !parsed.sales) { this.showNotification("Invalid backup file.", "error"); return; }
                    if (confirm("This will overwrite all local data. Continue?")) {
                        await db.products.clear(); await db.categories.clear(); await db.sales.clear(); await db.customers.clear(); await db.expenses.clear(); await db.cashiers.clear(); await db.settings.clear();
                        if (parsed.products.length) await db.products.bulkAdd(parsed.products);
                        if (parsed.categories.length) await db.categories.bulkAdd(parsed.categories);
                        if (parsed.sales.length) await db.sales.bulkAdd(parsed.sales);
                        if (parsed.customers.length) await db.customers.bulkAdd(parsed.customers);
                        if (parsed.expenses.length) await db.expenses.bulkAdd(parsed.expenses);
                        if (parsed.cashiers?.length) await db.cashiers.bulkAdd(parsed.cashiers);
                        if (parsed.settings.length) await db.settings.bulkAdd(parsed.settings);
                        this.showNotification("Backup restored!", "success");
                        await this.loadAllData();
                    }
                } catch (err) { console.error(err); this.showNotification("Backup restore failed.", "error"); }
            };
            reader.readAsText(file);
        },

        async loadDemoPreset() { if (confirm("Reset all data and reload demo data?")) { await resetAllData(); this.showNotification("Demo data loaded!", "success"); await this.loadAllData(); } },

        // ── RECEIPT LOGO UPLOAD ──
        triggerReceiptLogoUpload() { document.getElementById('receipt-logo-input')?.click(); },

        async handleReceiptLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { this.showNotification("Please select an image file.", "error"); return; }
            if (file.size > 512 * 1024) { this.showNotification("Image too large. Max 512KB.", "error"); return; }
            const reader = new FileReader();
            reader.onload = async (e) => {
                this.settings.receiptLogo = e.target.result;
                await db.settings.put({ key: 'receiptLogo', value: e.target.result });
                this.showNotification("Receipt logo uploaded!", "success");
            };
            reader.readAsDataURL(file);
        },

        removeReceiptLogo() {
            this.settings.receiptLogo = '';
            db.settings.put({ key: 'receiptLogo', value: '' });
            this.showNotification("Receipt logo removed.", "success");
        },

        // ── SALES CSV EXPORT ──
        exportSalesCSV() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Invoice No,Date,Customer,Cashier,Subtotal,Discount,Tax,Total,Profit,Payment Method,Status,Notes\n";
            this.sales.forEach(s => {
                csvContent += [
                    `"${s.invoiceNumber}"`,
                    `"${s.date}"`,
                    `"${(s.customerName || '').replace(/"/g, '""')}"`,
                    `"${(s.cashierName || '').replace(/"/g, '""')}"`,
                    s.subtotal || 0, s.discount || 0, s.tax || 0, s.total, s.profit || 0,
                    `"${s.paymentMethod || ''}"`,
                    s.status,
                    `"${(s.notes || '').replace(/"/g, '""')}"`
                ].join(",") + "\n";
            });

            const link = document.createElement("a");
            link.setAttribute("href", encodeURI(csvContent));
            link.setAttribute("download", `ApexPOS_Sales_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            this.showNotification("Sales exported as CSV!", "success");
        },

        // ── CHARTS ──
        getFilteredSalesForReports() {
            const now = new Date();
            let startLimit = new Date();
            if (this.reportRange === '7days') startLimit.setDate(now.getDate() - 7);
            else if (this.reportRange === '30days') startLimit.setDate(now.getDate() - 30);
            else if (this.reportRange === 'thisMonth') startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
            else if (this.reportRange === 'custom' && this.customStartDate) startLimit = new Date(this.customStartDate);
            return this.sales.filter(sale => {
                const saleDate = new Date(sale.date);
                if (this.reportRange === 'custom') { const endLimit = this.customEndDate ? new Date(this.customEndDate) : new Date(); endLimit.setHours(23, 59, 59, 999); return saleDate >= startLimit && saleDate <= endLimit; }
                return saleDate >= startLimit;
            });
        },

        getFilteredExpensesForReports() {
            const now = new Date();
            let startLimit = new Date();
            if (this.reportRange === '7days') startLimit.setDate(now.getDate() - 7);
            else if (this.reportRange === '30days') startLimit.setDate(now.getDate() - 30);
            else if (this.reportRange === 'thisMonth') startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
            else if (this.reportRange === 'custom' && this.customStartDate) startLimit = new Date(this.customStartDate);
            return this.expenses.filter(exp => {
                const expDate = new Date(exp.date);
                if (this.reportRange === 'custom') { const endLimit = this.customEndDate ? new Date(this.customEndDate) : new Date(); endLimit.setHours(23, 59, 59, 999); return expDate >= startLimit && expDate <= endLimit; }
                return expDate >= startLimit;
            });
        },

        renderCharts() {
            if (this.salesChartInstance) this.salesChartInstance.destroy();
            if (this.categoryChartInstance) this.categoryChartInstance.destroy();
            const salesFiltered = this.getFilteredSalesForReports();
            const daysMap = {};
            for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); daysMap[d.toISOString().split('T')[0]] = { revenue: 0, profit: 0 }; }
            salesFiltered.forEach(sale => { if (sale.status === 'completed') { const key = sale.date.split('T')[0]; if (!daysMap[key]) daysMap[key] = { revenue: 0, profit: 0 }; daysMap[key].revenue += sale.total; daysMap[key].profit += sale.profit; } });
            const sortedDates = Object.keys(daysMap).sort();
            const revData = [], profitData = [], labels = sortedDates.map(d => { const p = d.split('-'); return `${p[2]}/${p[1]}`; });
            sortedDates.forEach(d => { revData.push(parseFloat(daysMap[d].revenue.toFixed(2))); profitData.push(parseFloat(daysMap[d].profit.toFixed(2))); });

            const sCtx = document.getElementById('salesLineChart')?.getContext('2d');
            if (sCtx) {
                this.salesChartInstance = new Chart(sCtx, { type: 'line', data: { labels, datasets: [{ label: `Revenue (${this.settings.currency})`, data: revData, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true, borderWidth: 3 }, { label: `Net Profit (${this.settings.currency})`, data: profitData, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.3, fill: true, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } } });
            }

            const catShares = {};
            salesFiltered.forEach(sale => { if (sale.status === 'completed') { sale.items.forEach(item => { const prod = this.products.find(p => p.id === item.productId); const cat = prod ? prod.category : 'General'; catShares[cat] = (catShares[cat] || 0) + item.total; }); } });
            const cCtx = document.getElementById('categoryDoughnutChart')?.getContext('2d');
            if (cCtx && Object.keys(catShares).length > 0) {
                this.categoryChartInstance = new Chart(cCtx, { type: 'doughnut', data: { labels: Object.keys(catShares), datasets: [{ data: Object.values(catShares).map(v => parseFloat(v.toFixed(2))), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#ec4899','#8b5cf6','#f97316','#64748b'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
            }
        },

        formatCurrency(val) { const num = Number(val); return isNaN(num) ? `${this.settings.currency}0.00` : `${this.settings.currency}${num.toFixed(2)}`; },

        formatDateTime(isoStr) {
            if (!isoStr) return '';
            try { const d = new Date(isoStr); return d.toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return isoStr; }
        },

        exportProductsCSV() {
            let csv = "data:text/csv;charset=utf-8,Name,SKU,Barcode,Category,Cost Price,Retail Price,Stock,Reorder Point,Status,Description\n";
            this.products.forEach(p => { csv += [`"${(p.name||'').replace(/"/g,'""')}"`,`"${p.sku}"`,`"${p.barcode||''}"`,`"${p.category}"`,p.costPrice,p.retailPrice,p.stock,p.reorderPoint,p.status,`"${(p.description||'').replace(/"/g,'""')}"`].join(",")+"\n"; });
            const link = document.createElement("a"); link.setAttribute("href", encodeURI(csv)); link.setAttribute("download", `ApexPOS_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
            this.showNotification("Inventory exported!", "success");
        },

        triggerCSVImport() { document.getElementById('csv-file-input')?.click(); },

        async importProductsCSV(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split("\n");
                    let imported = 0;
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim(); if (!line) continue;
                        const matches = line.match(/(\".*?\"|[^\",\\s]+)(?=\\s*,|\\s*$)/g) || line.split(",");
                        if (matches.length < 7) continue;
                        const clean = (str) => (str||'').replace(/^"|"$/g,'').trim();
                        const name = clean(matches[0]), sku = clean(matches[1]);
                        if (!name || !sku) continue;
                        const category = clean(matches[3]);
                        if (category && !this.categories.some(c=>c.name.toLowerCase()===category.toLowerCase())) { await db.categories.add({ name: category, description: 'Imported' }); }
                        const existing = this.products.find(p => p.sku === sku);
                        const data = { name, sku, barcode: clean(matches[2]), category: category||'General', costPrice: parseFloat(clean(matches[4]))||0, retailPrice: parseFloat(clean(matches[5]))||0, stock: parseInt(clean(matches[6]))||0, reorderPoint: parseInt(clean(matches[7]))||5, status: clean(matches[8])||'active', description: clean(matches[9])||'', image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60` };
                        if (existing) { await db.products.update(existing.id, data); } else { await db.products.add(data); }
                        imported++;
                    }
                    this.showNotification(`Imported ${imported} products!`, "success");
                    await this.loadAllData();
                } catch (err) { console.error(err); this.showNotification("CSV import failed.", "error"); }
            };
            reader.readAsText(file);
        }
    },

    watch: {
        reportRange() { if (this.currentView === 'dashboard') this.renderCharts(); },
        customStartDate() { if (this.reportRange === 'custom' && this.currentView === 'dashboard') this.renderCharts(); },
        customEndDate() { if (this.reportRange === 'custom' && this.currentView === 'dashboard') this.renderCharts(); },
        darkMode(newVal) { document.documentElement.classList.toggle('dark', newVal); try { localStorage.setItem('pos_dark_mode', newVal); } catch {} }
    },

    mounted() {
        try { this.darkMode = localStorage.getItem('pos_dark_mode') === 'true'; if (this.darkMode) document.documentElement.classList.add('dark'); } catch {}
        this._syncId = 'apex-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        this.loadAllData();
        window.addEventListener('keydown', this.handleGlobalKeypress);
        this.isOnline = navigator.onLine;
        window.addEventListener('online', () => { this.isOnline = true; });
        window.addEventListener('offline', () => { this.isOnline = false; this.showNotification("You are offline — Apex POS still works!", "info"); });
        this.nfcSupported = 'NDEFReader' in window;
        this.initSyncChannel();
    },

    beforeUnmount() { window.removeEventListener('keydown', this.handleGlobalKeypress); }
}).mount('#app');
