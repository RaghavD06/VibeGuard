import { Router, Request, Response } from 'express';
import { hashPassword, verifyPassword, createToken, requireAuth, AuthenticatedRequest } from '../auth';
import { prisma } from '../prisma';
import { sharedRateLimit } from '../rate-limit';

const router = Router();
router.use(['/register', '/login'], sharedRateLimit('auth', 20));

/**
 * POST /api/auth/register
 * Body: { email, password, name? }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (name !== undefined && (typeof name !== 'string' || name.length > 200)) {
      return res.status(400).json({ error: 'Name is invalid' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing user
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name?.trim() || null
      },
      select: {
        id: true,
        email: true,
        name: true,
        tokenVersion: true,
        createdAt: true
      }
    });

    const token = createToken(user);

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
    });
  } catch (error: any) {
    console.error('Registration failed');
    return res.status(500).json({ error: 'Registration failed due to server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      name: user.name,
      tokenVersion: user.tokenVersion
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
    });
  } catch (error: any) {
    console.error('Login failed');
    return res.status(500).json({ error: 'Login failed due to server error' });
  }
});

/**
 * GET /api/auth/me
 * Protected: Returns current authenticated user profile
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user });
});

/**
 * POST /api/auth/logout
 * Revokes all existing tokens for this account by advancing the server-side version.
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { tokenVersion: { increment: 1 } }
    });
    return res.json({ message: 'All sessions revoked' });
  } catch {
    return res.status(503).json({ error: 'Could not revoke session' });
  }
});

export default router;
