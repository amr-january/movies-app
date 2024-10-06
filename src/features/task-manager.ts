import {
  feature,
  field,
  table,
  trigger,
  useTable,
  workflow,
} from '@january/declarative';
import {
  createQueryBuilder,
  deferredJoinPagination,
  execute,
  patchEntity,
  saveEntity,
} from '@extensions/postgresql';
import z from 'zod';
import { tables } from '@workspace/entities';

export default feature({
  tables: {
    categories: table({
      fields: {
        name: field.shortText(),
      },
    }),
    tasks: table({
      fields: {
        title: field.shortText(),
        description: field.longText(),
        category: field.relation({
          references: useTable('categories'),
          relationship: 'many-to-one',
        }),
      },
    }),
  },
  workflows: [
    workflow('AddCategoryWorkflow', {
      tag: 'category',
      trigger: trigger.http({
        method: 'post',
        path: '/',
        input: (trigger) => ({
          name: {
            select: trigger.body.name,
            against: z.string().trim().min(1),
          },
        }),
      }),
      execute: async ({ input }) => {
        const { id } = await saveEntity(tables.categories, {
          name: input.name,
        });
        return { id };
      },
    }),
    workflow('AddTaskWorkflow', {
      tag: 'tasks',
      trigger: trigger.http({
        method: 'post',
        path: '/',
        input: (trigger) => ({
          title: {
            select: trigger.body.title,
            against: z.string().trim().min(1),
          },
          description: {
            select: trigger.body.description,
            against: z.string().trim(),
          },
          categoryId: {
            select: trigger.body.categoryId,
            against: z.string().uuid(),
          },
        }),
      }),
      execute: async ({ input }) => {
        const { id } = await saveEntity(tables.tasks, {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
        });
        return { id };
      },
    }),
    workflow('UpdateTaskWorkflow', {
      tag: 'tasks',
      trigger: trigger.http({
        method: 'put',
        path: '/',
        input: (trigger) => ({
          id: {
            select: trigger.body.id,
            against: z.string().uuid(),
          },
          title: {
            select: trigger.body.title,
            against: z.string().trim().min(1),
          },
          description: {
            select: trigger.body.description,
            against: z.string().trim(),
          },
          categoryId: {
            select: trigger.body.categoryId,
            against: z.string().uuid(),
          },
        }),
      }),
      execute: async ({ input }) => {
        const qb = createQueryBuilder(tables.tasks, 'tasks').where(
          'tasks.id = :id',
          { id: input.id },
        );
        await patchEntity(qb, {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId,
        });
        return { id: input.id };
      },
    }),
    workflow('ListTasksWorkflow', {
      tag: 'tasks',
      trigger: trigger.http({
        method: 'get',
        path: '/',
        input: (trigger) => ({
          pageSize: {
            select: trigger.query.pageSize,
            against: z.number().min(1).max(100),
          },
          pageNo: {
            select: trigger.query.pageNo,
            against: z.number().min(1),
          },
        }),
      }),
      execute: async ({ input }) => {
        const qb = createQueryBuilder(tables.tasks, 'tasks');
        const paginationMetadata = deferredJoinPagination(qb, {
          pageSize: input.pageSize,
          pageNo: input.pageNo,
          count: await qb.getCount(),
        });
        const records = await execute(qb);
        return {
          meta: paginationMetadata(records),
          records: records,
        };
      },
    }),
  ],
});