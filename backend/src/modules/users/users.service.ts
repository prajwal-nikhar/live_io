import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, currentUser: any) {
    if (
      currentUser.role !== "SUPER_ADMIN" &&
      currentUser.role !== "ADMIN" &&
      currentUser.id !== id
    ) {
      throw new ForbiddenException(
        "You do not have permission to view this user profile",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async update(
    id: string,
    data: { name?: string; email?: string },
    currentUser: any,
  ) {
    if (
      currentUser.role !== "SUPER_ADMIN" &&
      currentUser.role !== "ADMIN" &&
      currentUser.id !== id
    ) {
      throw new ForbiddenException(
        "You do not have permission to update this user profile",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, currentUser: any) {
    if (currentUser.role !== "SUPER_ADMIN") {
      throw new ForbiddenException(
        "Only a SUPER_ADMIN can delete user accounts",
      );
    }

    if (currentUser.id === id) {
      throw new BadRequestException(
        "SUPER_ADMIN cannot delete their own account",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");

    // Soft Delete
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        refreshTokenHash: null,
      },
    });

    return {
      success: true,
      message: `User ${user.email} soft-deleted successfully`,
    };
  }

  async updateRole(id: string, newRole: string, currentUser: any) {
    if (currentUser.role !== "SUPER_ADMIN") {
      throw new ForbiddenException("Only a SUPER_ADMIN can change user roles");
    }

    const allowedRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "HOST",
      "MODERATOR",
      "PARTICIPANT",
    ];
    if (!allowedRoles.includes(newRole)) {
      throw new BadRequestException(
        `Invalid role specified. Must be one of: ${allowedRoles.join(", ")}`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: newRole },
      select: { id: true, email: true, name: true, role: true },
    });

    return {
      success: true,
      message: `User role updated from ${user.role} to ${newRole}`,
      user: updatedUser,
    };
  }

  async setActivation(id: string, isActive: boolean, currentUser: any) {
    if (currentUser.role !== "SUPER_ADMIN") {
      throw new ForbiddenException(
        "Only a SUPER_ADMIN can activate or deactivate accounts",
      );
    }

    if (currentUser.id === id) {
      throw new BadRequestException(
        "SUPER_ADMIN cannot deactivate their own account",
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException("User not found");

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive,
        ...(isActive === false ? { refreshTokenHash: null } : {}),
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    return {
      success: true,
      message: `User ${user.email} ${isActive ? "activated" : "deactivated"} successfully`,
      user: updatedUser,
    };
  }
}
