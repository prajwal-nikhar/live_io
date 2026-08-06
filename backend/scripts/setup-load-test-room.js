const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  let user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database');
    process.exit(1);
  }

  let quiz = await prisma.quiz.findFirst({
    include: { questions: { include: { options: true } } },
  });

  if (!quiz || quiz.questions.length === 0) {
    quiz = await prisma.quiz.create({
      data: {
        title: 'Load Test Quiz',
        description: 'Quiz for 600 concurrent users stress test',
        hostId: user.id,
        questions: {
          create: [
            {
              text: 'Load Test Q1',
              type: 'MULTIPLE_CHOICE',
              order: 0,
              points: 100,
              timeLimit: 60,
              options: {
                create: [
                  { text: 'Option A', isCorrect: 'true' },
                  { text: 'Option B', isCorrect: 'false' },
                  { text: 'Option C', isCorrect: 'false' },
                  { text: 'Option D', isCorrect: 'false' },
                ],
              },
            },
          ],
        },
      },
      include: { questions: { include: { options: true } } },
    });
  }

  const pin = '999999';

  await prisma.quizSession.upsert({
    where: { pin },
    update: {
      status: 'LOBBY',
      currentQuestionIndex: 0,
      currentQuestionId: quiz.questions[0].id,
    },
    create: {
      pin,
      quizId: quiz.id,
      hostId: user.id,
      status: 'LOBBY',
      currentQuestionIndex: 0,
      currentQuestionId: quiz.questions[0].id,
    },
  });

  console.log(`Successfully setup Load Test Quiz Session with PIN: ${pin}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
