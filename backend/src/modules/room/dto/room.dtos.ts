import { IsString, IsNotEmpty, IsOptional, Length, Matches } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'PIN must be exactly 6 characters' })
  @Matches(/^\d{6}$/, { message: 'PIN must consist of 6 numeric digits' })
  pin: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 40, { message: 'Name must be between 1 and 40 characters' })
  name: string;
}

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsOptional()
  @IsString()
  optionId?: string;

  @IsOptional()
  @IsString()
  textResponse?: string;
}

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  quizId: string;

  @IsString()
  @IsNotEmpty()
  hostId: string;
}

export class StartQuizDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  hostId?: string;
}

export class ReconnectPlayerDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsString()
  @IsNotEmpty()
  playerId: string;

  @IsString()
  @IsNotEmpty()
  reconnectToken: string;
}

export class HostActionDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  pin: string;

  @IsOptional()
  @IsString()
  hostId?: string;
}
