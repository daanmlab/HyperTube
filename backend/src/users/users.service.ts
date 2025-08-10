import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { FortyTwoUserData } from '../auth/auth.service';
import { RegisterDto } from '../auth/dto/auth.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: RegisterDto): Promise<User> {
    // Check if user with email already exists
    const existingUserByEmail = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUserByEmail) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if user with username already exists
    const existingUserByUsername = await this.usersRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUserByUsername) {
      throw new ConflictException('User with this username already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // Create new user
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: [
        { email: identifier },
        { username: identifier },
      ],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByFortyTwoId(fortyTwoId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { fortyTwoId } });
  }

  async createFromFortyTwo(userData: FortyTwoUserData): Promise<User> {
    // Check if username is already taken, if so, append a number
    let username = userData.username;
    let counter = 1;
    
    while (await this.findByUsername(username)) {
      username = `${userData.username}${counter}`;
      counter++;
    }

    // Create new user from 42 data
    const user = this.usersRepository.create({
      email: userData.email,
      username: username,
      firstName: userData.firstName,
      lastName: userData.lastName,
      fortyTwoId: userData.fortyTwoId,
      fortyTwoLogin: userData.fortyTwoLogin,
      avatarUrl: userData.avatarUrl,
      oauthData: userData.oauthData,
      password: undefined, // No password for OAuth users
      lastLoginAt: new Date(),
    });

    return this.usersRepository.save(user);
  }

  async linkFortyTwoAccount(userId: string, userData: FortyTwoUserData): Promise<User> {
    await this.usersRepository.update(userId, {
      fortyTwoId: userData.fortyTwoId,
      fortyTwoLogin: userData.fortyTwoLogin,
      avatarUrl: userData.avatarUrl,
      oauthData: userData.oauthData,
      lastLoginAt: new Date(),
    });

    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found after linking 42 account');
    }
    return user;
  }

  async updateFortyTwoData(userId: string, userData: FortyTwoUserData): Promise<User> {
    await this.usersRepository.update(userId, {
      avatarUrl: userData.avatarUrl,
      oauthData: userData.oauthData,
      lastLoginAt: new Date(),
    });

    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found after updating 42 data');
    }
    return user;
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!hashedPassword) {
      return false; // OAuth users don't have passwords
    }
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Convert user entity to safe object (without password)
  toSafeUser(user: User) {
    const { password, oauthData, ...safeUser } = user;
    return {
      ...safeUser,
      fullName: user.fullName,
    };
  }
}
