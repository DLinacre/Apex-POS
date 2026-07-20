// Initialize Dexie Database
const db = new Dexie("POS_Database");

// Define schema with version 2 to include cashiers/employees
db.version(2).stores({
    products: '++id, name, sku, barcode, category, retailPrice, stock, status',
    categories: '++id, name',
    sales: '++id, invoiceNumber, date, total, status, customerId',
    customers: '++id, name, phone, email',
    expenses: '++id, date, category, amount',
    cashiers: '++id, name, passcode, role, email, nfcUid', // for employee local & NFC logins
    settings: 'key' // key-value store for app settings
});

// Seed Initial/Demo Data Function
async function seedDemoData() {
    // 1. Categories
    const categoriesCount = await db.categories.count();
    let categoriesList = [];
    if (categoriesCount === 0) {
        categoriesList = [
            { name: "Beverages" },
            { name: "Snacks" },
            { name: "Bakery" },
            { name: "Canned Goods" },
            { name: "Dairy" },
            { name: "Electronics" },
            { name: "Apparel" }
        ];
        await db.categories.bulkAdd(categoriesList);
    }

    // 2. Products
    const productsCount = await db.products.count();
    if (productsCount === 0) {
        const demoProducts = [
            {
                name: "Organic Arabica Coffee (250g)",
                sku: "COF-001",
                barcode: "8801234567890",
                category: "Beverages",
                costPrice: 4.50,
                retailPrice: 8.99,
                stock: 45,
                reorderPoint: 10,
                image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Premium single-origin Arabica coffee beans, medium roast."
            },
            {
                name: "Sparkling Spring Water (500ml)",
                sku: "WTR-002",
                barcode: "8801234567891",
                category: "Beverages",
                costPrice: 0.30,
                retailPrice: 1.20,
                stock: 120,
                reorderPoint: 20,
                image: "https://images.unsplash.com/photo-1608885898957-a599fb18ec3f?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Naturally carbonated pure spring water."
            },
            {
                name: "Chocolate Chip Cookies",
                sku: "BAK-001",
                barcode: "8801234567892",
                category: "Bakery",
                costPrice: 1.10,
                retailPrice: 2.99,
                stock: 30,
                reorderPoint: 5,
                image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Freshly baked cookies with premium Belgian chocolate chips."
            },
            {
                name: "Whole Wheat Bread",
                sku: "BAK-002",
                barcode: "8801234567893",
                category: "Bakery",
                costPrice: 0.80,
                retailPrice: 2.20,
                stock: 15,
                reorderPoint: 5,
                image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Artisanal whole wheat sliced bread."
            },
            {
                name: "Gluten-Free Potato Chips",
                sku: "SNA-001",
                barcode: "8801234567894",
                category: "Snacks",
                costPrice: 0.90,
                retailPrice: 2.50,
                stock: 80,
                reorderPoint: 15,
                image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Crispy sea-salted hand-cooked potato chips."
            },
            {
                name: "Spiced Mixed Nuts (150g)",
                sku: "SNA-002",
                barcode: "8801234567895",
                category: "Snacks",
                costPrice: 1.80,
                retailPrice: 4.50,
                stock: 50,
                reorderPoint: 10,
                image: "https://images.unsplash.com/photo-1514944288352-fffac99f0bdf?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Almonds, cashews, and walnuts roasted with mild chili and lime."
            },
            {
                name: "Greek Yogurt (500g)",
                sku: "DY-001",
                barcode: "8801234567896",
                category: "Dairy",
                costPrice: 1.50,
                retailPrice: 3.49,
                stock: 8, // low stock for warning testing
                reorderPoint: 10,
                image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Thick, creamy, authentic Greek yogurt."
            },
            {
                name: "Organic Milk (1L)",
                sku: "DY-002",
                barcode: "8801234567897",
                category: "Dairy",
                costPrice: 0.90,
                retailPrice: 1.99,
                stock: 25,
                reorderPoint: 8,
                image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "Fresh pasteurized whole organic cow's milk."
            },
            {
                name: "USB-C Fast Charger",
                sku: "ELE-001",
                barcode: "8801234567898",
                category: "Electronics",
                costPrice: 5.00,
                retailPrice: 15.99,
                stock: 35,
                reorderPoint: 5,
                image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=300&auto=format&fit=crop&q=60",
                status: "active",
                description: "30W fast-charging USB-C wall adapter."
            }
        ];
        await db.products.bulkAdd(demoProducts);
    }

    // 3. Customers
    const customersCount = await db.customers.count();
    if (customersCount === 0) {
        const demoCustomers = [
            {
                name: "Walk-in Customer",
                phone: "-",
                email: "-",
                points: 0,
                address: "-",
                notes: "Default customer profile",
                createdAt: new Date().toISOString()
            },
            {
                name: "John Doe",
                phone: "+44 7700 900077",
                email: "john.doe@example.com",
                points: 120,
                address: "123 High Street, Birmingham",
                notes: "Regular customer, prefers organic coffee.",
                createdAt: new Date().toISOString()
            },
            {
                name: "Sarah Jenkins",
                phone: "+44 7700 900122",
                email: "sarah.j@example.com",
                points: 245,
                address: "45 Bullring Lane, Birmingham",
                notes: "VIP customer, coupon user.",
                createdAt: new Date().toISOString()
            },
            {
                name: "Michael Smith",
                phone: "+44 7700 900543",
                email: "msmith@example.com",
                points: 30,
                address: "78 Broad St, Birmingham",
                notes: "Electronics repair shop owner.",
                createdAt: new Date().toISOString()
            }
        ];
        await db.customers.bulkAdd(demoCustomers);
    }

    // 4. Cashiers / Employees
    const cashiersCount = await db.cashiers.count();
    if (cashiersCount === 0) {
        const demoCashiers = [
            {
                name: "Admin Manager",
                passcode: "1234",
                role: "Manager",
                email: "manager@apexpos.com",
                nfcUid: "employee:1234"
            },
            {
                name: "Emma Watson",
                passcode: "5555",
                role: "Cashier",
                email: "emma@apexpos.com",
                nfcUid: "employee:5555"
            },
            {
                name: "Liam Neeson",
                passcode: "7777",
                role: "Cashier",
                email: "liam@apexpos.com",
                nfcUid: "employee:7777"
            }
        ];
        await db.cashiers.bulkAdd(demoCashiers);
    }

    // 5. Expenses
    const expensesCount = await db.expenses.count();
    if (expensesCount === 0) {
        const demoExpenses = [
            {
                date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                category: "Utilities",
                amount: 120.00,
                description: "Monthly electricity and water bill",
                paymentMethod: "Bank Transfer"
            },
            {
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                category: "Marketing",
                amount: 45.00,
                description: "Local flyer printing and social media ads",
                paymentMethod: "Card"
            },
            {
                date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                category: "Store Supplies",
                amount: 25.50,
                description: "Paper bags and thermal receipt rolls",
                paymentMethod: "Cash"
            }
        ];
        await db.expenses.bulkAdd(demoExpenses);
    }

    // 6. Sales (Past transactions to populate charts beautifully!)
    const salesCount = await db.sales.count();
    if (salesCount === 0) {
        const productsList = await db.products.toArray();
        const customersList = await db.customers.toArray();
        
        if (productsList.length > 0 && customersList.length > 0) {
            const tempSales = [];
            const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
            const randRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
            let invoiceCounter = 10001;

            for (let i = 9; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dailySalesCount = randRange(2, 5);
                
                for (let j = 0; j < dailySalesCount; j++) {
                    date.setHours(randRange(9, 18), randRange(0, 59), randRange(0, 59));
                    const invoiceNumber = `INV-${invoiceCounter++}`;
                    const customer = randItem(customersList);
                    const itemsToBuy = [];
                    const itemsCount = randRange(1, 3);
                    let subtotal = 0;
                    let profit = 0;
                    
                    const chosenProducts = [];
                    while (chosenProducts.length < itemsCount) {
                        const p = randItem(productsList);
                        if (!chosenProducts.includes(p)) {
                            chosenProducts.push(p);
                        }
                    }
                    
                    chosenProducts.forEach(prod => {
                        const qty = randRange(1, 2);
                        const itemTotal = prod.retailPrice * qty;
                        const itemCost = prod.costPrice * qty;
                        
                        itemsToBuy.push({
                            productId: prod.id,
                            name: prod.name,
                            sku: prod.sku,
                            price: prod.retailPrice,
                            qty: qty,
                            cost: prod.costPrice,
                            total: itemTotal
                        });
                        
                        subtotal += itemTotal;
                        profit += (itemTotal - itemCost);
                    });
                    
                    const taxRate = 0.20;
                    const discount = randItem([0, 0, 0, 1.5, 3]);
                    const taxableAmount = Math.max(0, subtotal - discount);
                    const tax = parseFloat((taxableAmount * taxRate).toFixed(2));
                    const total = parseFloat((taxableAmount + tax).toFixed(2));
                    const paymentMethod = randItem(["Cash", "Card", "Mobile Pay"]);
                    const paidAmount = Math.ceil(total / 5) * 5;
                    const changeAmount = parseFloat((paidAmount - total).toFixed(2));

                    tempSales.push({
                        invoiceNumber,
                        date: date.toISOString(),
                        items: itemsToBuy,
                        discount,
                        tax,
                        subtotal,
                        total,
                        profit: parseFloat((profit - discount).toFixed(2)),
                        paidAmount,
                        changeAmount,
                        paymentMethod,
                        status: "completed",
                        customerId: customer.id,
                        customerName: customer.name,
                        notes: "Generated test transaction"
                    });
                }
            }
            await db.sales.bulkAdd(tempSales);
        }
    }

    // 7. Settings
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
        const defaultSettings = [
            { key: "storeName", value: "Apex Corner Shop" },
            { key: "storeAddress", value: "101 Colmore Row, Birmingham, B3 3AG" },
            { key: "storePhone", value: "+44 121 555 0199" },
            { key: "storeEmail", value: "contact@apexshop.co.uk" },
            { key: "currency", value: "£" },
            { key: "taxRate", value: 20 },
            { key: "receiptHeader", value: "THANK YOU FOR YOUR BUSINESS!" },
            { key: "receiptFooter", value: "Please keep this receipt as proof of purchase. Refunds accepted within 14 days with original packaging." },
            { key: "lowStockAlert", value: 10 },
            { key: "googleClientId", value: "" } // Configurable Google API identity Client ID
        ];
        await db.settings.bulkPut(defaultSettings);
    }
}

// Function to get active settings as an object
async function getSettingsMap() {
    const arr = await db.settings.toArray();
    const map = {};
    arr.forEach(item => {
        map[item.key] = item.value;
    });
    return map;
}

// Function to reset all data
async function resetAllData() {
    await db.products.clear();
    await db.categories.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.expenses.clear();
    await db.cashiers.clear();
    await db.settings.clear();
    await seedDemoData();
}
