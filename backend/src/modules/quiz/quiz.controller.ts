import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { QuizService } from "./quiz.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";

@Controller("quizzes")
export class QuizController {
  constructor(private quizService: QuizService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async createQuiz(@Request() req: any, @Body() body: any) {
    if (!body.title) {
      throw new BadRequestException("Quiz title is required");
    }
    return this.quizService.createQuiz(req.user.id, body);
  }

  @Post("ai-generate")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async generateAiQuiz(@Body() body: any) {
    const { topic, numQuestions } = body;
    if (!topic) {
      throw new BadRequestException("Topic is required for AI generation");
    }
    return this.quizService.generateAiQuiz(topic, numQuestions || 5);
  }

  @Post("import")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async importQuiz(@Body() body: any) {
    const { fileName, fileType } = body;
    if (!fileName || !fileType) {
      throw new BadRequestException("File name and type are required");
    }
    return this.quizService.parseImportedFile(fileName, fileType);
  }

  @Get("my-quizzes")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async getMyQuizzes(@Request() req: any) {
    return this.quizService.getMyQuizzes(req.user.id);
  }

  @Get("public")
  async getPublicQuizzes() {
    return this.quizService.getPublicQuizzes();
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  async getQuizById(@Param("id") id: string, @Request() req: any) {
    return this.quizService.getQuizById(id, req.user.id);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async updateQuiz(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    return this.quizService.updateQuiz(id, req.user.id, body);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async deleteQuiz(@Param("id") id: string, @Request() req: any) {
    await this.quizService.deleteQuiz(id, req.user.id);
    return { success: true, message: "Quiz deleted successfully" };
  }

  @Post(":id/duplicate")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async duplicateQuiz(@Param("id") id: string, @Request() req: any) {
    return this.quizService.duplicateQuiz(id, req.user.id);
  }

  // QUESTION CRUD
  @Post(":id/questions")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async addQuestion(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    if (!body.text) {
      throw new BadRequestException("Question text is required");
    }
    return this.quizService.addQuestion(id, req.user.id, body);
  }

  @Put("questions/:questionId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async updateQuestion(
    @Param("questionId") questionId: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    return this.quizService.updateQuestion(questionId, req.user.id, body);
  }

  @Delete("questions/:questionId")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("HOST", "ADMIN")
  async deleteQuestion(
    @Param("questionId") questionId: string,
    @Request() req: any,
  ) {
    await this.quizService.deleteQuestion(questionId, req.user.id);
    return { success: true, message: "Question deleted successfully" };
  }
}
