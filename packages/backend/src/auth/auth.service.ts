import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { StudyService } from '../study/study.service';
import { RefreshTokenService } from './refresh-token.service';
import { LoginDto } from './dto/login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly studyService: StudyService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async loginWithStudyId(dto: LoginDto) {
    const study = await this.studyService.findByStudyId(dto.studyId);

    if (!study) {
      throw new UnauthorizedException('Invalid study ID');
    }

    if (!study.isActive) {
      throw new UnauthorizedException('Study is no longer active');
    }

    const accessToken = this.jwtService.sign({
      sub: study.id,
      type: 'participant' as const,
    });

    const refreshToken = await this.refreshTokenService.generate(
      study.id,
      'participant',
    );

    return {
      accessToken,
      refreshToken,
      type: 'participant',
      studyId: study.studyId,
    };
  }

  async adminLogin(dto: AdminLoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
      user,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      type: 'admin' as const,
      role: user.role,
    });

    const refreshToken = await this.refreshTokenService.generate(
      user.id,
      'admin',
    );

    return {
      accessToken,
      refreshToken,
      type: 'admin',
      role: user.role,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const result = await this.refreshTokenService.consume(dto.refreshToken);

    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { subjectId, type, newRawToken } = result;

    if (type === 'admin') {
      const user = await this.userService.findById(subjectId);
      if (!user) throw new UnauthorizedException('User not found');

      return {
        accessToken: this.jwtService.sign({
          sub: user.id,
          type: 'admin' as const,
          role: user.role,
        }),
        refreshToken: newRawToken,
      };
    }

    const study = await this.studyService.findById(subjectId);
    if (!study || !study.isActive) {
      throw new UnauthorizedException('Study not found or inactive');
    }

    return {
      accessToken: this.jwtService.sign({
        sub: study.id,
        type: 'participant' as const,
      }),
      refreshToken: newRawToken,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    await this.refreshTokenService.revoke(dto.refreshToken);
  }
}
