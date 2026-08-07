import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === "production") {
          throw new Error(
            "CRITICAL: JWT_SECRET environment variable is missing",
          );
        }
        return {
          secret: secret || "dev-fallback-secret-key-change-in-prod",
          signOptions: { expiresIn: process.env.JWT_EXPIRATION || "15m" },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, JwtStrategy],
})
export class AuthModule {}
