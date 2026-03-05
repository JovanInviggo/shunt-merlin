import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ParticipantLoginResponseDto,
  AdminLoginResponseDto,
  TokenPairResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
@Throttle({ global: { ttl: 60_000, limit: 5 } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Participant login via study ID' })
  @ApiResponse({ status: 201, type: ParticipantLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or inactive study ID' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginWithStudyId(dto);
  }

  @Post('admin/login')
  @ApiOperation({ summary: 'Admin login via email and password' })
  @ApiResponse({ status: 201, type: AdminLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Rotate a refresh token',
    description:
      'Consumes the provided refresh token (single-use) and returns a new access token + new refresh token. ' +
      'Store the new refresh token immediately — the old one is invalidated.',
  })
  @ApiResponse({ status: 201, type: TokenPairResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token (logout)' })
  @ApiResponse({ status: 204, description: 'Token revoked' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto);
  }
}
