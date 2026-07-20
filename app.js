const { createApp, ref, reactive, onMounted, computed, watch, nextTick } = Vue;

createApp({
    data() {
        return {
            // View navigation
            currentView: 'dashboard', // dashboard, register, sales, inventory, customers, expenses, settings, employee
            sidebarOpen: false,
            darkMode: false,

            // Global settings from database
            settings: {
                storeName: "Apex Corner Shop",
                storeAddress: "101 Colmore Row, Birmingham, B3 3AG",
                storePhone: "+44 121 555 0199",
                storeEmail: "contact@apexshop.co.uk",
                currency: "£",
                taxRate: 20, // 20% VAT standard
                receiptHeader: "THANK YOU FOR YOUR BUSINESS!",
                receiptFooter: "Please keep this receipt. Refunds within 14 days.",
                lowStockAlert: 10,
                googleClientId: "" // Configurable client ID
            },

            // Live database arrays
            products: [],
            categories: [],
            sales: [],
            customers: [],
            expenses: [],
            cashiers: [],

            // Cashier Sessions (Automatically logged in by LocalStorage/Cookies or Google login)
            activeCashier: {
                name: "Admin Manager",
                role: "Manager",
                email: "manager@apexpos.com",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80"
            },

            // Filter lists
            selectedCategory: 'All',
            searchQuery: '',

            // Register/Cart state (Restored from Session/LocalStorage)
            cart: [],
            cartDiscount: 0,
            cartDiscountType: 'fixed',
            selectedCustomer: null,
            heldCarts: [], // suspended orders

            // Checkout / Calculator State
            paymentMethod: 'Cash',
            paidAmount: null,
            checkoutNotes: '',
            isCheckoutModalOpen: false,

            // NFC Phone Scanning Engine
            nfcSupported: false,
            nfcScanning: false,
            nfcWriteData: '', // Payload queue to write onto empty tags
            isNfcWriterOpen: false,
            nfcWriteTargetType: 'customer', // customer, product, employee
            nfcWriteTargetId: '',

            // Active / Completed sale for receipt modal
            currentReceiptSale: null,
            isReceiptModalOpen: false,

            // Form states for modals / editing
            productModalMode: 'add',
            isProductModalOpen: false,
            productForm: {
                id: null,
                name: '',
                sku: '',
                barcode: '',
                category: '',
                costPrice: 0,
                retailPrice: 0,
                stock: 0,
                reorderPoint: 5,
                image: '',
                status: 'active',
                description: ''
            },

            customerModalMode: 'add',
            isCustomerModalOpen: false,
            customerForm: {
                id: null,
                name: '',
                phone: '',
                email: '',
                address: '',
                notes: ''
            },

            expenseModalMode: 'add',
            isExpenseModalOpen: false,
            expenseForm: {
                id: null,
                date: new Date().toISOString().split('T')[0],
                category: 'Rent',
                amount: 0,
                description: '',
                paymentMethod: 'Bank Transfer'
            },

            isCategoryModalOpen: false,
            categoryForm: {
                name: '',
                description: ''
            },

            // Cashier Modal Form
            isCashierModalOpen: false,
            cashierForm: {
                name: '',
                passcode: '',
                role: 'Cashier',
                email: '',
                nfcUid: ''
            },

            // Barcode inputs
            barcodeBuffer: '',
            lastBarcodeKeyTime: 0,

            // Date Filters
            reportRange: '7days',
            customStartDate: '',
            customEndDate: '',

            // Chart JS Instances
            salesChartInstance: null,
            categoryChartInstance: null,

            // Toast Alerts
            notification: {
                show: false,
                message: '',
                type: 'success'
            }
        };
    },

    computed: {
        // Filtered register products
        filteredProducts() {
            return this.products.filter(p => {
                const matchesCategory = this.selectedCategory === 'All' || p.category === this.selectedCategory;
                const matchesSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                                      p.sku.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                                      p.barcode.includes(this.searchQuery);
                const isActive = p.status === 'active';
                return matchesCategory && matchesSearch && isActive;
            });
        },

        // Cart calculations
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

        // Metrics engine
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
            setTimeout(() => { this.notification.show = false; }, 3000);
        },

        // --- SESSION PERSISTENCE (Cookies & LocalStorage) ---
        saveCartToStorage() {
            // Save active cart, selected customer, and discount to allow simple refresh-resiliency
            const state = {
                cart: this.cart,
                cartDiscount: this.cartDiscount,
                cartDiscountType: this.cartDiscountType,
                selectedCustomer: this.selectedCustomer
            };
            localStorage.setItem('apex_pos_cart_state', JSON.stringify(state));
            
            // Set cookie for fallback
            document.cookie = `apex_cart_active=true; max-age=86400; path=/; SameSite=Lax; Secure`;
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
                } catch (e) {
                    console.error("Cart state load error", e);
                }
            }
        },

        saveCashierSession(cashier) {
            // Never persist secrets: strip passcode / NFC uid before storing the session
            const { passcode, nfcUid, ...safeCashier } = cashier;
            this.activeCashier = safeCashier;
            localStorage.setItem('apex_pos_cashier', JSON.stringify(safeCashier));
            document.cookie = `apex_cashier_name=${encodeURIComponent(safeCashier.name)}; max-age=2592000; path=/; SameSite=Lax; Secure`;
        },

        restoreCashierSession() {
            const cashierStr = localStorage.getItem('apex_pos_cashier');
            if (cashierStr) {
                try {
                    this.activeCashier = JSON.parse(cashierStr);
                } catch(e) {
                    console.error("Cashier session error", e);
                }
            }
        },

        // --- GOOGLE SIGN-IN AUTOMATION ---
        initGoogleIdentity() {
            // SSO is opt-in: no Client ID configured => stay fully local, load nothing.
            const clientID = (this.settings.googleClientId || "").trim();
            if (!clientID) return;

            const startGsi = () => {
                if (typeof google === 'undefined' || !google.accounts) return;
                try {
                    google.accounts.id.initialize({
                        client_id: clientID,
                        callback: this.handleGoogleCredentialResponse,
                        auto_select: true // Auto log-in on page reload if they've authorized before!
                    });
                    const btn = document.getElementById("google-signin-button");
                    if (btn) google.accounts.id.renderButton(btn, { theme: "outline", size: "medium", shape: "pill" });
                } catch (err) {
                    console.error("Google SSO load failed: ", err);
                }
            };

            if (typeof google !== 'undefined' && google.accounts) { startGsi(); return; }

            // Lazy-load the GSI script only when SSO is actually configured
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = startGsi;
            script.onerror = () => console.warn("Google Identity Services failed to load — continuing without SSO.");
            document.head.appendChild(script);
        },

        handleGoogleCredentialResponse(response) {
            try {
                // Decode JWT client-side safely
                const profile = this.decodeJwt(response.credential);
                if (profile) {
                    const cashier = {
                        name: profile.name,
                        role: "Google User",
                        email: profile.email,
                        avatar: profile.picture || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80"
                    };
                    this.saveCashierSession(cashier);
                    this.showNotification(`Automatically logged in as ${cashier.name}!`, "success");
                    this.changeView('dashboard');
                }
            } catch (err) {
                console.error("JWT Decode error", err);
                this.showNotification("Google Authenticated profile parse failed.", "error");
            }
        },

        decodeJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(jsonPayload);
            } catch (e) {
                return null;
            }
        },

        logoutCashier() {
            const defaultCashier = {
                name: "Admin Manager",
                role: "Manager",
                email: "manager@apexpos.com",
                avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=80"
            };
            this.saveCashierSession(defaultCashier);
            this.showNotification("Logged out cashier session.", "success");
        },

        // --- WEB NFC API ENGINE & SIMULATOR ---
        async toggleNfcScanning() {
            if (!('NDEFReader' in window)) {
                this.showNotification("Web NFC API is not supported on this device/browser. Desktop testing will use the simulator instead.", "warning");
                return;
            }

            try {
                if (this.nfcScanning) {
                    this.nfcScanning = false;
                    this.showNotification("NFC Phone reader disabled.", "info");
                    return;
                }

                const ndef = new NDEFReader();
                await ndef.scan();
                this.nfcScanning = true;
                this.showNotification("NFC Phone Listener active! Tap NFC cards/tags.", "success");

                ndef.addEventListener("reading", ({ message, serialNumber }) => {
                    for (const record of message.records) {
                        const decoder = new TextDecoder(record.encoding);
                        const rawPayload = decoder.decode(record.data);
                        this.processNfcTag(rawPayload);
                    }
                });

                ndef.addEventListener("readingerror", () => {
                    this.showNotification("NFC Reading Error. Hold tag close to phone NFC antenna.", "error");
                });

            } catch (error) {
                console.error("NFC setup error:", error);
                this.showNotification("NFC permission denied or unavailable.", "error");
            }
        },

        // Process tag payload
        processNfcTag(payload) {
            const tag = payload.trim();
            
            // 1. Employee Tag (e.g. employee:Emma Watson)
            if (tag.startsWith("employee:")) {
                const parts = tag.split(":");
                const lookupVal = parts[1];
                this.dbLoginByNfc(lookupVal);
            }
            // 2. Customer Tag (e.g. customer:John Doe)
            else if (tag.startsWith("customer:")) {
                const parts = tag.split(":");
                const name = parts[1];
                const cust = this.customers.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (cust) {
                    this.selectedCustomer = cust;
                    this.saveCartToStorage();
                    this.showNotification(`Loyalty profile loaded: ${cust.name}`, "success");
                } else {
                    this.showNotification(`NFC customer card doesn't exist: ${name}`, "warning");
                }
            }
            // 3. Product Tag (e.g. product:SKU-001)
            else if (tag.startsWith("product:")) {
                const parts = tag.split(":");
                const sku = parts[1];
                const prod = this.products.find(p => p.sku === sku && p.status === 'active');
                if (prod) {
                    this.addToCart(prod);
                    this.showNotification(`Added ${prod.name} via NFC tap!`, "success");
                } else {
                    this.showNotification(`NFC SKU code not found: ${sku}`, "warning");
                }
            }
            else {
                // Raw fallback - check if matches SKU, Barcode, or Customer phone directly
                const prod = this.products.find(p => p.sku === tag || p.barcode === tag);
                if (prod) {
                    this.addToCart(prod);
                    this.showNotification(`Added ${prod.name} via raw NFC payload!`, "success");
                    return;
                }
                const cust = this.customers.find(c => c.phone === tag || c.name === tag);
                if (cust) {
                    this.selectedCustomer = cust;
                    this.showNotification(`Loyalty profile: ${cust.name}`, "success");
                    return;
                }
                this.showNotification(`Unknown NFC Tag Payload: ${tag}`, "info");
            }
        },

        async dbLoginByNfc(passcodeOrName) {
            const matched = this.cashiers.find(c => c.passcode === passcodeOrName || c.name.toLowerCase() === passcodeOrName.toLowerCase() || c.nfcUid === `employee:${passcodeOrName}`);
            if (matched) {
                const cashier = {
                    name: matched.name,
                    role: matched.role,
                    email: matched.email,
                    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80"
                };
                this.saveCashierSession(cashier);
                this.showNotification(`NFC Login: Welcome, ${cashier.name}!`, "success");
                this.changeView('dashboard');
            } else {
                this.showNotification("NFC Badge did not match registered employee credentials.", "error");
            }
        },

        // --- NFC WRITE UTILITY (Writes real data to tags on phone) ---
        openNfcWriter(type, item) {
            this.nfcWriteTargetType = type;
            if (type === 'customer') {
                this.nfcWriteData = `customer:${item.name}`;
                this.nfcWriteTargetId = item.id;
            } else if (type === 'product') {
                this.nfcWriteData = `product:${item.sku}`;
                this.nfcWriteTargetId = item.id;
            } else if (type === 'employee') {
                this.nfcWriteData = `employee:${item.passcode || item.name}`;
                this.nfcWriteTargetId = item.id;
            }
            this.isNfcWriterOpen = true;
        },

        async executeNfcWrite() {
            if (!('NDEFReader' in window)) {
                this.showNotification("NFC Writing requires Chrome on Android with active NFC hardware.", "error");
                return;
            }

            try {
                this.showNotification("Hold empty NFC card/sticker near phone to write payload...", "info");
                const ndef = new NDEFReader();
                await ndef.write(this.nfcWriteData);
                this.showNotification("NFC Card programmed successfully!", "success");
                this.isNfcWriterOpen = false;

                // Sync badge uid with database
                if (this.nfcWriteTargetType === 'employee') {
                    await db.cashiers.update(this.nfcWriteTargetId, { nfcUid: this.nfcWriteData });
                }
                await this.loadAllData();
            } catch (error) {
                console.error(error);
                this.showNotification("NFC Programming failed. Try again.", "error");
            }
        },

        // Desktop Simulator Tap (Fully Working Automation Testing)
        simulateNfcTap(simulatedPayload) {
            this.showNotification(`[NFC Simulator] Scanning tag record: "${simulatedPayload}"`, "info");
            setTimeout(() => {
                this.processNfcTag(simulatedPayload);
            }, 500);
        },

        // --- CASH DRAWER TENDER KEYPAD MECHANICS ---
        addTenderDigit(digit) {
            const current = this.paidAmount === null ? '' : String(this.paidAmount);
            if (digit === '.') {
                if (current.includes('.')) return; // prevent multiple decimals
                this.paidAmount = current === '' ? '0.' : current + '.';
            } else {
                this.paidAmount = parseFloat(current + digit);
            }
        },

        clearTender() {
            this.paidAmount = '';
        },

        backspaceTender() {
            const current = String(this.paidAmount);
            if (current.length <= 1) {
                this.paidAmount = '';
            } else {
                this.paidAmount = parseFloat(current.slice(0, -1)) || '';
            }
        },

        setQuickTender(amount) {
            if (amount === 'exact') {
                this.paidAmount = this.cartTotal;
            } else {
                this.paidAmount = amount;
            }
        },

        // --- BASE DATABASE WORKLOADS ---
        async loadAllData() {
            try {
                await seedDemoData();

                const settingsMap = await getSettingsMap();
                if (settingsMap.storeName) {
                    this.settings = { ...this.settings, ...settingsMap };
                }

                this.products = await db.products.toArray();
                this.categories = await db.categories.toArray();
                this.customers = await db.customers.toArray();
                this.expenses = await db.expenses.toArray();
                this.cashiers = await db.cashiers.toArray();
                
                this.sales = await db.sales.orderBy('date').reverse().toArray();

                // Load cookie sessions
                this.restoreCashierSession();
                this.restoreCartFromStorage();

                if (this.customers.length > 0 && !this.selectedCustomer) {
                    this.selectedCustomer = this.customers.find(c => c.name === "Walk-in Customer") || this.customers[0];
                }

                // Check Google login initialization once settings are loaded
                this.initGoogleIdentity();

                if (this.currentView === 'dashboard') {
                    this.renderCharts();
                }
            } catch (err) {
                console.error("Master Sync DB failed", err);
                this.showNotification("IndexedDB Sync failure. Please reboot page.", "error");
            }
        },

        changeView(view) {
            this.currentView = view;
            this.sidebarOpen = false;
            if (view === 'dashboard') {
                nextTick(() => {
                    this.renderCharts();
                });
            }
        },

        // --- REGISTER CART WORKFLOWS ---
        addToCart(product) {
            if (product.stock <= 0) {
                this.showNotification(`Stock depleted for ${product.name}!`, "warning");
            }
            const existing = this.cart.find(item => item.id === product.id);
            if (existing) {
                if (existing.qty >= product.stock) {
                    this.showNotification(`Order quantity exceeds stock capacity (${product.stock}).`, "warning");
                }
                existing.qty++;
            } else {
                this.cart.push({
                    id: product.id,
                    name: product.name,
                    sku: product.sku,
                    costPrice: product.costPrice,
                    retailPrice: product.retailPrice,
                    qty: 1
                });
            }
            this.saveCartToStorage();
        },

        updateCartQty(item, amount) {
            const product = this.products.find(p => p.id === item.id);
            const newQty = item.qty + amount;
            
            if (newQty <= 0) {
                this.removeFromCart(item);
                return;
            }

            if (product && newQty > product.stock) {
                this.showNotification(`Stock limits exceeded. Only ${product.stock} available.`, "warning");
            }

            item.qty = newQty;
            this.saveCartToStorage();
        },

        removeFromCart(item) {
            const idx = this.cart.indexOf(item);
            if (idx > -1) {
                this.cart.splice(idx, 1);
            }
            this.saveCartToStorage();
        },

        clearCart() {
            this.cart = [];
            this.cartDiscount = 0;
            this.paidAmount = null;
            this.checkoutNotes = '';
            const walkIn = this.customers.find(c => c.name === "Walk-in Customer");
            if (walkIn) this.selectedCustomer = walkIn;
            this.saveCartToStorage();
        },

        suspendCart() {
            if (this.cart.length === 0) return;
            const heldCart = {
                id: Date.now(),
                date: new Date().toISOString(),
                customer: this.selectedCustomer ? { ...this.selectedCustomer } : null,
                items: [...this.cart],
                discount: this.cartDiscount,
                discountType: this.cartDiscountType
            };
            this.heldCarts.push(heldCart);
            this.clearCart();
            this.showNotification("Cart successfully held in drafts.", "success");
        },

        resumeCart(heldCart) {
            this.cart = heldCart.items;
            this.cartDiscount = heldCart.discount;
            this.cartDiscountType = heldCart.discountType;
            if (heldCart.customer) {
                this.selectedCustomer = this.customers.find(c => c.id === heldCart.customer.id) || heldCart.customer;
            }
            this.heldCarts = this.heldCarts.filter(c => c.id !== heldCart.id);
            this.saveCartToStorage();
            this.showNotification("Restored draft cart.", "success");
        },

        deleteHeldCart(heldCart) {
            this.heldCarts = this.heldCarts.filter(c => c.id !== heldCart.id);
            this.showNotification("Held cart cleared.", "success");
        },

        triggerCartDiscount() {
            const input = prompt(`Enter Discount value (Symbol: ${this.cartDiscountType === 'percent' ? '%' : this.settings.currency}):`, this.cartDiscount);
            if (input === null) return;
            const val = parseFloat(input);
            this.cartDiscount = isNaN(val) || val < 0 ? 0 : val;
            this.saveCartToStorage();
        },

        toggleDiscountType() {
            this.cartDiscountType = this.cartDiscountType === 'fixed' ? 'percent' : 'fixed';
            this.saveCartToStorage();
        },

        openCheckout() {
            if (this.cart.length === 0) {
                this.showNotification("Shopping cart is empty.", "warning");
                return;
            }
            this.paidAmount = this.cartTotal; // exact total tender suggestions
            this.isCheckoutModalOpen = true;
        },

        setPaymentMethod(method) {
            this.paymentMethod = method;
            if (method !== 'Cash') {
                this.paidAmount = this.cartTotal;
            }
        },

        async submitCheckout() {
            if (this.paidAmount < this.cartTotal && this.paymentMethod === 'Cash') {
                this.showNotification("Incomplete payment. Cash tendered is less than total.", "error");
                return;
            }

            try {
                const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
                const saleDate = new Date().toISOString();

                let totalCost = 0;
                const saleItems = this.cart.map(item => {
                    const cost = item.costPrice * item.qty;
                    totalCost += cost;
                    return {
                        productId: item.id,
                        name: item.name,
                        sku: item.sku,
                        price: item.retailPrice,
                        qty: item.qty,
                        cost: item.costPrice,
                        total: item.retailPrice * item.qty
                    };
                });

                // Deduct stocks
                for (const item of this.cart) {
                    const prod = this.products.find(p => p.id === item.id);
                    if (prod) {
                        const newStock = Math.max(0, prod.stock - item.qty);
                        await db.products.update(prod.id, { stock: newStock });
                    }
                }

                // Profit calculation
                const revenue = this.cartTotal;
                const profit = parseFloat((revenue - totalCost).toFixed(2));

                const saleRecord = {
                    invoiceNumber,
                    date: saleDate,
                    items: saleItems,
                    discount: this.cartDiscountAmount,
                    tax: this.cartTaxAmount,
                    subtotal: this.cartSubtotal,
                    total: revenue,
                    profit,
                    paidAmount: Number(this.paidAmount),
                    changeAmount: this.cartChangeAmount,
                    paymentMethod: this.paymentMethod,
                    status: 'completed',
                    customerId: this.selectedCustomer ? this.selectedCustomer.id : null,
                    customerName: this.selectedCustomer ? this.selectedCustomer.name : 'Walk-in Customer',
                    notes: this.checkoutNotes,
                    cashierName: this.activeCashier ? this.activeCashier.name : 'System Terminal'
                };

                const saleId = await db.sales.add(saleRecord);
                saleRecord.id = saleId;

                // Loyalty points credit
                if (this.selectedCustomer && this.selectedCustomer.id && this.selectedCustomer.name !== "Walk-in Customer") {
                    const gainedPoints = Math.floor(revenue);
                    const newPoints = (this.selectedCustomer.points || 0) + gainedPoints;
                    await db.customers.update(this.selectedCustomer.id, { points: newPoints });
                }

                this.isCheckoutModalOpen = false;
                this.showNotification("Sale transaction completed!", "success");

                // Preview thermal receipt
                this.currentReceiptSale = saleRecord;
                this.isReceiptModalOpen = true;

                this.clearCart();
                await this.loadAllData();
            } catch (err) {
                console.error("Sale write error:", err);
                this.showNotification("DB Write failed on checkout.", "error");
            }
        },

        // --- KEYBOARD BARCODE SCANNER HANDLER ---
        handleGlobalKeypress(e) {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
            const currentTime = Date.now();
            const timeDiff = currentTime - this.lastBarcodeKeyTime;
            this.lastBarcodeKeyTime = currentTime;

            if (timeDiff < 50) {
                if (e.key === 'Enter') {
                    const matchedBarcode = this.barcodeBuffer.trim();
                    this.barcodeBuffer = '';
                    if (matchedBarcode.length > 2) {
                        this.addByBarcode(matchedBarcode);
                    }
                } else {
                    if (e.key !== 'Shift') {
                        this.barcodeBuffer += e.key;
                    }
                }
            } else {
                this.barcodeBuffer = e.key !== 'Shift' ? e.key : '';
                if (!isInput) {
                    if (e.key === 'r' || e.key === 'R') this.changeView('register');
                    if (e.key === 'd' || e.key === 'D') this.changeView('dashboard');
                    if (e.key === 'i' || e.key === 'I') this.changeView('inventory');
                    if (e.key === 's' || e.key === 'S') this.changeView('sales');
                    if (e.key === 'c' || e.key === 'C') this.openCheckout();
                }
            }
        },

        addByBarcode(barcode) {
            const product = this.products.find(p => p.barcode === barcode && p.status === 'active');
            if (product) {
                this.addToCart(product);
                this.showNotification(`Added ${product.name} via barcode search.`, "success");
                const element = document.getElementById(`prod-card-${product.id}`);
                if (element) {
                    element.classList.add('pulse-emerald');
                    setTimeout(() => element.classList.remove('pulse-emerald'), 1000);
                }
            } else {
                this.showNotification(`No active product matches barcode: ${barcode}`, "warning");
            }
        },

        printReceipt() { window.print(); },
        emailReceipt() {
            const email = prompt("Enter customer email address:", this.selectedCustomer?.email || '');
            if (email) { this.showNotification(`Mock thermal receipt emailed to ${email}!`, "success"); }
        },

        // --- PRODUCT CONFIG CRUD ---
        openAddProduct() {
            this.productModalMode = 'add';
            this.productForm = {
                id: null,
                name: '',
                sku: `SKU-${Date.now().toString().slice(-6)}`,
                barcode: '',
                category: this.categories[0]?.name || 'Beverages',
                costPrice: 0,
                retailPrice: 0,
                stock: 0,
                reorderPoint: 5,
                image: '',
                status: 'active',
                description: ''
            };
            this.isProductModalOpen = true;
        },

        openEditProduct(product) {
            this.productModalMode = 'edit';
            this.productForm = { ...product };
            this.isProductModalOpen = true;
        },

        async saveProduct() {
            try {
                const productData = { ...this.productForm };
                delete productData.id;
                
                if (!productData.image) {
                    productData.image = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60`;
                }

                if (this.productModalMode === 'add') {
                    const existingSku = this.products.find(p => p.sku === productData.sku);
                    if (existingSku) {
                        this.showNotification("SKU already exists.", "error");
                        return;
                    }
                    await db.products.add(productData);
                    this.showNotification(`Product ${productData.name} registered!`, "success");
                } else {
                    await db.products.update(this.productForm.id, productData);
                    this.showNotification(`Product updated successfully!`, "success");
                }
                this.isProductModalOpen = false;
                await this.loadAllData();
            } catch (err) {
                console.error(err);
                this.showNotification("Inventory listing database failure.", "error");
            }
        },

        async deleteProduct(id) {
            if (confirm("Permanently erase product configurations?")) {
                await db.products.delete(id);
                this.showNotification("Item listing removed.", "success");
                await this.loadAllData();
            }
        },

        openAddCategory() {
            this.categoryForm = { name: '', description: '' };
            this.isCategoryModalOpen = true;
        },

        async saveCategory() {
            if (!this.categoryForm.name.trim()) return;
            try {
                const name = this.categoryForm.name.trim();
                if (this.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    this.showNotification("Category label duplicate.", "warning");
                    return;
                }
                await db.categories.add({ name, description: this.categoryForm.description });
                this.showNotification(`Category "${name}" added!`, "success");
                this.isCategoryModalOpen = false;
                await this.loadAllData();
            } catch (err) {
                console.error(err);
            }
        },

        // --- LOCAL CASHIER REGISTER ---
        openAddCashier() {
            this.cashierForm = { name: '', passcode: '', role: 'Cashier', email: '', nfcUid: '' };
            this.isCashierModalOpen = true;
        },

        async saveCashier() {
            if (!this.cashierForm.name || !this.cashierForm.passcode) return;
            try {
                await db.cashiers.add({ ...this.cashierForm });
                this.showNotification("Local cashier profile created!", "success");
                this.isCashierModalOpen = false;
                await this.loadAllData();
            } catch (err) {
                console.error(err);
            }
        },

        async deleteCashier(id) {
            if (confirm("Remove employee credential logs?")) {
                await db.cashiers.delete(id);
                this.showNotification("Cashier profile removed.", "success");
                await this.loadAllData();
            }
        },

        // --- CUSTOMER MANAGEMENT ---
        openAddCustomer() {
            this.customerModalMode = 'add';
            this.customerForm = { id: null, name: '', phone: '', email: '', address: '', notes: '' };
            this.isCustomerModalOpen = true;
        },

        openEditCustomer(cust) {
            this.customerModalMode = 'edit';
            this.customerForm = { ...cust };
            this.isCustomerModalOpen = true;
        },

        async saveCustomer() {
            try {
                const custData = { ...this.customerForm };
                delete custData.id;

                if (this.customerModalMode === 'add') {
                    custData.points = 0;
                    custData.createdAt = new Date().toISOString();
                    await db.customers.add(custData);
                    this.showNotification("Customer profile created!", "success");
                } else {
                    await db.customers.update(this.customerForm.id, custData);
                    this.showNotification("Customer profile updated!", "success");
                }
                this.isCustomerModalOpen = false;
                await this.loadAllData();
            } catch (err) {
                console.error(err);
            }
        },

        async deleteCustomer(id) {
            if (confirm("Delete customer file?")) {
                await db.customers.delete(id);
                this.showNotification("Customer removed.", "success");
                await this.loadAllData();
            }
        },

        // --- EXPENSES LOG ---
        openAddExpense() {
            this.expenseModalMode = 'add';
            this.expenseForm = { id: null, date: new Date().toISOString().split('T')[0], category: 'Rent', amount: 0, description: '', paymentMethod: 'Bank Transfer' };
            this.isExpenseModalOpen = true;
        },

        openEditExpense(exp) {
            this.expenseModalMode = 'edit';
            this.expenseForm = { ...exp };
            this.isExpenseModalOpen = true;
        },

        async saveExpense() {
            try {
                const expData = { ...this.expenseForm };
                delete expData.id;
                expData.amount = Number(expData.amount);

                if (this.expenseModalMode === 'add') {
                    await db.expenses.add(expData);
                    this.showNotification("Expense entry logged.", "success");
                } else {
                    await db.expenses.update(this.expenseForm.id, expData);
                    this.showNotification("Expense updated successfully.", "success");
                }
                this.isExpenseModalOpen = false;
                await this.loadAllData();
            } catch (err) {
                console.error(err);
            }
        },

        async deleteExpense(id) {
            if (confirm("Remove expense logged details?")) {
                await db.expenses.delete(id);
                this.showNotification("Expense entry removed.", "success");
                await this.loadAllData();
            }
        },

        // --- REFUNDS HISTORY ---
        openReceipt(sale) {
            this.currentReceiptSale = sale;
            this.isReceiptModalOpen = true;
        },

        async refundSale(sale) {
            if (sale.status === 'refunded') return;
            if (confirm(`Do you wish to initiate a refund for Invoice ${sale.invoiceNumber}?`)) {
                try {
                    await db.sales.update(sale.id, { status: 'refunded' });

                    for (const item of sale.items) {
                        const prod = this.products.find(p => p.id === item.productId);
                        if (prod) {
                            await db.products.update(prod.id, { stock: prod.stock + item.qty });
                        }
                    }

                    if (sale.customerId && sale.customerName !== "Walk-in Customer") {
                        const cust = this.customers.find(c => c.id === sale.customerId);
                        if (cust) {
                            const lostPoints = Math.floor(sale.total);
                            await db.customers.update(cust.id, { points: Math.max(0, (cust.points || 0) - lostPoints) });
                        }
                    }

                    this.showNotification(`Invoice ${sale.invoiceNumber} refunded.`, "success");
                    await this.loadAllData();
                } catch (err) {
                    console.error(err);
                }
            }
        },

        // --- EXPORTS & BACKUPS ---
        async saveSettings() {
            try {
                for (const [key, value] of Object.entries(this.settings)) {
                    await db.settings.put({ key, value });
                }
                this.showNotification("Configurations saved!", "success");
                await this.loadAllData();
            } catch (err) {
                console.error(err);
            }
        },

        async exportDatabase() {
            try {
                const data = {
                    products: await db.products.toArray(),
                    categories: await db.categories.toArray(),
                    sales: await db.sales.toArray(),
                    customers: await db.customers.toArray(),
                    expenses: await db.expenses.toArray(),
                    cashiers: await db.cashiers.toArray(),
                    settings: await db.settings.toArray()
                };

                const jsonStr = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `POS_Backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showNotification("Backup saved successfully!", "success");
            } catch (err) {
                console.error(err);
            }
        },

        triggerImportDatabase() { document.getElementById('import-file-input').click(); },

        async importDatabase(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!parsed.products || !parsed.sales) {
                        this.showNotification("Backup schema invalid.", "error");
                        return;
                    }

                    if (confirm("Overwriting files with restore values. Are you sure?")) {
                        await db.products.clear();
                        await db.categories.clear();
                        await db.sales.clear();
                        await db.customers.clear();
                        await db.expenses.clear();
                        await db.cashiers.clear();
                        await db.settings.clear();

                        if (parsed.products.length > 0) await db.products.bulkAdd(parsed.products);
                        if (parsed.categories.length > 0) await db.categories.bulkAdd(parsed.categories);
                        if (parsed.sales.length > 0) await db.sales.bulkAdd(parsed.sales);
                        if (parsed.customers.length > 0) await db.customers.bulkAdd(parsed.customers);
                        if (parsed.expenses.length > 0) await db.expenses.bulkAdd(parsed.expenses);
                        if (parsed.cashiers && parsed.cashiers.length > 0) await db.cashiers.bulkAdd(parsed.cashiers);
                        if (parsed.settings.length > 0) await db.settings.bulkAdd(parsed.settings);

                        this.showNotification("Backup restored successfully!", "success");
                        await this.loadAllData();
                    }
                } catch (err) {
                    console.error(err);
                    this.showNotification("JSON parse failure.", "error");
                }
            };
            reader.readAsText(file);
        },

        async loadDemoPreset() {
            if (confirm("Reload seed demo data? All edits will reset.")) {
                await resetAllData();
                this.showNotification("Presets loaded!", "success");
                await this.loadAllData();
            }
        },

        // --- GRAPH COMPILING STATS ---
        getFilteredSalesForReports() {
            const now = new Date();
            let startLimit = new Date();

            if (this.reportRange === '7days') {
                startLimit.setDate(now.getDate() - 7);
            } else if (this.reportRange === '30days') {
                startLimit.setDate(now.getDate() - 30);
            } else if (this.reportRange === 'thisMonth') {
                startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (this.reportRange === 'custom') {
                if (this.customStartDate) startLimit = new Date(this.customStartDate);
            }

            return this.sales.filter(sale => {
                const saleDate = new Date(sale.date);
                if (this.reportRange === 'custom') {
                    const endLimit = this.customEndDate ? new Date(this.customEndDate) : new Date();
                    endLimit.setHours(23, 59, 59, 999);
                    return saleDate >= startLimit && saleDate <= endLimit;
                }
                return saleDate >= startLimit;
            });
        },

        getFilteredExpensesForReports() {
            const now = new Date();
            let startLimit = new Date();

            if (this.reportRange === '7days') {
                startLimit.setDate(now.getDate() - 7);
            } else if (this.reportRange === '30days') {
                startLimit.setDate(now.getDate() - 30);
            } else if (this.reportRange === 'thisMonth') {
                startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
            } else if (this.reportRange === 'custom') {
                if (this.customStartDate) startLimit = new Date(this.customStartDate);
            }

            return this.expenses.filter(exp => {
                const expDate = new Date(exp.date);
                if (this.reportRange === 'custom') {
                    const endLimit = this.customEndDate ? new Date(this.customEndDate) : new Date();
                    endLimit.setHours(23, 59, 59, 999);
                    return expDate >= startLimit && expDate <= endLimit;
                }
                return expDate >= startLimit;
            });
        },

        renderCharts() {
            if (this.salesChartInstance) this.salesChartInstance.destroy();
            if (this.categoryChartInstance) this.categoryChartInstance.destroy();

            const salesFiltered = this.getFilteredSalesForReports();
            
            const daysMap = {};
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateKey = date.toISOString().split('T')[0];
                daysMap[dateKey] = { revenue: 0, profit: 0 };
            }

            salesFiltered.forEach(sale => {
                if (sale.status === 'completed') {
                    const dateKey = sale.date.split('T')[0];
                    if (daysMap[dateKey]) {
                        daysMap[dateKey].revenue += sale.total;
                        daysMap[dateKey].profit += sale.profit;
                    } else {
                        daysMap[dateKey] = { revenue: sale.total, profit: sale.profit };
                    }
                }
            });

            const sortedDates = Object.keys(daysMap).sort();
            const revenueDataset = [];
            const profitDataset = [];
            const labelDates = sortedDates.map(d => {
                const parts = d.split('-');
                return `${parts[2]}/${parts[1]}`;
            });

            sortedDates.forEach(date => {
                revenueDataset.push(parseFloat(daysMap[date].revenue.toFixed(2)));
                profitDataset.push(parseFloat(daysMap[date].profit.toFixed(2)));
            });

            const salesCtx = document.getElementById('salesLineChart')?.getContext('2d');
            if (salesCtx) {
                this.salesChartInstance = new Chart(salesCtx, {
                    type: 'line',
                    data: {
                        labels: labelDates,
                        datasets: [
                            {
                                label: `Revenue (${this.settings.currency})`,
                                data: revenueDataset,
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                tension: 0.3,
                                fill: true,
                                borderWidth: 3
                            },
                            {
                                label: `Net Profit (${this.settings.currency})`,
                                data: profitDataset,
                                borderColor: '#6366f1',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                tension: 0.3,
                                fill: true,
                                borderWidth: 2
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }

            const categoryShares = {};
            salesFiltered.forEach(sale => {
                if (sale.status === 'completed') {
                    sale.items.forEach(item => {
                        const prod = this.products.find(p => p.id === item.productId);
                        const categoryName = prod ? prod.category : 'General';
                        categoryShares[categoryName] = (categoryShares[categoryName] || 0) + item.total;
                    });
                }
            });

            const categoryLabels = Object.keys(categoryShares);
            const categoryData = Object.values(categoryShares).map(v => parseFloat(v.toFixed(2)));

            const catCtx = document.getElementById('categoryDoughnutChart')?.getContext('2d');
            if (catCtx && categoryLabels.length > 0) {
                this.categoryChartInstance = new Chart(catCtx, {
                    type: 'doughnut',
                    data: {
                        labels: categoryLabels,
                        datasets: [{
                            data: categoryData,
                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#64748b']
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'right' } }
                    }
                });
            }
        },

        formatCurrency(val) { return `${this.settings.currency}${Number(val).toFixed(2)}`; },
        formatDateTime(isoStr) {
            if (!isoStr) return '';
            const date = new Date(isoStr);
            return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        },

        exportProductsCSV() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Name,SKU,Barcode,Category,Cost Price,Retail Price,Stock,Reorder Point,Status,Description\n";

            this.products.forEach(p => {
                const row = [
                    `"${p.name.replace(/"/g, '""')}"`,
                    `"${p.sku}"`,
                    `"${p.barcode}"`,
                    `"${p.category}"`,
                    p.costPrice,
                    p.retailPrice,
                    p.stock,
                    p.reorderPoint,
                    p.status,
                    `"${(p.description || '').replace(/"/g, '""')}"`
                ].join(",");
                csvContent += row + "\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `POS_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showNotification("Inventory exported as CSV!", "success");
        },

        triggerCSVImport() { document.getElementById('csv-file-input').click(); },

        async importProductsCSV(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split("\n");
                    const importedProducts = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
                        if (matches.length < 7) continue;

                        const clean = (str) => (str || '').replace(/^"|"$/g, '').trim();

                        const name = clean(matches[0]);
                        const sku = clean(matches[1]);
                        const barcode = clean(matches[2]);
                        const category = clean(matches[3]);
                        const costPrice = parseFloat(clean(matches[4])) || 0;
                        const retailPrice = parseFloat(clean(matches[5])) || 0;
                        const stock = parseInt(clean(matches[6])) || 0;
                        const reorderPoint = parseInt(clean(matches[7])) || 5;
                        const status = clean(matches[8]) || 'active';
                        const description = clean(matches[9]) || '';

                        if (category && !this.categories.some(c => c.name.toLowerCase() === category.toLowerCase())) {
                            await db.categories.add({ name: category, description: 'Imported' });
                        }

                        importedProducts.push({
                            name,
                            sku: sku || `SKU-${Date.now().toString().slice(-6)}-${i}`,
                            barcode,
                            category: category || 'General',
                            costPrice,
                            retailPrice,
                            stock,
                            reorderPoint,
                            image: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=60`,
                            status,
                            description
                        });
                    }

                    if (importedProducts.length > 0) {
                        for (const item of importedProducts) {
                            const existing = this.products.find(p => p.sku === item.sku || (item.barcode && p.barcode === item.barcode));
                            if (existing) {
                                await db.products.update(existing.id, item);
                            } else {
                                await db.products.add(item);
                            }
                        }
                        this.showNotification(`Processed ${importedProducts.length} CSV products!`, "success");
                        await this.loadAllData();
                    }
                } catch (err) {
                    console.error(err);
                }
            };
            reader.readAsText(file);
        }
    },

    watch: {
        reportRange() { if (this.currentView === 'dashboard') this.renderCharts(); },
        customStartDate() { if (this.reportRange === 'custom' && this.currentView === 'dashboard') this.renderCharts(); },
        customEndDate() { if (this.reportRange === 'custom' && this.currentView === 'dashboard') this.renderCharts(); },
        darkMode(newVal) {
            if (newVal) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            localStorage.setItem('pos_dark_mode', newVal);
        }
    },

    mounted() {
        this.darkMode = localStorage.getItem('pos_dark_mode') === 'true';
        if (this.darkMode) document.documentElement.classList.add('dark');

        this.loadAllData();
        window.addEventListener('keypress', this.handleGlobalKeypress);
        
        // Check if Web NFC is supported natively on this phone browser
        this.nfcSupported = 'NDEFReader' in window;
    },

    beforeUnmount() {
        window.removeEventListener('keypress', this.handleGlobalKeypress);
    }
}).mount('#app');
