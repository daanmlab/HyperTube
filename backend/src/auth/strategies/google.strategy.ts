import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const { id, name, emails, photos } = profile;

      const user = await this.authService.findOrCreateGoogleUser({
        googleId: id,
        email: emails[0].value,
        username: emails[0].value.split('@')[0], // Use email prefix as username
        firstName: name.givenName,
        lastName: name.familyName,
        avatarUrl: photos?.[0]?.value,
        oauthData: {
          accessToken,
          refreshToken,
          profile,
        },
      });

      return user;
    } catch (error) {
      console.error('Google OAuth validation error:', error);
      return done(error, false);
    }
  }
}
