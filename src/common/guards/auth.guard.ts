import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'RIDER' | 'DRIVER' | 'ADMIN';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    
    // In production, this would validate JWT tokens
    // For now, we check for x-user-id and x-user-role headers (dev/testing)
    const userId = request.headers['x-user-id'] as string;
    const userEmail = request.headers['x-user-email'] as string;
    const userRole = request.headers['x-user-role'] as string;

    if (!userId || !userRole) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = {
      id: userId,
      email: userEmail || 'unknown@example.com',
      role: userRole as 'RIDER' | 'DRIVER' | 'ADMIN',
    };

    return true;
  }
}
