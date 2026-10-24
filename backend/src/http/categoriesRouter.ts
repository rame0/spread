import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireCsrf, type AuthRequest } from '../auth/middleware';
import { parseBody, parseQuery } from './validation';
import * as categoryService from '../services/categoryService';

const router = Router();

const fields = {
  name: z.string().trim().min(1).max(64),
  referenceCategories: z.array(z.string().min(1).max(64)).max(64),
};
const createSchema = z.object({ name: fields.name, referenceCategories: fields.referenceCategories.optional() });
const patchSchema = z
  .object(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const suggestQuerySchema = z.object({ text: z.string().trim().min(1).max(512) });

router.use(requireAuth);
router.use(requireCsrf);

const uuidSchema = z.string().uuid();
router.param('categoryId', (_req, res, next, value) => {
  if (!uuidSchema.safeParse(value).success) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  next();
});

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await categoryService.listCategories(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.get('/reference', (_req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    res.json(categoryService.listReferenceCategories());
  } catch (error) {
    next(error);
  }
});

router.get('/suggest', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text } = parseQuery(suggestQuerySchema, req.query);
    res.json(await categoryService.suggestCategory(req.userId!, text));
  } catch (error) {
    next(error);
  }
});

router.get('/uncategorized', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await categoryService.listUncategorizedPurchases(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/backfill', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json(await categoryService.backfillCategories(req.userId!));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(createSchema, req.body);
    res.status(201).json(await categoryService.createCategory(req.userId!, data));
  } catch (error) {
    if (error instanceof categoryService.CategoryError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.patch('/:categoryId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = parseBody(patchSchema, req.body);
    const category = await categoryService.updateCategory(req.userId!, req.params.categoryId, data);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json(category);
  } catch (error) {
    if (error instanceof categoryService.CategoryError) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/:categoryId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await categoryService.deleteCategory(req.userId!, req.params.categoryId))) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
