export class System {
    #db;
    #route;

    constructor(db, route) {
        this.#db = db;
        this.#route = route;
    }

    register(app) {
        app.get(
            this.#route.dbTest,
            this.#route.asyncRoute(async (req, res) => {
                const dbTime = await this.#db.checkConnection();

                res.send(`
                    <h1>Kết nối Database thành công</h1>
                    <p>Thời gian database: ${dbTime.current_time}</p>
                `);
            }),
        );
    }
}
