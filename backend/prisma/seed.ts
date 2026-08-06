import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Clean existing databases
  await prisma.response.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.quizSession.deleteMany({});
  await prisma.option.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const host = await prisma.user.create({
    data: {
      email: 'host@quiz.com',
      passwordHash,
      name: 'Professor Alex',
      role: 'HOST',
    },
  });

  const adminPasswordHash = await bcrypt.hash('Cognitor25!', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'cognition@gim.ac.in',
      passwordHash: adminPasswordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });

  console.log(`Created Host User: ${host.email}`);
  console.log(`Created Admin User: ${admin.email}`);

  // 3. Create Quizzes
  // Quiz 1: Full-Stack Real-Time Quiz Architecture Trivia
  const quiz1 = await prisma.quiz.create({
    data: {
      title: 'Real-Time Scalable Architectures',
      description: 'Test your understanding of high-concurrency design patterns, WebSockets, Redis caching, and low-latency database queries.',
      coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=600&auto=format&fit=crop',
      hostId: host.id,
      isPublic: 'true',
      randomizeOrder: 'false',
      negativeMarking: 'true',
      pointsMultiplier: 1.5,
    },
  });

  // Quiz 1 Questions
  const q1 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      text: 'Which transport mechanism does Socket.IO use by default before upgrading to a WebSocket connection?',
      type: 'MULTIPLE_CHOICE',
      order: 0,
      points: 100,
      timeLimit: 15,
      explanation: 'Socket.IO starts with HTTP Long Polling to guarantee connectivity across restricted networks, and then upgrades to native WebSockets when available.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q1.id, text: 'HTTP Long Polling (Engine.IO)', isCorrect: 'true' },
      { questionId: q1.id, text: 'FTP File Streaming', isCorrect: 'false' },
      { questionId: q1.id, text: 'UDP Broadcast Packets', isCorrect: 'false' },
      { questionId: q1.id, text: 'SMTP Email Relays', isCorrect: 'false' },
    ],
  });

  const q2 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      text: 'In Redis caching, what does a cache hit ratio of 95% signify?',
      type: 'MULTIPLE_CHOICE',
      order: 1,
      points: 100,
      timeLimit: 20,
      explanation: '95% cache hit ratio means that 95 out of 100 read operations are answered directly from memory, which radically minimizes database read latency.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q2.id, text: '95% of queries were found in Redis memory cache', isCorrect: 'true' },
      { questionId: q2.id, text: '95% of server queries failed and threw errors', isCorrect: 'false' },
      { questionId: q2.id, text: 'Redis was running at 95% total CPU capacity', isCorrect: 'false' },
      { questionId: q2.id, text: 'Database disk storage is 95% full', isCorrect: 'false' },
    ],
  });

  const q3 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      text: 'True or False: Using indexes on all database columns is a gold standard for scaling database write speed.',
      type: 'TRUE_FALSE',
      order: 2,
      points: 100,
      timeLimit: 10,
      explanation: 'False! Indexes accelerate READ queries but significantly slow down WRITE queries (INSERT, UPDATE, DELETE) because indices must be recalculated on every write.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q3.id, text: 'False', isCorrect: 'true' },
      { questionId: q3.id, text: 'True', isCorrect: 'false' },
    ],
  });

  // Quiz 2: AI & Generative Tech Trivia
  const quiz2 = await prisma.quiz.create({
    data: {
      title: 'Artificial Intelligence & LLM Literacy',
      description: 'Quick trivia challenging your understanding of modern AI models, tokenizers, vector databases, and neural networks.',
      coverImage: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?q=80&w=600&auto=format&fit=crop',
      hostId: host.id,
      isPublic: 'true',
      randomizeOrder: 'false',
      negativeMarking: 'false',
      pointsMultiplier: 1.0,
    },
  });

  const q4 = await prisma.question.create({
    data: {
      quizId: quiz2.id,
      text: 'What does the term "Hallucination" refer to in the context of Large Language Models?',
      type: 'MULTIPLE_CHOICE',
      order: 0,
      points: 100,
      timeLimit: 15,
      explanation: 'Hallucination occurs when an LLM outputs factually incorrect or completely fabricated information in a confident manner.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q4.id, text: 'Confidently outputting factually incorrect or fabricated claims', isCorrect: 'true' },
      { questionId: q4.id, text: 'When the server runs out of video RAM (VRAM) during generation', isCorrect: 'false' },
      { questionId: q4.id, text: 'The model entering a low-power hibernation state', isCorrect: 'false' },
      { questionId: q4.id, text: 'Translating English text directly into binary format', isCorrect: 'false' },
    ],
  });

  const q5 = await prisma.question.create({
    data: {
      quizId: quiz2.id,
      text: 'Which database type is custom-architected to index and query mathematical vector embeddings?',
      type: 'MULTIPLE_CHOICE',
      order: 1,
      points: 100,
      timeLimit: 20,
      explanation: 'Vector Databases (like Pinecone, Milvus, Qdrant) index high-dimensional numeric arrays to perform fast semantic searches.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q5.id, text: 'Vector Database (e.g. Pinecone, Milvus, Chroma)', isCorrect: 'true' },
      { questionId: q5.id, text: 'Standard Relational Table with no index keys', isCorrect: 'false' },
      { questionId: q5.id, text: 'Flat File text spreadsheet (CSV)', isCorrect: 'false' },
      { questionId: q5.id, text: 'Distributed Ledger Blockchains', isCorrect: 'false' },
    ],
  });

  console.log(`Successfully seeded Quizzes!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
