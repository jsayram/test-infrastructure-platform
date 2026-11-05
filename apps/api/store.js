import { Pool } from 'pg';

export function createStore(env) {
  const pool = new Pool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? '5432'),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.POSTGRES_PASSWORD,
    max: 4,
    connectionTimeoutMillis: 2000,
    query_timeout: 4000,
  });
  pool.on('error', () => console.error('Idle task database connection failed'));

  async function one(sql, values = []) {
    const result = await pool.query(sql, values);
    return result.rows[0] ?? null;
  }

  return {
    ready: () => one('select 1 from demo_users limit 1'),
    close: () => pool.end(),
    createUser: (name) => one(
      'insert into demo_users (name) values ($1) on conflict (name) do nothing returning id, name', [name],
    ),
    findUser: (name) => one('select id, name from demo_users where name = $1', [name]),
    getUser: (id) => one('select id, name from demo_users where id = $1', [id]),
    renameUser: (id, name) => one('update demo_users set name = $2 where id = $1 returning id, name', [id, name]),
    deleteUser: (id) => one('delete from demo_users where id = $1 returning id', [id]),
    async listTasks(userId) {
      const result = await one(
        `select coalesce(
          json_agg(
            json_build_object('id', t.id, 'title', t.title, 'completed', t.completed)
            order by t.created_at, t.id
          ) filter (where t.id is not null),
          '[]'::json
        ) as tasks
        from demo_users u
        left join tasks t on t.user_id = u.id
        where u.id = $1
        group by u.id`,
        [userId],
      );
      return result?.tasks ?? null;
    },
    createTask: (userId, title) => one(
      'insert into tasks (user_id, title) select id, $2 from demo_users where id = $1 returning id, title, completed',
      [userId, title],
    ),
    getTask: (userId, taskId) => one(
      'select id, title, completed from tasks where user_id = $1 and id = $2', [userId, taskId],
    ),
    updateTask: (userId, taskId, title, completed) => one(
      'update tasks set title = coalesce($3, title), completed = coalesce($4, completed) ' +
      'where user_id = $1 and id = $2 returning id, title, completed',
      [userId, taskId, title, completed],
    ),
    deleteTask: (userId, taskId) => one(
      'delete from tasks where user_id = $1 and id = $2 returning id', [userId, taskId],
    ),
  };
}
