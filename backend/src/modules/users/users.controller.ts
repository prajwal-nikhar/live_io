import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UpdateUserDto, UpdateRoleDto } from "./dto/users.dto";

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN")
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN")
  async remove(@Param("id") id: string, @Request() req: any) {
    return this.usersService.remove(id, req.user);
  }

  @Patch(":id/role")
  @Roles("SUPER_ADMIN")
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: any,
  ) {
    return this.usersService.updateRole(id, dto.role, req.user);
  }

  @Patch(":id/activate")
  @Roles("SUPER_ADMIN")
  async activate(@Param("id") id: string, @Request() req: any) {
    return this.usersService.setActivation(id, true, req.user);
  }

  @Patch(":id/deactivate")
  @Roles("SUPER_ADMIN")
  async deactivate(@Param("id") id: string, @Request() req: any) {
    return this.usersService.setActivation(id, false, req.user);
  }
}
