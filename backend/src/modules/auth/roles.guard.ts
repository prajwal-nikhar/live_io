import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  HOST: 60,
  MODERATOR: 40,
  PARTICIPANT: 20,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException("User context missing or unauthenticated");
    }

    // Direct match check
    if (requiredRoles.includes(user.role)) {
      return true;
    }

    // Hierarchy check: Check if user's role weight >= minimum required role weight
    const userWeight = ROLE_HIERARCHY[user.role] || 0;
    const isAuthorized = requiredRoles.some(
      (role) => userWeight >= (ROLE_HIERARCHY[role] || 0),
    );

    if (!isAuthorized) {
      throw new ForbiddenException(
        `Insufficient permissions for role: ${user.role}`,
      );
    }

    return true;
  }
}
