import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import axios from 'axios';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  constructor(private authService: AuthService) {
    super({
      authorizationURL: 'https://api.intra.42.fr/oauth/authorize',
      tokenURL: 'https://api.intra.42.fr/oauth/token',
      clientID: process.env.FORTY_TWO_CLIENT_ID,
      clientSecret: process.env.FORTY_TWO_CLIENT_SECRET,
      callbackURL: process.env.FORTY_TWO_CALLBACK_URL,
      scope: ['public'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: any): Promise<any> {
    try {
      // Get user info from 42 API
      const response = await axios.get('https://api.intra.42.fr/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const fortyTwoUser = response.data;

      // Find or create user in our database
      const user = await this.authService.findOrCreateFortyTwoUser({
        fortyTwoId: fortyTwoUser.id.toString(),
        email: fortyTwoUser.email,
        username: fortyTwoUser.login,
        firstName: fortyTwoUser.first_name,
        lastName: fortyTwoUser.last_name,
        avatarUrl: fortyTwoUser.image?.link,
        fortyTwoLogin: fortyTwoUser.login,
        oauthData: {
          accessToken,
          refreshToken,
          profile: fortyTwoUser,
        },
      });

      return user;
    } catch (error) {
      console.error('42 OAuth validation error:', error);
      return done(error, null);
    }
  }
}
