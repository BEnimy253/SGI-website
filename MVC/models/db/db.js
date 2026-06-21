import pg from "pg";

export class DB {
    #pool;

    constructor() {
        this.#pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        });
    }

    getPool() {
        return this.#pool;
    }

    async checkConnection() {
        const result = await this.#pool.query(
            "select now() as current_time",
        );
        return result.rows[0];
    }

    async withAppContext(req, handler) {
        const client = await this.#pool.connect();

        try {
            await client.query("begin");
            // Notice to database who is working
            await client.query(
                "select set_config('app.account_id', $1, true)",
                [String(req.session.userId ?? "")],
            );

            const result = await handler(client);
            await client.query("commit");
            return result;
        } catch (error) {
            await client.query("rollback").catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }
}
