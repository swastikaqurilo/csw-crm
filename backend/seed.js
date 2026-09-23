const mongoose = require("mongoose");
require("dotenv").config();

// Models
const Enquiry = require("./src/models/Enquiry");
const Contact = require("./src/models/Contacts");
const FollowUp = require("./src/models/FollowUp");
const Product = require("./src/models/Product");
const Inventory = require("./src/models/Inventory");
const Order = require("./src/models/Order");
const Payment = require("./src/models/Payment");
const Person = require("./src/models/Person");
const Expense = require("./src/models/Expense");
const { Counter } = require("./src/models/Counter");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/csw-crm";

const round = (num) => Math.round(num * 100) / 100;

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected");

    // --------------------------------------------------
    // CLEAR EXISTING DATA
    // --------------------------------------------------

    console.log("Clearing existing sample data...");

    await Payment.deleteMany({});
    await Order.deleteMany({});
    await FollowUp.deleteMany({});
    await Inventory.deleteMany({});
    await Product.deleteMany({});
    await Contact.deleteMany({});
    await Enquiry.deleteMany({});
    await Counter.deleteMany({});
    await Expense.deleteMany({});
    await Person.deleteMany({});

    // --------------------------------------------------
// PEOPLE
// --------------------------------------------------

const people = await Person.insertMany([
  // Employees
  {
    name: "Rajesh Kumar",
    phone: "9876543210",
    type: "Employee",
    role: "Production Manager",
    joiningDate: new Date("2024-01-15"),
    salary: 45000,
    dailyWage: null,
    status: "Active",
  },
  {
    name: "Amit Sharma",
    phone: "9876543211",
    type: "Employee",
    role: "Sales Executive",
    joiningDate: new Date("2024-03-10"),
    salary: 32000,
    dailyWage: null,
    status: "Active",
  },
  {
    name: "Priya Singh",
    phone: "9876543212",
    type: "Employee",
    role: "Accountant",
    joiningDate: new Date("2024-06-01"),
    salary: 38000,
    dailyWage: null,
    status: "Active",
  },
  {
    name: "Vikram Patel",
    phone: "9876543213",
    type: "Employee",
    role: "Purchase Manager",
    joiningDate: new Date("2025-01-05"),
    salary: 35000,
    dailyWage: null,
    status: "Active",
  },

  // Factory People
  {
    name: "Ramesh Yadav",
    phone: "9876543220",
    type: "Factory People",
    role: "Machine Operator",
    joiningDate: new Date("2024-02-10"),
    salary: null,
    dailyWage: 850,
    status: "Active",
  },
  {
    name: "Suresh Kumar",
    phone: "9876543221",
    type: "Factory People",
    role: "Wire Handler",
    joiningDate: new Date("2024-04-15"),
    salary: null,
    dailyWage: 750,
    status: "Active",
  },
  {
    name: "Mohan Lal",
    phone: "9876543222",
    type: "Factory People",
    role: "Packing Worker",
    joiningDate: new Date("2024-08-01"),
    salary: null,
    dailyWage: 700,
    status: "Active",
  },
  {
    name: "Deepak Verma",
    phone: "9876543223",
    type: "Factory People",
    role: "Loading Worker",
    joiningDate: new Date("2025-02-12"),
    salary: null,
    dailyWage: 800,
    status: "Active",
  },
  {
    name: "Manoj Singh",
    phone: "9876543224",
    type: "Factory People",
    role: "General Worker",
    joiningDate: new Date("2025-04-20"),
    salary: null,
    dailyWage: 650,
    status: "Active",
  },
]);

