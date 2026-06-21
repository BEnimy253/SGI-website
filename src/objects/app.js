import express from "express";

import { AccountCredentials } from "./account/account-credentials.js";
import { Http } from "./core/http.js";
import { Presenter } from "./core/presenter.js";
import { Session } from "./core/session.js";
import { Values } from "./core/values.js";
import { DB } from "./db/db.js";
import { Page } from "./page/page.js";
import { Route } from "./route/route.js";
import { System } from "./system/system.js";
import { User } from "./user/user.js";

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
            new Page(route),
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
        this.#app.use(express.static("public", { index: false }));
    }

    run() {
        this.#modules.forEach((module) => module.register(this.#app));
        this.#app.use(this.#errorHandler);
        this.#app.listen(this.#port, () => {
            console.log(`Server đang chạy tại http://localhost:${this.#port}`);
        });
    }
}
