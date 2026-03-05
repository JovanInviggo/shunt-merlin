import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { StudyService } from '../study/study.service';

export interface JwtPayload {
  sub: string;
  type: 'participant' | 'admin';
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    private readonly studyService: StudyService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'admin') {
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'admin',
      };
    }

    if (payload.type === 'participant') {
      const study = await this.studyService.findById(payload.sub);
      if (!study || !study.isActive) {
        throw new UnauthorizedException('Study not found or inactive');
      }
      return {
        id: study.id,
        studyId: study.studyId,
        type: 'participant',
      };
    }

    throw new UnauthorizedException('Invalid token type');
  }
}