console.log(`Created ${people.length} people`);

    // --------------------------------------------------
    // PRODUCTS
    // --------------------------------------------------

    const products = await Product.insertMany([
      {
        name: "High Carbon Steel Wire",
        productCode: "HCW-001",
        category: "High Carbon Wire",
        description: "High tensile carbon steel wire for industrial applications.",
        material: "Steel",
        diameter: 2.5,
        diameterUnit: "mm",
        unit: "Kg",
        price: 92,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Spring Steel Wire",
        productCode: "SSW-002",
        category: "Spring Wire",
        description: "Precision spring steel wire for spring manufacturing.",
        material: "Steel",
        diameter: 1.8,
        diameterUnit: "mm",
        unit: "Kg",
        price: 118,
        currency: "INR",
        status: "Active",
      },
      {
        name: "GI Steel Wire",
        productCode: "GIW-003",
        category: "Galvanized Wire",
        description: "Galvanized steel wire with corrosion-resistant coating.",
        material: "Galvanized Steel",
        diameter: 3,
        diameterUnit: "mm",
        unit: "Kg",
        price: 105,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Mild Steel Wire",
        productCode: "MSW-004",
        category: "Mild Steel Wire",
        description: "General-purpose mild steel wire.",
        material: "Mild Steel",
        diameter: 2,
        diameterUnit: "mm",
        unit: "Kg",
        price: 78,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Stainless Steel Wire",
        productCode: "SSW-005",
        category: "Stainless Steel",
        description: "Corrosion-resistant stainless steel wire.",
        material: "Stainless Steel",
        diameter: 1.5,
        diameterUnit: "mm",
        unit: "Kg",
        price: 245,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Binding Wire",
        productCode: "BBW-006",
        category: "Binding Wire",
        description: "Soft annealed wire used for construction binding.",
        material: "Mild Steel",
        diameter: 1.2,
        diameterUnit: "mm",
        unit: "Kg",
        price: 72,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Galvanized Iron Wire",
        productCode: "GIW-007",
        category: "Galvanized Wire",
        description: "Commercial GI wire for fencing and fabrication.",
        material: "Galvanized Steel",
        diameter: 2.2,
        diameterUnit: "mm",
        unit: "Kg",
        price: 98,
        currency: "INR",
        status: "Active",
      },
      {
        name: "PC Strand Wire",
        productCode: "PCW-008",
        category: "Prestressed Concrete",
        description: "Prestressing steel strand wire for infrastructure projects.",
        material: "High Carbon Steel",
        diameter: 5,
        diameterUnit: "mm",
        unit: "Kg",
        price: 132,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Electro Galvanized Wire",
        productCode: "EGW-009",
        category: "Galvanized Wire",
        description: "Electro-galvanized wire for industrial applications.",
        material: "Galvanized Steel",
        diameter: 2.8,
        diameterUnit: "mm",
        unit: "Kg",
        price: 112,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Tyre Bead Wire",
        productCode: "TBW-010",
        category: "Tyre Wire",
        description: "High-strength steel wire for tyre bead applications.",
        material: "High Carbon Steel",
        diameter: 1.6,
        diameterUnit: "mm",
        unit: "Kg",
        price: 156,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Fence Wire",
        productCode: "FCW-011",
        category: "Fencing Wire",
        description: "Durable steel wire for fencing applications.",
        material: "Steel",
        diameter: 2.4,
        diameterUnit: "mm",
        unit: "Kg",
        price: 88,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Cut Wire",
        productCode: "CTW-012",
        category: "Cut Wire",
        description: "Precision cut steel wire for industrial use.",
        material: "Steel",
        diameter: 3.2,
        diameterUnit: "mm",
        unit: "Kg",
        price: 101,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Annealed Steel Wire",
        productCode: "ASW-013",
        category: "Annealed Wire",
        description: "Soft annealed steel wire for fabrication applications.",
        material: "Mild Steel",
        diameter: 1.8,
        diameterUnit: "mm",
        unit: "Kg",
        price: 76,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Hard Drawn Steel Wire",
        productCode: "HDW-014",
        category: "Hard Drawn Wire",
        description: "Hard drawn steel wire for demanding applications.",
        material: "High Carbon Steel",
        diameter: 2.6,
        diameterUnit: "mm",
        unit: "Kg",
        price: 110,
        currency: "INR",
        status: "Active",
      },
      {
        name: "Industrial Steel Coil",
        productCode: "ISC-015",
        category: "Steel Coil",
        description: "Industrial steel wire supplied in coil form.",
        material: "Steel",
        diameter: 4,
        diameterUnit: "mm",
        unit: "Coil",
        price: 8500,
        currency: "INR",
        status: "Active",
      },
    ]);

    console.log(`Created ${products.length} products`);

    // --------------------------------------------------
    // INVENTORY
    // --------------------------------------------------

    const inventory = await Inventory.insertMany([
      {
        product: products[0]._id,
        warehouse: "Main",
        quantity: 8200,
        reorderLevel: 2000,
        batchNumber: "HCW-2608-A",
        unit: "kg",
        location: "Rack A-01",
        notes: "Regular production stock",
      },
      {
        product: products[1]._id,
        warehouse: "Main",
        quantity: 1450,
        reorderLevel: 1000,
        batchNumber: "SSW-2608-B",
        unit: "kg",
        location: "Rack A-02",
      },
      {
        product: products[2]._id,
        warehouse: "Main",
        quantity: 5400,
        reorderLevel: 1500,
        batchNumber: "GIW-2609-A",
        unit: "kg",
        location: "Rack B-01",
      },
      {
        product: products[3]._id,
        warehouse: "Main",
        quantity: 620,
        reorderLevel: 1000,
        batchNumber: "MSW-2608-C",
        unit: "kg",
        location: "Rack B-02",
        notes: "Low stock - reorder required",
      },
      {
        product: products[4]._id,
        warehouse: "Main",
        quantity: 2800,
        reorderLevel: 800,
        batchNumber: "SSW-2609-C",
        unit: "kg",
        location: "Rack C-01",
      },
      {
        product: products[5]._id,
        warehouse: "Main",
        quantity: 9500,
        reorderLevel: 2500,
        batchNumber: "BBW-2609-A",
        unit: "kg",
        location: "Rack C-02",
      },
      {
        product: products[6]._id,
        warehouse: "Main",
        quantity: 1250,
        reorderLevel: 1800,
        batchNumber: "GIW-2609-B",
        unit: "kg",
        location: "Rack B-03",
        notes: "Low stock",
      },
      {
        product: products[7]._id,
        warehouse: "Main",
        quantity: 4100,
        reorderLevel: 1000,
        batchNumber: "PCW-2608-A",
        unit: "kg",
        location: "Rack D-01",
      },
      {
        product: products[8]._id,
        warehouse: "Main",
        quantity: 3600,
        reorderLevel: 1200,
        batchNumber: "EGW-2609-A",
        unit: "kg",
        location: "Rack D-02",
      },
      {
        product: products[9]._id,
        warehouse: "Main",
        quantity: 780,
        reorderLevel: 1000,
        batchNumber: "TBW-2609-A",
        unit: "kg",
        location: "Rack E-01",
        notes: "Low stock",
      },
      {
        product: products[10]._id,
        warehouse: "Main",
        quantity: 7200,
        reorderLevel: 2000,
        batchNumber: "FCW-2608-A",
        unit: "kg",
        location: "Rack E-02",
      },
      {
        product: products[11]._id,
        warehouse: "Main",
        quantity: 3100,
        reorderLevel: 1000,
        batchNumber: "CTW-2609-A",
        unit: "kg",
        location: "Rack F-01",
      },
      {
        product: products[12]._id,
        warehouse: "Main",
        quantity: 4800,
        reorderLevel: 1500,
        batchNumber: "ASW-2609-A",
        unit: "kg",
        location: "Rack F-02",
      },
      {
        product: products[13]._id,
        warehouse: "Main",
        quantity: 1900,
        reorderLevel: 1200,
        batchNumber: "HDW-2609-A",
        unit: "kg",
        location: "Rack G-01",
      },
      {
        product: products[14]._id,
        warehouse: "Main",
        quantity: 85,
        reorderLevel: 20,
        batchNumber: "ISC-2609-A",
        unit: "coil",
        location: "Coil Yard",
      },
    ]);

    console.log(`Created ${inventory.length} inventory records`);

    // --------------------------------------------------
    // ENQUIRIES
    // --------------------------------------------------

    const enquiryData = [
      {
        enquiryNumber: "ENQ-2026-0001",
        customerName: "Rahul Mehta",
        customerRole: "Purchase Manager",
        company: "Mehta Infrastructure Pvt Ltd",
        phone: "+91 98765 12001",
        email: "rahul.mehta@mehtainfra.com",
        project: "Delhi Metro Extension",
        location: "New Delhi",
        projectRef: "DMRC-2026-118",
        product: "High Carbon Steel Wire",
        quantity: "12 Ton",
        estimatedValue: 1324800,
        status: "Converted",
        priority: "High",
        source: "Direct",
        assignedTo: "Amit Sharma",
        assignedRole: "Sales Manager",
        requirement: "High tensile steel wire for infrastructure reinforcement.",
        timeline: [
          {
            date: daysAgo(28),
            text: "Enquiry received from customer.",
            createdBy: "System",
          },
          {
            date: daysAgo(25),
            text: "Requirement discussed with purchase team.",
            createdBy: "Amit Sharma",
          },
          {
            date: daysAgo(20),
            text: "Quotation submitted.",
            createdBy: "Amit Sharma",
          },
          {
            date: daysAgo(12),
            text: "Order confirmed.",
            createdBy: "Amit Sharma",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0002",
        customerName: "Priya Nair",
        customerRole: "Procurement Head",
        company: "Nair Engineering Works",
        phone: "+91 98765 12002",
        email: "priya.nair@nairengineering.com",
        project: "Industrial Spring Components",
        location: "Pune",
        projectRef: "NEW-IND-44",
        product: "Spring Steel Wire",
        quantity: "6 Ton",
        estimatedValue: 835200,
        status: "Quoted",
        priority: "High",
        source: "Website",
        assignedTo: "Neha Kapoor",
        assignedRole: "Sales Executive",
        requirement: "Spring-grade wire for automotive component manufacturing.",
        timeline: [
          {
            date: daysAgo(15),
            text: "Website enquiry received.",
            createdBy: "System",
          },
          {
            date: daysAgo(10),
            text: "Technical requirement confirmed.",
            createdBy: "Neha Kapoor",
          },
          {
            date: daysAgo(5),
            text: "Quotation sent to customer.",
            createdBy: "Neha Kapoor",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0003",
        customerName: "Arjun Patel",
        customerRole: "Director",
        company: "Patel Fencing Solutions",
        phone: "+91 98765 12003",
        email: "arjun@patelfencing.com",
        project: "Highway Fencing Package",
        location: "Ahmedabad",
        projectRef: "PFS-HWY-26",
        product: "Fence Wire",
        quantity: "18 Ton",
        estimatedValue: 1879200,
        status: "In Discussion",
        priority: "Medium",
        source: "Referral",
        assignedTo: "Amit Sharma",
        assignedRole: "Sales Manager",
        requirement: "Galvanized fencing wire for highway project.",
        timeline: [
          {
            date: daysAgo(9),
            text: "Referral enquiry received.",
            createdBy: "System",
          },
          {
            date: daysAgo(6),
            text: "Pricing discussion started.",
            createdBy: "Amit Sharma",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0004",
        customerName: "Sanjay Verma",
        customerRole: "Purchase Officer",
        company: "Verma Construction Ltd",
        phone: "+91 98765 12004",
        email: "sanjay@vermaconstruction.com",
        project: "Residential Towers Phase II",
        location: "Noida",
        projectRef: "VCL-NOI-26",
        product: "Binding Wire",
        quantity: "8 Ton",
        estimatedValue: 691200,
        status: "Contacted",
        priority: "Medium",
        source: "Phone",
        assignedTo: "Rohit Singh",
        assignedRole: "Sales Executive",
        requirement: "Construction binding wire requirement.",
        timeline: [
          {
            date: daysAgo(4),
            text: "Customer contacted by phone.",
            createdBy: "Rohit Singh",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0005",
        customerName: "Karan Shah",
        customerRole: "Operations Manager",
        company: "Shah Auto Components",
        phone: "+91 98765 12005",
        email: "karan@shahauto.com",
        project: "Automotive Spring Line",
        location: "Gurugram",
        projectRef: "SAC-26-09",
        product: "Spring Steel Wire",
        quantity: "10 Ton",
        estimatedValue: 1392400,
        status: "New",
        priority: "High",
        source: "Website",
        assignedTo: "Neha Kapoor",
        assignedRole: "Sales Executive",
        requirement: "Spring wire for new automotive production line.",
        timeline: [
          {
            date: daysAgo(1),
            text: "Website enquiry received.",
            createdBy: "System",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0006",
        customerName: "Deepak Joshi",
        customerRole: "Purchase Manager",
        company: "Joshi Industrial Supplies",
        phone: "+91 98765 12006",
        email: "deepak@joshiindustrial.com",
        project: "Warehouse Expansion",
        location: "Jaipur",
        projectRef: "JIS-WH-26",
        product: "GI Steel Wire",
        quantity: "15 Ton",
        estimatedValue: 1858500,
        status: "In Progress",
        priority: "Medium",
        source: "Direct",
        assignedTo: "Amit Sharma",
        assignedRole: "Sales Manager",
        requirement: "Galvanized wire for warehouse fencing.",
        timeline: [
          {
            date: daysAgo(7),
            text: "Requirement received.",
            createdBy: "Amit Sharma",
          },
          {
            date: daysAgo(3),
            text: "Sample specification shared.",
            createdBy: "Amit Sharma",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0007",
        customerName: "Manish Gupta",
        customerRole: "Director",
        company: "Gupta Steel Fabricators",
        phone: "+91 98765 12007",
        email: "manish@guptasteel.com",
        project: "Fabrication Unit Expansion",
        location: "Faridabad",
        projectRef: "GSF-2026-09",
        product: "Mild Steel Wire",
        quantity: "5 Ton",
        estimatedValue: 460200,
        status: "Lost",
        priority: "Low",
        source: "Other",
        assignedTo: "Rohit Singh",
        assignedRole: "Sales Executive",
        requirement: "General fabrication wire requirement.",
        timeline: [
          {
            date: daysAgo(18),
            text: "Initial requirement received.",
            createdBy: "Rohit Singh",
          },
          {
            date: daysAgo(11),
            text: "Customer selected alternate supplier.",
            createdBy: "Rohit Singh",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0008",
        customerName: "Anita Rao",
        customerRole: "Procurement Manager",
        company: "Rao Infrastructure Group",
        phone: "+91 98765 12008",
        email: "anita@raoig.com",
        project: "Flyover Construction",
        location: "Bengaluru",
        projectRef: "RIG-FLY-26",
        product: "PC Strand Wire",
        quantity: "25 Ton",
        estimatedValue: 3894000,
        status: "New",
        priority: "High",
        source: "Direct Tender Reference",
        assignedTo: "Amit Sharma",
        assignedRole: "Sales Manager",
        requirement: "Prestressing steel wire for flyover construction.",
        timeline: [
          {
            date: daysAgo(2),
            text: "Tender reference enquiry received.",
            createdBy: "System",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0009",
        customerName: "Vikas Malhotra",
        customerRole: "Purchase Head",
        company: "Malhotra Industrial Components",
        phone: "+91 98765 12009",
        email: "vikas@malhotraic.com",
        project: "Component Manufacturing",
        location: "Chennai",
        projectRef: "MIC-26-77",
        product: "Stainless Steel Wire",
        quantity: "4 Ton",
        estimatedValue: 1156400,
        status: "Contacted",
        priority: "Medium",
        source: "Referral",
        assignedTo: "Neha Kapoor",
        assignedRole: "Sales Executive",
        requirement: "Stainless steel wire for component production.",
        timeline: [
          {
            date: daysAgo(5),
            text: "Referral enquiry received.",
            createdBy: "Neha Kapoor",
          },
          {
            date: daysAgo(3),
            text: "Customer contacted.",
            createdBy: "Neha Kapoor",
          },
        ],
      },
      {
        enquiryNumber: "ENQ-2026-0010",
        customerName: "Nikhil Bansal",
        customerRole: "Business Head",
        company: "Bansal Wire Products",
        phone: "+91 98765 12010",
        email: "nikhil@bansalwire.com",
        project: "Wire Processing Facility",
        location: "Ludhiana",
        projectRef: "BWP-26-09",
        product: "Hard Drawn Steel Wire",
        quantity: "20 Ton",
        estimatedValue: 2596000,
        status: "In Progress",
        priority: "High",
        source: "Direct",
        assignedTo: "Amit Sharma",
        assignedRole: "Sales Manager",
        requirement: "Hard drawn wire for industrial wire processing.",
        timeline: [
          {
            date: daysAgo(12),
            text: "Direct enquiry received.",
            createdBy: "Amit Sharma",
          },
          {
            date: daysAgo(8),
            text: "Technical specifications discussed.",
            createdBy: "Amit Sharma",
          },
        ],
      },
    ];

    const enquiries = await Enquiry.insertMany(enquiryData);

    console.log(`Created ${enquiries.length} enquiries`);

    // --------------------------------------------------
    // CONTACTS
    // --------------------------------------------------

    const contactData = [
      {
        name: "Rahul Mehta",
        company: "Mehta Infrastructure Pvt Ltd",
        role: "Purchase Manager",
        email: "rahul.mehta@mehtainfra.com",
        phone: "+91 98765 12001",
        enquiry: enquiries[0]._id,
        enquiries: 3,
        lastContact: daysAgo(2),
        status: "active",
      },
      {
        name: "Priya Nair",
        company: "Nair Engineering Works",
        role: "Procurement Head",
        email: "priya.nair@nairengineering.com",
        phone: "+91 98765 12002",
        enquiry: enquiries[1]._id,
        enquiries: 2,
        lastContact: daysAgo(1),
        status: "active",
      },
      {
        name: "Arjun Patel",
        company: "Patel Fencing Solutions",
        role: "Director",
        email: "arjun@patelfencing.com",
        phone: "+91 98765 12003",
        enquiry: enquiries[2]._id,
        enquiries: 4,
        lastContact: daysAgo(2),
        status: "active",
      },
      {
        name: "Sanjay Verma",
        company: "Verma Construction Ltd",
        role: "Purchase Officer",
        email: "sanjay@vermaconstruction.com",
        phone: "+91 98765 12004",
        enquiry: enquiries[3]._id,
        enquiries: 1,
        lastContact: daysAgo(4),
        status: "active",
      },
      {
        name: "Karan Shah",
        company: "Shah Auto Components",
        role: "Operations Manager",
        email: "karan@shahauto.com",
        phone: "+91 98765 12005",
        enquiry: enquiries[4]._id,
        enquiries: 1,
        lastContact: daysAgo(1),
        status: "active",
      },
      {
        name: "Deepak Joshi",
        company: "Joshi Industrial Supplies",
        role: "Purchase Manager",
        email: "deepak@joshiindustrial.com",
        phone: "+91 98765 12006",
        enquiry: enquiries[5]._id,
        enquiries: 2,
        lastContact: daysAgo(3),
        status: "active",
      },
      {
        name: "Manish Gupta",
        company: "Gupta Steel Fabricators",
        role: "Director",
        email: "manish@guptasteel.com",
        phone: "+91 98765 12007",
        enquiry: enquiries[6]._id,
        enquiries: 1,
        lastContact: daysAgo(11),
        status: "inactive",
      },
      {
        name: "Anita Rao",
        company: "Rao Infrastructure Group",
        role: "Procurement Manager",
        email: "anita@raoig.com",
        phone: "+91 98765 12008",
        enquiry: enquiries[7]._id,
        enquiries: 1,
        lastContact: daysAgo(2),
        status: "active",
      },
      {
        name: "Vikas Malhotra",
        company: "Malhotra Industrial Components",
        role: "Purchase Head",
        email: "vikas@malhotraic.com",
        phone: "+91 98765 12009",
        enquiry: enquiries[8]._id,
        enquiries: 2,
        lastContact: daysAgo(3),
        status: "active",
      },
      {
        name: "Nikhil Bansal",
        company: "Bansal Wire Products",
        role: "Business Head",
        email: "nikhil@bansalwire.com",
        phone: "+91 98765 12010",
        enquiry: enquiries[9]._id,
        enquiries: 3,
        lastContact: daysAgo(4),
        status: "active",
      },
      {
        name: "Rakesh Khanna",
        company: "Khanna Industrial Traders",
        role: "Owner",
        email: "rakesh@khannatraders.com",
        phone: "+91 98765 12011",
        enquiries: 5,
        lastContact: daysAgo(7),
        status: "active",
      },
      {
        name: "Meera Iyer",
        company: "Iyer Engineering Pvt Ltd",
        role: "Purchase Executive",
        email: "meera@iyerengineering.com",
        phone: "+91 98765 12012",
        enquiries: 2,
        lastContact: daysAgo(9),
        status: "active",
      },
    ];

    const contacts = await Contact.insertMany(
    contactData.map((contact, index) => ({
        ...contact,
        contactId: `CON-${String(index + 1).padStart(3, "0")}`,
    }))
    );
    // --------------------------------------------------
    // FOLLOW UPS
    // --------------------------------------------------

    const followUps = await FollowUp.insertMany([
      {
        contact: contacts[0]._id,
        enquiry: enquiries[0]._id,
        type: "Call",
        subject: "Order delivery confirmation",
        notes: "Confirm delivery schedule for high carbon steel wire.",
        scheduledAt: daysFromNow(1),
        status: "Pending",
        priority: "High",
      },
      {
        contact: contacts[1]._id,
        enquiry: enquiries[1]._id,
        type: "Email",
        subject: "Quotation follow-up",
        notes: "Follow up on quotation sent for spring steel wire.",
        scheduledAt: daysFromNow(2),
        status: "Pending",
        priority: "High",
      },
      {
        contact: contacts[2]._id,
        enquiry: enquiries[2]._id,
        type: "Meeting",
        subject: "Pricing discussion",
        notes: "Discuss bulk pricing and delivery schedule.",
        scheduledAt: daysFromNow(3),
        status: "Pending",
        priority: "Medium",
      },
      {
        contact: contacts[3]._id,
        enquiry: enquiries[3]._id,
        type: "Call",
        subject: "Construction wire requirement",
        notes: "Confirm required quantity and delivery location.",
        scheduledAt: daysFromNow(1),
        status: "Pending",
        priority: "Medium",
      },
      {
        contact: contacts[4]._id,
        enquiry: enquiries[4]._id,
        type: "WhatsApp",
        subject: "New automotive requirement",
        notes: "Share spring wire technical specification.",
        scheduledAt: daysFromNow(4),
        status: "Pending",
        priority: "High",
      },
      {
        contact: contacts[5]._id,
        enquiry: enquiries[5]._id,
        type: "Call",
        subject: "Sample specification follow-up",
        notes: "Customer requested additional sample details.",
        scheduledAt: daysFromNow(2),
        status: "Pending",
        priority: "Medium",
      },
      {
        contact: contacts[6]._id,
        enquiry: enquiries[6]._id,
        type: "Email",
        subject: "Closed enquiry follow-up",
        notes: "Archived follow-up after lost opportunity.",
        scheduledAt: daysAgo(10),
        status: "Completed",
        priority: "Low",
        completedAt: daysAgo(10),
      },
      {
        contact: contacts[7]._id,
        enquiry: enquiries[7]._id,
        type: "Meeting",
        subject: "Tender requirement discussion",
        notes: "Discuss PC strand wire tender specifications.",
        scheduledAt: daysFromNow(5),
        status: "Pending",
        priority: "High",
      },
      {
        contact: contacts[8]._id,
        enquiry: enquiries[8]._id,
        type: "Call",
        subject: "Stainless steel wire requirement",
        notes: "Confirm grade and diameter requirements.",
        scheduledAt: daysFromNow(2),
        status: "Pending",
        priority: "Medium",
      },
      {
        contact: contacts[9]._id,
        enquiry: enquiries[9]._id,
        type: "Call",
        subject: "Technical specification review",
        notes: "Review hard drawn wire specifications.",
        scheduledAt: daysFromNow(3),
        status: "Pending",
        priority: "High",
      },
      {
        contact: contacts[10]._id,
        type: "Email",
        subject: "Repeat order discussion",
        notes: "Customer interested in recurring monthly supply.",
        scheduledAt: daysAgo(3),
        status: "Completed",
        priority: "Medium",
        completedAt: daysAgo(3),
      },
      {
        contact: contacts[11]._id,
        type: "Call",
        subject: "Previous order feedback",
        notes: "Collect feedback and discuss next requirement.",
        scheduledAt: daysAgo(5),
        status: "Completed",
        priority: "Low",
        completedAt: daysAgo(5),
      },
    ]);

    console.log(`Created ${followUps.length} follow-ups`);

    // --------------------------------------------------
    // ORDER HELPER
    // --------------------------------------------------

    const makeItem = (product, quantity, discount = 0) => {
      const rate = product.price;
      const gross = quantity * rate;
      const discountAmount = round(gross * (discount / 100));
      const amount = round(gross - discountAmount);

      return {
        product: product._id,
        quantity,
        unit: product.unit === "Coil" ? "coil" : "kg",
        rate,
        discount,
        amount,
      };
    };

    const makeOrder = ({
      orderNumber,
      enquiry,
      contact,
      items,
      orderDate,
      expectedDeliveryDate,
      status,
      taxPercent = 18,
      orderDiscount = 0,
      amountPaid = 0,
      shippingAddress,
      billingAddress,
      notes,
      dispatchedDate,
      deliveredDate,
    }) => {
      const itemSubtotal = round(
        items.reduce((sum, item) => sum + item.amount, 0)
      );

      const subTotal = itemSubtotal;

      const discount = round(
        Math.min(orderDiscount, subTotal)
      );

      const taxableAmount = round(subTotal - discount);
      const taxAmount = round(taxableAmount * (taxPercent / 100));
      const grandTotal = round(taxableAmount + taxAmount);

      let paymentStatus = "Pending";

      if (amountPaid >= grandTotal) {
        paymentStatus = "Paid";
        amountPaid = grandTotal;
      } else if (amountPaid > 0) {
        paymentStatus = "Partial";
      }

      return {
        orderNumber,
        enquiry,
        contact,
        items,
        subTotal,
        discount,
        taxPercent,
        taxAmount,
        grandTotal,
        status,
        orderDate,
        expectedDeliveryDate,
        dispatchedDate,
        deliveredDate,
        shippingAddress,
        billingAddress,
        paymentStatus,
        amountPaid,
        notes,
        isActive: status !== "Cancelled",
      };
    };

    // --------------------------------------------------
    // ORDERS
    // --------------------------------------------------

    const ordersData = [
      makeOrder({
        orderNumber: "ORD-2026-0001",
        enquiry: enquiries[0]._id,
        contact: contacts[0]._id,
        items: [
          makeItem(products[0], 5000, 2),
          makeItem(products[3], 2000, 1),
        ],
        orderDate: daysAgo(20),
        expectedDeliveryDate: daysAgo(5),
        status: "Delivered",
        amountPaid: 570000,
        shippingAddress: "Mehta Infrastructure Site, New Delhi",
        billingAddress: "Mehta Infrastructure Pvt Ltd, New Delhi",
        notes: "Delivered in two batches.",
        dispatchedDate: daysAgo(8),
        deliveredDate: daysAgo(5),
      }),

      makeOrder({
        orderNumber: "ORD-2026-0002",
        enquiry: enquiries[1]._id,
        contact: contacts[1]._id,
        items: [
          makeItem(products[1], 3000, 2),
        ],
        orderDate: daysAgo(14),
        expectedDeliveryDate: daysFromNow(4),
        status: "In Production",
        amountPaid: 150000,
        shippingAddress: "Nair Engineering Works, Pune",
        billingAddress: "Nair Engineering Works, Pune",
        notes: "Production batch scheduled.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0003",
        enquiry: enquiries[5]._id,
        contact: contacts[5]._id,
        items: [
          makeItem(products[2], 4000, 3),
        ],
        orderDate: daysAgo(10),
        expectedDeliveryDate: daysFromNow(3),
        status: "Ready for Dispatch",
        amountPaid: 0,
        shippingAddress: "Joshi Industrial Supplies, Jaipur",
        billingAddress: "Joshi Industrial Supplies, Jaipur",
        notes: "Awaiting dispatch confirmation.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0004",
        enquiry: enquiries[3]._id,
        contact: contacts[3]._id,
        items: [
          makeItem(products[5], 3500, 1),
          makeItem(products[12], 1500, 2),
        ],
        orderDate: daysAgo(7),
        expectedDeliveryDate: daysFromNow(7),
        status: "Confirmed",
        amountPaid: 100000,
        shippingAddress: "Verma Construction Site, Noida",
        billingAddress: "Verma Construction Ltd, Noida",
        notes: "Customer requested phased delivery.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0005",
        enquiry: enquiries[2]._id,
        contact: contacts[2]._id,
        items: [
          makeItem(products[10], 6000, 2),
          makeItem(products[6], 3000, 2),
        ],
        orderDate: daysAgo(5),
        expectedDeliveryDate: daysFromNow(10),
        status: "Confirmed",
        amountPaid: 250000,
        shippingAddress: "Patel Fencing Solutions, Ahmedabad",
        billingAddress: "Patel Fencing Solutions, Ahmedabad",
        notes: "Highway project supply.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0006",
        enquiry: null,
        contact: contacts[10]._id,
        items: [
          makeItem(products[3], 1500, 0),
          makeItem(products[5], 2000, 0),
        ],
        orderDate: daysAgo(30),
        expectedDeliveryDate: daysAgo(20),
        status: "Delivered",
        amountPaid: 270000,
        shippingAddress: "Khanna Industrial Traders, Delhi",
        billingAddress: "Khanna Industrial Traders, Delhi",
        notes: "Repeat customer order.",
        dispatchedDate: daysAgo(23),
        deliveredDate: daysAgo(20),
      }),

      makeOrder({
        orderNumber: "ORD-2026-0007",
        enquiry: null,
        contact: contacts[11]._id,
        items: [
          makeItem(products[4], 1000, 1),
        ],
        orderDate: daysAgo(25),
        expectedDeliveryDate: daysAgo(14),
        status: "Delivered",
        amountPaid: 247000,
        shippingAddress: "Iyer Engineering Pvt Ltd, Bengaluru",
        billingAddress: "Iyer Engineering Pvt Ltd, Bengaluru",
        notes: "Completed successfully.",
        dispatchedDate: daysAgo(17),
        deliveredDate: daysAgo(14),
      }),

      makeOrder({
        orderNumber: "ORD-2026-0008",
        enquiry: null,
        contact: contacts[0]._id,
        items: [
          makeItem(products[7], 2000, 2),
        ],
        orderDate: daysAgo(3),
        expectedDeliveryDate: daysFromNow(15),
        status: "Draft",
        amountPaid: 0,
        shippingAddress: "Mehta Infrastructure Pvt Ltd, New Delhi",
        billingAddress: "Mehta Infrastructure Pvt Ltd, New Delhi",
        notes: "Draft order awaiting approval.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0009",
        enquiry: null,
        contact: contacts[8]._id,
        items: [
          makeItem(products[4], 2500, 3),
        ],
        orderDate: daysAgo(12),
        expectedDeliveryDate: daysFromNow(2),
        status: "Dispatched",
        amountPaid: 300000,
        shippingAddress: "Malhotra Industrial Components, Chennai",
        billingAddress: "Malhotra Industrial Components, Chennai",
        notes: "Shipment dispatched.",
        dispatchedDate: daysAgo(1),
      }),

      makeOrder({
        orderNumber: "ORD-2026-0010",
        enquiry: null,
        contact: contacts[9]._id,
        items: [
          makeItem(products[13], 5000, 2),
        ],
        orderDate: daysAgo(18),
        expectedDeliveryDate: daysAgo(2),
        status: "Delivered",
        amountPaid: 561000,
        shippingAddress: "Bansal Wire Products, Ludhiana",
        billingAddress: "Bansal Wire Products, Ludhiana",
        notes: "Industrial wire supply completed.",
        dispatchedDate: daysAgo(5),
        deliveredDate: daysAgo(2),
      }),

      makeOrder({
        orderNumber: "ORD-2026-0011",
        enquiry: null,
        contact: contacts[4]._id,
        items: [
          makeItem(products[1], 2000, 1),
        ],
        orderDate: daysAgo(2),
        expectedDeliveryDate: daysFromNow(20),
        status: "In Production",
        amountPaid: 100000,
        shippingAddress: "Shah Auto Components, Gurugram",
        billingAddress: "Shah Auto Components, Gurugram",
        notes: "Automotive spring wire order.",
      }),

      makeOrder({
        orderNumber: "ORD-2026-0012",
        enquiry: null,
        contact: contacts[5]._id,
        items: [
          makeItem(products[2], 2500, 0),
        ],
        orderDate: daysAgo(40),
        expectedDeliveryDate: daysAgo(30),
        status: "Cancelled",
        amountPaid: 0,
        shippingAddress: "Joshi Industrial Supplies, Jaipur",
        billingAddress: "Joshi Industrial Supplies, Jaipur",
        notes: "Order cancelled by customer.",
      }),
    ];

    const orders = await Order.insertMany(ordersData);

    console.log(`Created ${orders.length} orders`);

    // --------------------------------------------------
    // PAYMENTS
    // --------------------------------------------------

    const paymentData = [];

    const addPayment = ({
      paymentNumber,
      orderIndex,
      amount,
      paymentDate,
      paymentMode,
      transactionId,
      chequeNumber,
      bankName,
      status = "Completed",
      notes,
    }) => {
      const order = orders[orderIndex];

      paymentData.push({
        paymentNumber,
        order: order._id,
        contact: order.contact,
        amount,
        currency: "INR",
        paymentDate,
        paymentMode,
        transactionId,
        chequeNumber,
        bankName,
        status,
        appliedToOrder: status === "Completed",
        notes,
        isReconciled: status === "Completed",
        reconciledDate:
          status === "Completed" ? paymentDate : undefined,
        isActive: true,
      });
    };

    addPayment({
      paymentNumber: "PAY-2026-0001",
      orderIndex: 0,
      amount: 300000,
      paymentDate: daysAgo(18),
      paymentMode: "NEFT",
      transactionId: "NEFT260901001",
      notes: "Advance payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0002",
      orderIndex: 0,
      amount: 270000,
      paymentDate: daysAgo(10),
      paymentMode: "RTGS",
      transactionId: "RTGS260909001",
      notes: "Final payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0003",
      orderIndex: 1,
      amount: 150000,
      paymentDate: daysAgo(12),
      paymentMode: "Bank Transfer",
      transactionId: "BT260905001",
      notes: "Production advance",
    });

    addPayment({
      paymentNumber: "PAY-2026-0004",
      orderIndex: 3,
      amount: 100000,
      paymentDate: daysAgo(6),
      paymentMode: "UPI",
      transactionId: "UPI260911001",
      notes: "Initial advance",
    });

    addPayment({
      paymentNumber: "PAY-2026-0005",
      orderIndex: 4,
      amount: 250000,
      paymentDate: daysAgo(4),
      paymentMode: "RTGS",
      transactionId: "RTGS260913001",
      notes: "Project advance",
    });

    addPayment({
      paymentNumber: "PAY-2026-0006",
      orderIndex: 5,
      amount: 150000,
      paymentDate: daysAgo(28),
      paymentMode: "Cheque",
      chequeNumber: "CHQ-458921",
      bankName: "HDFC Bank",
      notes: "Cheque payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0007",
      orderIndex: 5,
      amount: 120000,
      paymentDate: daysAgo(21),
      paymentMode: "NEFT",
      transactionId: "NEFT260908221",
      notes: "Balance payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0008",
      orderIndex: 6,
      amount: 247000,
      paymentDate: daysAgo(20),
      paymentMode: "Bank Transfer",
      transactionId: "BT260827901",
      notes: "Full payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0009",
      orderIndex: 8,
      amount: 300000,
      paymentDate: daysAgo(8),
      paymentMode: "RTGS",
      transactionId: "RTGS260909778",
      notes: "Advance against dispatched order",
    });

    addPayment({
      paymentNumber: "PAY-2026-0010",
      orderIndex: 9,
      amount: 300000,
      paymentDate: daysAgo(16),
      paymentMode: "NEFT",
      transactionId: "NEFT260902991",
      notes: "First payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0011",
      orderIndex: 9,
      amount: 261000,
      paymentDate: daysAgo(6),
      paymentMode: "RTGS",
      transactionId: "RTGS260912221",
      notes: "Final payment",
    });

    addPayment({
      paymentNumber: "PAY-2026-0012",
      orderIndex: 10,
      amount: 100000,
      paymentDate: daysAgo(1),
      paymentMode: "UPI",
      transactionId: "UPI260916110",
      notes: "Production advance",
    });

    const payments = await Payment.insertMany(paymentData);

    console.log(`Created ${payments.length} payments`);

    //--------------------------------------------------
    //EXPENSES
    //--------------------------------------------------


      const rajesh = people.find((p) => p.name === "Rajesh Kumar");
      const amit = people.find((p) => p.name === "Amit Sharma");
      const priya = people.find((p) => p.name === "Priya Singh");

      const ramesh = people.find((p) => p.name === "Ramesh Yadav");
      const suresh = people.find((p) => p.name === "Suresh Kumar");
      const mohan = people.find((p) => p.name === "Mohan Lal");
      const deepak = people.find((p) => p.name === "Deepak Verma");
      const manoj = people.find((p) => p.name === "Manoj Singh");

      const expenses = await Expense.insertMany([
        // Employee monthly salaries
        {
          type: "Employee",
          date: new Date("2026-09-01"),
          amount: rajesh.salary,
          paymentStatus: "Paid",
          paymentMethod: "UPI",
          paidAt: new Date("2026-09-01"),
          transactionId: "UPI-SAL-001",
          person: rajesh._id,
          description: "September salary",
          notes: "Monthly employee salary",
        },
        {
          type: "Employee",
          date: new Date("2026-09-01"),
          amount: amit.salary,
          paymentStatus: "Paid",
          paymentMethod: "Cash",
          paidAt: new Date("2026-09-01"),
          transactionId: null,
          person: amit._id,
          description: "September salary",
          notes: "Monthly employee salary",
        },
        {
          type: "Employee",
          date: new Date("2026-09-01"),
          amount: priya.salary,
          paymentStatus: "Pending",
          paymentMethod: null,
          paidAt: null,
          transactionId: null,
          person: priya._id,
          description: "September salary",
          notes: "Salary pending",
        },

        // Factory People - daily wages
        {
          type: "Factory People",
          date: new Date("2026-09-18"),
          amount: ramesh.dailyWage,
          paymentStatus: "Paid",
          paymentMethod: "Cash",
          paidAt: new Date("2026-09-18"),
          transactionId: null,
          person: ramesh._id,
          description: "Daily wage",
          notes: "Worked for one day",
        },
        {
          type: "Factory People",
          date: new Date("2026-09-18"),
          amount: suresh.dailyWage,
          paymentStatus: "Paid",
          paymentMethod: "UPI",
          paidAt: new Date("2026-09-18"),
          transactionId: "UPI-WAGE-001",
          person: suresh._id,
          description: "Daily wage",
          notes: "Worked for one day",
        },
        {
          type: "Factory People",
          date: new Date("2026-09-19"),
          amount: mohan.dailyWage,
          paymentStatus: "Pending",
          paymentMethod: null,
          paidAt: null,
          transactionId: null,
          person: mohan._id,
          description: "Daily wage",
          notes: "Payment pending",
        },
        {
          type: "Factory People",
          date: new Date("2026-09-19"),
          amount: deepak.dailyWage,
          paymentStatus: "Paid",
          paymentMethod: "Cash",
          paidAt: new Date("2026-09-19"),
          transactionId: null,
          person: deepak._id,
          description: "Daily wage",
          notes: "Worked for one day",
        },
        {
          type: "Factory People",
          date: new Date("2026-09-20"),
          amount: manoj.dailyWage,
          paymentStatus: "Pending",
          paymentMethod: null,
          paidAt: null,
          transactionId: null,
          person: manoj._id,
          description: "Daily wage",
          notes: "Payment pending",
        },

        // Factory expenses
        {
          type: "Factory Expense",
          date: new Date("2026-09-05"),
          amount: 18500,
          paymentStatus: "Paid",
          paymentMethod: "UPI",
          paidAt: new Date("2026-09-05"),
          transactionId: "UPI-FACTORY-001",
          expenseType: "Electricity",
          vendor: "Delhi Electricity Supply",
          invoiceNumber: "INV-ELEC-001",
          description: "Factory electricity bill",
          notes: "Monthly electricity expense",
        },
        {
          type: "Factory Expense",
          date: new Date("2026-09-08"),
          amount: 12000,
          paymentStatus: "Pending",
          paymentMethod: null,
          paidAt: null,
          transactionId: null,
          expenseType: "Machine Maintenance",
          vendor: "Industrial Machine Services",
          invoiceNumber: "INV-MNT-001",
          description: "Routine machine maintenance",
          notes: "Payment pending",
        },
        {
          type: "Factory Expense",
          date: new Date("2026-09-10"),
          amount: 6500,
          paymentStatus: "Paid",
          paymentMethod: "Cash",
          paidAt: new Date("2026-09-10"),
          transactionId: null,
          expenseType: "Factory Supplies",
          vendor: "Sharma Industrial Supplies",
          invoiceNumber: "INV-SUP-001",
          description: "Factory consumable supplies",
          notes: "Paid in cash",
        },

        // Miscellaneous
        {
          type: "Miscellaneous",
          date: new Date("2026-09-12"),
          amount: 2200,
          paymentStatus: "Paid",
          paymentMethod: "Cash",
          paidAt: new Date("2026-09-12"),
          transactionId: null,
          expenseName: "Office Stationery",
          expenseCategory: "Office",
          description: "Pens, files, registers and printing material",
          notes: "Office supplies",
        },
        {
          type: "Miscellaneous",
          date: new Date("2026-09-15"),
          amount: 3500,
          paymentStatus: "Pending",
          paymentMethod: null,
          paidAt: null,
          transactionId: null,
          expenseName: "Staff Refreshments",
          expenseCategory: "General",
          description: "Tea, coffee and refreshments",
          notes: "Pending payment",
        },
      ]);

      console.log(`Created ${expenses.length} expenses`);

    // --------------------------------------------------
    // COUNTERS
    // --------------------------------------------------

    await Counter.insertMany([
      {
        _id: "payment-2026",
        seq: payments.length,
      },
      {
        _id: "order-2026",
        seq: orders.length,
      },
      {
        _id: "enquiry-2026",
        seq: enquiries.length,
      },
    ]);

    console.log("Created counters");

    // --------------------------------------------------
    // FINAL SUMMARY
    // --------------------------------------------------

    console.log("\n========================================");
    console.log("       CSW DATABASE SEEDED SUCCESSFULLY");
    console.log("========================================");
    console.log(`Products:    ${products.length}`);
    console.log(`Inventory:   ${inventory.length}`);
    console.log(`Enquiries:   ${enquiries.length}`);
    console.log(`Contacts:    ${contacts.length}`);
    console.log(`Follow-ups:  ${followUps.length}`);
    console.log(`Orders:      ${orders.length}`);
    console.log(`Payments:    ${payments.length}`);
    console.log("========================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\nSEED ERROR:");
    console.error(error);

    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
