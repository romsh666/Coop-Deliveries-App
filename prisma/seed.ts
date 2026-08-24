import { PrismaClient, ProduceType, Grade } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { calculatePayment } from "../src/lib/payment/calculatePayment";

const prisma = new PrismaClient();

const PRODUCE_TYPES: ProduceType[] = ["COFFEE_CHERRIES", "MAIZE", "BEANS"];
const GRADES: Grade[] = ["A", "B", "C"];

async function main() {
  console.log("Seeding database...");

  
  const centreDefs = [
    { name: "Kigali Collection Centre", location: "Kigali" },
    { name: "Huye Collection Centre", location: "Huye" },
    { name: "Musanze Collection Centre", location: "Musanze" },
    { name: "Rubavu Collection Centre", location: "Rubavu" },
  ];
  const centres = [];
  for (const def of centreDefs) {
    const centre = await prisma.centre.create({ data: def });
    centres.push(centre);
    for (const produceType of PRODUCE_TYPES) {
      await prisma.centreCapacity.create({
        data: { centreId: centre.id, produceType, capacityKg: 20_000 },
      });
      await prisma.centreStock.create({
        data: { centreId: centre.id, produceType, quantityKg: 0 },
      });
    }
  }
  const [kigali, huye, musanze, rubavu] = centres;

  
  const passwordHash = await hashPassword("Password123!");
  
  if (!kigali) {
  throw new Error("Cannot create user: Kigali centre was not found.");
}
  const clerk = await prisma.user.create({
    data: {
      email: "clerk@coop.rw",
      passwordHash,
      name: "Alice Uwase",
      role: "CLERK",
      centreId: kigali.id,
    },
  });
  const manager = await prisma.user.create({
    data: {
      email: "manager@coop.rw",
      passwordHash,
      name: "Eric Habimana",
      role: "MANAGER",
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: "admin@coop.rw",
      passwordHash,
      name: "Grace Mukamana",
      role: "ADMIN",
    },
  });

  
  
  
  const januaryList = await prisma.priceList.create({
    data: {
      effectiveFrom: new Date("2026-01-01"),
      publishedById: admin.id,
      entries: {
        create: [
          { produceType: "COFFEE_CHERRIES", grade: "A", pricePerKgRwf: 600 },
          { produceType: "COFFEE_CHERRIES", grade: "B", pricePerKgRwf: 460 },
          { produceType: "COFFEE_CHERRIES", grade: "C", pricePerKgRwf: 350 },
          { produceType: "MAIZE", grade: "A", pricePerKgRwf: 400 },
          { produceType: "MAIZE", grade: "B", pricePerKgRwf: 340 },
          { produceType: "MAIZE", grade: "C", pricePerKgRwf: 270 },
          { produceType: "BEANS", grade: "A", pricePerKgRwf: 850 },
          { produceType: "BEANS", grade: "B", pricePerKgRwf: 700 },
          { produceType: "BEANS", grade: "C", pricePerKgRwf: 560 },
        ],
      },
    },
    include: { entries: true },
  });

  // The current list from the brief, effective 21 August.
  const augustList = await prisma.priceList.create({
    data: {
      effectiveFrom: new Date("2026-08-21"),
      publishedById: admin.id,
      entries: {
        create: [
          { produceType: "COFFEE_CHERRIES", grade: "A", pricePerKgRwf: 650 },
          { produceType: "COFFEE_CHERRIES", grade: "B", pricePerKgRwf: 500 },
          { produceType: "COFFEE_CHERRIES", grade: "C", pricePerKgRwf: 380 },
          { produceType: "MAIZE", grade: "A", pricePerKgRwf: 450 },
          { produceType: "MAIZE", grade: "B", pricePerKgRwf: 380 },
          { produceType: "MAIZE", grade: "C", pricePerKgRwf: 300 },
          { produceType: "BEANS", grade: "A", pricePerKgRwf: 900 },
          { produceType: "BEANS", grade: "B", pricePerKgRwf: 750 },
          { produceType: "BEANS", grade: "C", pricePerKgRwf: 600 },
        ],
      },
    },
    include: { entries: true },
  });

  // --- Farmers --------------------------------------------------------
  const farmerNames = [
    "Jean Bosco Nkurunziza", "Marie Claire Uwimana", "Emmanuel Nshimiyimana",
    "Immaculee Mukandayisenga", "Vincent Habiyaremye", "Solange Umutoni",
    "Jean Paul Ndayisaba", "Beatrice Nyirahabimana", "Faustin Bizimana",
    "Josephine Mukashyaka", "Pacifique Nzeyimana", "Claudine Ingabire",
    "Aloys Rutagengwa", "Divine Uwamahoro", "Theogene Sibomana",
    "Chantal Nyiramana", "Damien Nsengiyumva", "Odette Mukamurenzi",
    "Fidele Twagirayezu", "Esperance Nyirahabineza",
  ];

  const farmers = [];
  for (let i = 0; i < farmerNames.length; i++) {
    const farmer = await prisma.farmer.create({
      data: {
        membershipNumber: `MEM-${String(1001 + i)}`,
        name: farmerNames[i]!,
        phone: `+2507${String(80000000 + i * 111).padStart(8, "0")}`,
        // Exactly one suspended farmer, as required by the brief.
        membershipStatus: i === 7 ? "SUSPENDED" : "ACTIVE",
      },
    });
    farmers.push(farmer);
  }

  
  async function seedDelivery(opts: {
    farmerId: string;
    centreId: string;
    produceType: ProduceType;
    grade: Grade;
    grossWeightKg: number;
    tareWeightKg: number;
    deliveryDate: Date;
    priceList: typeof augustList;
    status: "RECORDED" | "VERIFIED" | "PAID" | "REJECTED";
    recordedById: string;
    verifiedById?: string;
    rejectComment?: string;
  }) {
    const entry = opts.priceList.entries.find(
      (e) => e.produceType === opts.produceType && e.grade === opts.grade
    )!;
    const calc = calculatePayment(
      {
        produceType: opts.produceType,
        grade: opts.grade,
        grossWeightKg: opts.grossWeightKg,
        tareWeightKg: opts.tareWeightKg,
      },
      [{ produceType: entry.produceType, grade: entry.grade, pricePerKgRwf: entry.pricePerKgRwf }]
    );
    if (!calc.ok) throw new Error(`Seed delivery calculation failed: ${calc.error.message}`);

    const delivery = await prisma.delivery.create({
      data: {
        farmerId: opts.farmerId,
        centreId: opts.centreId,
        produceType: opts.produceType,
        grade: opts.grade,
        grossWeightKg: opts.grossWeightKg,
        tareWeightKg: opts.tareWeightKg,
        netWeightKg: calc.netWeightKg,
        priceListId: opts.priceList.id,
        pricePerKgRwf: calc.pricePerKgRwf,
        amountRwf: calc.amountRwf,
        deliveryDate: opts.deliveryDate,
        status: opts.status,
        recordedById: opts.recordedById,
      },
    });

    await prisma.auditLogEntry.create({
      data: {
        deliveryId: delivery.id,
        fromStatus: null,
        toStatus: "RECORDED",
        performedById: opts.recordedById,
      },
    });

    if (opts.status === "VERIFIED" || opts.status === "PAID") {
      await prisma.auditLogEntry.create({
        data: {
          deliveryId: delivery.id,
          fromStatus: "RECORDED",
          toStatus: "VERIFIED",
          performedById: opts.verifiedById ?? manager.id,
        },
      });
    }
    if (opts.status === "PAID") {
      await prisma.auditLogEntry.create({
        data: {
          deliveryId: delivery.id,
          fromStatus: "VERIFIED",
          toStatus: "PAID",
          performedById: opts.verifiedById ?? manager.id,
        },
      });
    }
    if (opts.status === "REJECTED") {
      await prisma.auditLogEntry.create({
        data: {
          deliveryId: delivery.id,
          fromStatus: "RECORDED",
          toStatus: "REJECTED",
          performedById: opts.verifiedById ?? manager.id,
          comment: opts.rejectComment ?? "Grade dispute — reweighed sample did not match.",
        },
      });
    }

    // Keep CentreStock consistent with non-rejected deliveries, matching
    // the invariant the app maintains at runtime.
    if (opts.status !== "REJECTED") {
      await prisma.centreStock.update({
        where: { centreId_produceType: { centreId: opts.centreId, produceType: opts.produceType } },
        data: { quantityKg: { increment: calc.netWeightKg } },
      });
    }

    return delivery;
  }

  await seedDelivery({
    farmerId: farmers[0]!.id, centreId: kigali.id, produceType: "COFFEE_CHERRIES", grade: "A",
    grossWeightKg: 120, tareWeightKg: 5, deliveryDate: new Date("2026-08-22"),
    priceList: augustList, status: "RECORDED", recordedById: clerk.id,
  });
  await seedDelivery({
    farmerId: farmers[1]!.id, centreId: kigali.id, produceType: "MAIZE", grade: "B",
    grossWeightKg: 200, tareWeightKg: 10, deliveryDate: new Date("2026-08-22"),
    priceList: augustList, status: "VERIFIED", recordedById: clerk.id, verifiedById: manager.id,
  });
  await seedDelivery({
    farmerId: farmers[2]!.id, centreId: kigali.id, produceType: "BEANS", grade: "C",
    grossWeightKg: 46, tareWeightKg: 3, deliveryDate: new Date("2026-08-21"),
    priceList: augustList, status: "PAID", recordedById: clerk.id, verifiedById: manager.id,
  });
  await seedDelivery({
    farmerId: farmers[3]!.id, centreId: kigali.id, produceType: "MAIZE", grade: "A",
    grossWeightKg: 80, tareWeightKg: 8, deliveryDate: new Date("2026-08-20"),
    priceList: augustList, status: "REJECTED", recordedById: clerk.id, verifiedById: manager.id,
    rejectComment: "Moisture content too high, farmer asked to re-dry and re-deliver.",
  });
  // A delivery dated BEFORE the August price list took effect — priced with
  // the January list, demonstrating the effective-date rule in the seed data.
  await seedDelivery({
    farmerId: farmers[4]!.id, centreId: kigali.id, produceType: "BEANS", grade: "A",
    grossWeightKg: 100, tareWeightKg: 0, deliveryDate: new Date("2026-03-10"),
    priceList: januaryList, status: "PAID", recordedById: clerk.id, verifiedById: manager.id,
  });

  // A few more spread across the other centres for a fuller dashboard.
  await seedDelivery({
    farmerId: farmers[5]!.id, centreId: huye!.id, produceType: "COFFEE_CHERRIES", grade: "B",
    grossWeightKg: 90, tareWeightKg: 6, deliveryDate: new Date("2026-08-22"),
    priceList: augustList, status: "RECORDED", recordedById: clerk.id,
  });
  await seedDelivery({
    farmerId: farmers[6]!.id, centreId: musanze!.id, produceType: "MAIZE", grade: "C",
    grossWeightKg: 150, tareWeightKg: 12, deliveryDate: new Date("2026-08-21"),
    priceList: augustList, status: "VERIFIED", recordedById: clerk.id, verifiedById: manager.id,
  });
  await seedDelivery({
    farmerId: farmers[8]!.id, centreId: rubavu!.id, produceType: "BEANS", grade: "B",
    grossWeightKg: 60, tareWeightKg: 4, deliveryDate: new Date("2026-08-20"),
    priceList: augustList, status: "PAID", recordedById: clerk.id, verifiedById: manager.id,
  });
  
  await seedDelivery({
    farmerId: farmers[9]!.id, centreId: kigali.id, produceType: "BEANS", grade: "C",
    grossWeightKg: 45.5, tareWeightKg: 2.5, deliveryDate: new Date("2026-08-22"),
    priceList: augustList, status: "RECORDED", recordedById: clerk.id,
  });

  console.log("Seed complete.");
  console.log("Login accounts (password for all: Password123!):");
  console.log(`  Clerk:   ${clerk.email}`);
  console.log(`  Manager: ${manager.email}`);
  console.log(`  Admin:   ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
