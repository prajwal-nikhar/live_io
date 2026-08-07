import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Database...");

  // 1. Check if SUPER_ADMIN already exists
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", deletedAt: null },
  });

  if (!existingSuperAdmin) {
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || "superadmin@quiz.com";
    const superAdminPassword =
      process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin123!";
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);

    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail.toLowerCase().trim(),
        passwordHash,
        name: "Super Administrator",
        role: "SUPER_ADMIN",
        isActive: true,
        isVerified: true,
      },
    });

    console.log(`✅ Default SUPER_ADMIN created: ${superAdmin.email}`);
  } else {
    console.log(
      `ℹ️ SUPER_ADMIN user already exists (${existingSuperAdmin.email}). Skipping initial creation.`,
    );
  }

  // 2. Ensure initial Host user exists for demo quizzes
  let host = await prisma.user.findUnique({
    where: { email: "host@quiz.com" },
  });
  if (!host) {
    const hostPasswordHash = await bcrypt.hash("password123", 10);
    host = await prisma.user.create({
      data: {
        email: "host@quiz.com",
        passwordHash: hostPasswordHash,
        name: "Professor Alex",
        role: "HOST",
        isActive: true,
        isVerified: true,
      },
    });
    console.log(`✅ Default Host user created: ${host.email}`);
  }

  // 3. Ensure initial Admin user exists
  let admin = await prisma.user.findUnique({
    where: { email: "cognition@gim.ac.in" },
  });
  if (!admin) {
    const adminPasswordHash = await bcrypt.hash("Cognitor25!", 10);
    admin = await prisma.user.create({
      data: {
        email: "cognition@gim.ac.in",
        passwordHash: adminPasswordHash,
        name: "System Admin",
        role: "ADMIN",
        isActive: true,
        isVerified: true,
      },
    });
    console.log(`✅ Default Admin user created: ${admin.email}`);
  }

  // 4. Seed sample quizzes if none exist
  const existingQuizzesCount = await prisma.quiz.count();
  if (existingQuizzesCount === 0 && host) {
    const quiz1 = await prisma.quiz.create({
      data: {
        title: "Real-Time Scalable Architectures",
        description:
          "Test your understanding of high-concurrency design patterns, WebSockets, Redis caching, and low-latency database queries.",
        coverImage:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=600&auto=format&fit=crop",
        hostId: host.id,
        isPublic: "true",
        randomizeOrder: "false",
        negativeMarking: "true",
        pointsMultiplier: 1.5,
      },
    });

    const q1 = await prisma.question.create({
      data: {
        quizId: quiz1.id,
        text: "Which transport mechanism does Socket.IO use by default before upgrading to a WebSocket connection?",
        type: "MULTIPLE_CHOICE",
        order: 0,
        points: 100,
        timeLimit: 15,
        explanation:
          "Socket.IO starts with HTTP Long Polling to guarantee connectivity across restricted networks, and then upgrades to native WebSockets when available.",
      },
    });

    await prisma.option.createMany({
      data: [
        {
          questionId: q1.id,
          text: "HTTP Long Polling (Engine.IO)",
          isCorrect: "true",
        },
        { questionId: q1.id, text: "FTP File Streaming", isCorrect: "false" },
        {
          questionId: q1.id,
          text: "UDP Broadcast Packets",
          isCorrect: "false",
        },
        { questionId: q1.id, text: "SMTP Email Relays", isCorrect: "false" },
      ],
    });

    console.log(`🌱 Sample Quizzes successfully seeded!`);
  }
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
