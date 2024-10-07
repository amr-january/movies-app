import {
  feature,
  field,
  mandatory,
  policy,
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
import z, { unknown } from 'zod';
import { tables } from '@workspace/entities';
import { SelectQueryBuilder } from 'typeorm';
import { handleOrderBy } from '@extensions/utils';

export default feature({
  tables: {
    actors: table({
      fields: {
        name: field.shortText(),
        photo: field.shortText(),
      },
    }),

    directors: table({
      fields: {
        name: field.shortText(),
        photo: field.shortText(),
      },
    }),

    movies: table({
      fields: {
        title: field.shortText(),
        description: field.longText(),
        poster: field.url(),
        releaseDate: field.datetime(),
      },
    }),

    movieActors: table({
      fields: {
        actor: field.relation({ references: useTable('actors'), relationship: 'many-to-one' }),
        movie: field.relation({ references: useTable('movies'), relationship: 'many-to-one' }),
      },
    }),

    movieDirectors: table({
      fields: {
        creator: field.relation({ references: useTable('directors'), relationship: 'many-to-one' }),
        movie: field.relation({ references: useTable('movies'), relationship: 'many-to-one' }),
      },
    }),

    movieMusic: table({
      fields: {
        title: field.shortText(),
        url: field.shortText(),
        movie: field.relation({ references: useTable('movies'), relationship: 'many-to-one' }),
      },
    }),

    movieTrailers: table({
      fields: {
        url: field.shortText(),
        movie: field.relation({ references: useTable('movies'), relationship: 'one-to-one' }),
      },
    }),

    collection: table({
      fields: {
        movie: field.relation({ references: useTable('movies'), relationship: 'many-to-one' }),
        user: field.relation({ references: useTable('users'), relationship: 'many-to-one' }),
      }
    }),
    
    favoriteActors: table({
      fields: {
        actor: field.relation({ references: useTable('actors'), relationship: 'many-to-one' }),
        user: field.relation({ references: useTable('users'), relationship: 'many-to-one' }),
      }
    }),
    
    favoriteDirectors: table({
      fields: {
        director: field.relation({ references: useTable('directors'), relationship: 'many-to-one' }),
        user: field.relation({ references: useTable('users'), relationship: 'many-to-one' }),
      }
    }),

    favoriteMovies: table({
      fields: {
        movie: field.relation({ references: useTable('movies'), relationship: 'many-to-one' }),
        user: field.relation({ references: useTable('users'), relationship: 'many-to-one' }),
      }
    }),

    favoriteMusic: table({
      fields: {
        movie: field.relation({ references: useTable('moviesMusic'), relationship: 'many-to-one' }),
        user: field.relation({ references: useTable('users'), relationship: 'many-to-one' }),
      }
    }),
  },

  workflows: [
    workflow('ListMoviesWorkflow', {
      tag: 'list',

      trigger: trigger.http({
        method: 'get',
        path: '/',
        input: trigger => ({
          limit: {
            select: trigger.query.limit,
            against: z.coerce.number().min(1).optional()
          },
          offset: {
            select: trigger.query.offset,
            against: z.coerce.number().min(0).optional()
          },
          orderBy: {
            select: trigger.query.orderBy,
            against: z.string().min(1).optional()
          }
        })
      }),

      execute: async ({ input }) => {
        const qb: SelectQueryBuilder<InstanceType<typeof tables.movies>> = createQueryBuilder(tables.movies, 'movies');

        if (input.limit) qb.limit(input.limit);
        if (input.offset) qb.offset(input.offset);
        if (input.orderBy) handleOrderBy(qb, input.orderBy)

        return {
          data: await qb.getMany()
        }
      }
    }),

    workflow('AddActorWorkflow', {
      tag: 'actors',

      trigger: trigger.http({
        method: 'post',
        path: '/',
        input: (trigger) => ({
          name: {
            select: trigger.body.name,
            against: z.string().trim().min(1),
          },
          photo: {
            select: trigger.body.photo,
            against: z.string().url(),
          }
        }),
      }),

      execute: async ({ input }) => {
        const { id } = await saveEntity(tables.actors, {
          name: input.name,
          photo: input.photo,
        });
        return { id };
      },
    }),

    workflow('UpdateActorWorkflow', {
      tag: 'actors',

      trigger: trigger.http({
        method: 'patch',
        path: '/',
        input: (trigger) => ({
          id: {
            select: trigger.body.id,
            against: z.string().uuid(),
          },
          name: {
            select: trigger.body.name,
            against: z.string().trim().min(1).optional(),
          },
          photo: {
            select: trigger.body.photo,
            against: z.string().url().optional(),
          }
        }),
      }),

      execute: async ({ input }) => {
        const qb = createQueryBuilder(tables.actors, 'actors').where(
          'actors.id = :id',
          { id: input.id },
        );
        await patchEntity(qb, {
          name: input.name,
          photo: input.photo,
        });
        return { id: input.id };
      },
    }),

    workflow('ListActorsWorkflow', {
      tag: 'actors',

      trigger: trigger.http({
        method: 'get',
        path: '/',
        input: (trigger) => ({
          pageSize: {
            select: trigger.query.pageSize,
            against: z.number().min(1).max(100).optional(),
          },
          pageNo: {
            select: trigger.query.pageNo,
            against: z.number().min(1).optional(),
          },
        }),
      }),
      
      execute: async ({ input }) => {
        const qb = createQueryBuilder(tables.actors, 'actors');
        const paginationMetadata = deferredJoinPagination(qb, {
          pageSize: input.pageSize || 100,
          pageNo: input.pageNo || 1,
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

policy.authenticated()