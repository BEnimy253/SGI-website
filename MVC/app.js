import express from "express";
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Page } from "./controllers/page/page.js";
import { System } from "./controllers/system/system.js";
import { User } from "./controllers/user/user.js";
import { Session } from "./middleware/session.js";
import { AccountCredentials } from "./models/account/account-credentials.js";
import { DB } from "./models/db/db.js";
import { Route } from "./routes/route.js";
import { Http } from "./utils/http.js";
import { Presenter } from "./utils/presenter.js";
import { Values } from "./utils/values.js";

const applicationDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(applicationDirectory, "public");
const viewsDirectory = path.join(applicationDirectory, "views");

export class App {
    #app;
    #errorHandler;
    #modules;
    #port;

    constructor() {
        this.#app = express();
        this.#port = process.env.PORT || 3000;

        const db = new DB();  // Connect to Database
        const route = new Route();
        const http = new Http();
        const presenter = new Presenter();
        const values = new Values(http);
        const credentials = new AccountCredentials(http, values);
        const dependencies = {
            credentials,
            db,
            http,
            presenter,
            route,
            values,
        };

        this.#modules = [
            new Session(),
            new Page(route, viewsDirectory),
            new System(db, route),
            new User(dependencies),
        ];
        this.#errorHandler = http.errorHandler;

        this.#configure();
    }

    #configure() {
        this.#app.set("trust proxy", 1);
        this.#app.use(express.urlencoded({ extended: true }));
        this.#app.use(express.json());
        this.#app.use(
            "/css",
            express.static(path.join(publicDirectory, "css"), { index: false }),
        );
        this.#app.use(
            "/images",
            express.static(path.join(publicDirectory, "images"), {
                index: false,
            }),
        );
        this.#app.use(
            "/js",
            express.static(path.join(publicDirectory, "js"), { index: false }),
        );
    }

    run() {
        this.#modules.forEach((module) => module.register(this.#app));
        this.#app.use(this.#errorHandler);
        this.#app.listen(this.#port, () => {
            console.log(`Server đang chạy tại http://localhost:${this.#port}`);
        });
    }
}

new App().run();
